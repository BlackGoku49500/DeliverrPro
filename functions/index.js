const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');
const crypto = require('crypto');

admin.initializeApp();

// Read Razorpay credentials from Firebase config environment variables
// Configured using command: firebase functions:config:set razorpay.key_id="..." razorpay.key_secret="..."
const keyId = functions.config().razorpay ? functions.config().razorpay.key_id : "";
const keySecret = functions.config().razorpay ? functions.config().razorpay.key_secret : "";

let rzpInstance = null;

function getRazorpayInstance() {
    if (!rzpInstance) {
        if (!keyId || !keySecret) {
            throw new functions.https.HttpsError(
                'failed-precondition', 
                'Razorpay keys are not configured. Run "firebase functions:config:set razorpay.key_id=\"...\" razorpay.key_secret=\"...\"" first.'
            );
        }
        rzpInstance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
    }
    return rzpInstance;
}

// 1. CREATE RAZORPAY ORDER (Called by Client before opening checkout)
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
    // Check if user is logged in
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Pehle log in karein.');
    }

    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Amount sahi nahi hai.');
    }

    try {
        const razorpay = getRazorpayInstance();
        
        const options = {
            amount: Math.round(amount * 100), // Amount in paise
            currency: 'INR',
            receipt: 'rcpt_' + Math.random().toString(36).substring(2, 15)
        };

        const order = await razorpay.orders.create(options);
        return { orderId: order.id };
    } catch (err) {
        console.error("Razorpay Order Creation Failed:", err);
        throw new functions.https.HttpsError('internal', 'Razorpay order code generate nahi ho paya. Dobara try kare.');
    }
});

// 2. VERIFY PAYMENT AND SAVE ORDER (Called by Client after successful payment)
exports.verifyAndSaveOrder = functions.https.onCall(async (data, context) => {
    // Check if user is logged in
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Pehle log in karein.');
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderData } = data;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderData) {
        throw new functions.https.HttpsError('invalid-argument', 'Payment confirmation details adhure hain.');
    }

    // Verify signature using the secret key
    try {
        const hmac = crypto.createHmac('sha256', keySecret);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.error("Payment signature verification failed!");
            throw new functions.https.HttpsError('permission-denied', 'Payment verify nahi hua. Signature galat hai.');
        }
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        throw new functions.https.HttpsError('internal', 'Payment verification me samasya aayi.');
    }

    // Save the order to Firestore securely on the backend
    try {
        const db = admin.firestore();
        const shortId = "ORD-" + Math.floor(100000 + Math.random() * 900000);

        const secureOrder = {
            id: shortId,
            customerId: context.auth.uid,
            shopName: orderData.shopName,
            ownerName: orderData.ownerName,
            customerMobile: orderData.customerMobile,
            village: orderData.village || orderData.villageArea || "", // Support both formats
            landmark: orderData.landmark || "",
            items: orderData.items,
            totalQuantity: parseInt(orderData.totalQuantity),
            totalAmount: parseFloat(orderData.totalAmount),
            paymentStatus: "paid",
            paymentId: razorpay_payment_id,
            orderDate: new Date().toISOString().split('T')[0],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            deliveryStatus: "pending"
        };

        await db.collection('orders').doc(shortId).set(secureOrder);
        
        // Return successful order object with a stringified timestamp for frontend
        return { 
            success: true, 
            order: {
                ...secureOrder,
                createdAt: new Date().toISOString()
            }
        };
    } catch (err) {
        console.error("Failed to save verified order:", err);
        throw new functions.https.HttpsError('internal', 'Order database me save nahi ho paya. Kripya support se sampark karein.');
    }
});

// Deliverr - Database Abstraction Layer (Firebase & LocalStorage Mock)

const db = (() => {
    // Check if we are using Mock Mode
    const isMock = CONFIG.useMockMode;

    const defaultProducts = [
        {
            name: "Burger Bun",
            category: "Breads & Buns",
            imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Chhota", price: 45, unit: "Darjan" },
                { name: "Bada", price: 80, unit: "Darjan" }
            ]
        },
        {
            name: "Bread",
            category: "Breads & Buns",
            imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "250g", price: 25, unit: "Packet" },
                { name: "450g", price: 40, unit: "Packet" },
                { name: "600g", price: 50, unit: "Packet" },
                { name: "700g", price: 60, unit: "Packet" }
            ]
        },
        {
            name: "Veg Momos (Frozen)",
            category: "Momos",
            imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Gol", price: 180, unit: "1 Packet (50 Pcs)" },
                { name: "Lambe", price: 200, unit: "1 Packet (50 Pcs)" }
            ]
        },
        {
            name: "Lal Sauce",
            category: "Sauces & Spreads",
            imageUrl: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Local", price: 90, unit: "1 Bottle (1.2 Kg)" },
                { name: "Kirti", price: 120, unit: "1 Bottle (1.2 Kg)" },
                { name: "TamTam", price: 150, unit: "1 Bottle (1.2 Kg)" }
            ]
        },
        {
            name: "Vinegar",
            category: "Sauces & Spreads",
            imageUrl: "https://images.unsplash.com/photo-1607305387299-a3d9611cd46f?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "White", price: 60, unit: "1 Bottle (1 Ltr)" },
                { name: "Black", price: 70, unit: "1 Bottle (1 Ltr)" }
            ]
        },
        {
            name: "Chowmein Noodles",
            category: "Noodles & Pasta",
            imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Standard", price: 65, unit: "1 Packet (1 Kg)" }
            ]
        },
        {
            name: "Spring Rolls (Veg)",
            category: "Rolls",
            imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Standard", price: 140, unit: "1 Packet (20 Pcs)" }
            ]
        },
        {
            name: "Aloo Patties",
            category: "Patties & Snacks",
            imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Standard", price: 80, unit: "1 Box (10 Pcs)" }
            ]
        },
        {
            name: "Premium Mayonnaise",
            category: "Sauces & Spreads",
            imageUrl: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Standard", price: 160, unit: "1 Jar (1 Kg)" }
            ]
        },
        {
            name: "Fresh Eggs Crate",
            category: "Eggs & Dairy",
            imageUrl: "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=150&q=80",
            status: "active",
            variants: [
                { name: "Standard", price: 180, unit: "1 Crate (30 Eggs)" }
            ]
        }
    ];

    // --- MOCK DATABASE (LocalStorage) IMPLEMENTATION ---
    const mockStorage = {
        get: (key) => JSON.parse(localStorage.getItem(`deliverr_${key}`)),
        set: (key, val) => localStorage.setItem(`deliverr_${key}`, JSON.stringify(val)),
        init: () => {
            console.log("🚀 Running in MOCK DATABASE mode (LocalStorage).");
            
            // 1. Initial Products
            if (!localStorage.getItem('deliverr_products')) {
                const initialProducts = defaultProducts.map((p, index) => ({
                    id: "p" + (index + 1),
                    ...p
                }));
                mockStorage.set('products', initialProducts);
            }

            // 3. Initial Settings
            if (!localStorage.getItem('deliverr_settings')) {
                mockStorage.set('settings', {
                    orderClosingTime: CONFIG.defaultClosingTime
                });
            }

            // 4. Initial Broadcasts
            if (!localStorage.getItem('deliverr_broadcasts')) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                const initialBroadcasts = [
                    {
                        id: "b1",
                        title: "Urgent Update",
                        message: "Kal Sunday ki wajah se order shaam ko jaldi 8:00 PM tak hi liye jayenge.",
                        priority: "urgent",
                        expiryDate: tomorrow.toISOString(),
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: "b2",
                        title: "Naya Product Available!",
                        message: "Humne premium Mozzarella Pizza Cheese add kiya hai. Abhi check karein!",
                        priority: "normal",
                        expiryDate: tomorrow.toISOString(),
                        createdAt: new Date().toISOString()
                    }
                ];
                mockStorage.set('broadcasts', initialBroadcasts);
            }

            // Initial Orders removed in Priority Mode production cleanup
        }
    };

    // Declarations for Firebase services (IIFE scope)
    let firestoreDb = null;
    let firebaseAuth = null;
    let firebaseStorage = null;

    try {
        if (typeof firebase !== 'undefined' && CONFIG.firebase && CONFIG.firebase.apiKey && CONFIG.firebase.apiKey.trim() !== "") {
            firebase.initializeApp(CONFIG.firebase);
            firestoreDb = firebase.firestore();
            firebaseAuth = firebase.auth();
            firebaseStorage = firebase.storage();
        }
    } catch (e) {
        console.error("Firebase initialization failed:", e);
    }

    // Initialize mock database if needed
    if (isMock) {
        mockStorage.init();
    }

    // --- UNIFIED DATABASE SERVICE METHODS ---
    return {
        isMockMode: () => isMock,

        // --- USER PROFILE LOOKUPS (Firebase Auth only) ---
        getUserByUid: async (uid) => {
            const userDoc = await firestoreDb.collection('users').doc(uid).get();
            if (!userDoc.exists) return null;
            return { uid: userDoc.id, ...userDoc.data() };
        },

        getUserByMobile: async (mobile) => {
            const snapshot = await firestoreDb.collection('users').where('mobile', '==', mobile).get();
            if (snapshot.empty) return null;
            if (snapshot.size > 1) {
                throw new Error("Data Integrity Error: इस Mobile Number से एक से अधिक Accounts रजिस्टर हैं। कृपया Admin से संपर्क करें।");
            }
            const doc = snapshot.docs[0];
            return { uid: doc.id, ...doc.data() };
        },

        createUserProfile: async (uid, profileData) => {
            const userData = {
                uid,
                ...profileData,
                role: profileData.role || "customer",
                status: profileData.status || "active",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await firestoreDb.collection('users').doc(uid).set(userData);
            return userData;
        },

        seedAdminIfNeeded: async () => {
            if (isMock) {
                const admins = mockStorage.get('admins') || [];
                if (admins.length === 0) {
                    admins.push({
                        uid: 'admin_9999999999',
                        mobile: '9999999999',
                        password: 'admin123',
                        role: 'admin',
                        ownerName: 'Administrator',
                        shopName: 'Deliverr Admin',
                        status: 'active',
                        createdAt: new Date().toISOString()
                    });
                    mockStorage.set('admins', admins);
                }
                return;
            }
            try {
                const snapshot = await firestoreDb.collection('admins').get();
                if (snapshot.empty) {
                    console.log("Seeding default admin to Firestore admins collection...");
                    await firestoreDb.collection('admins').doc('admin_9999999999').set({
                        uid: 'admin_9999999999',
                        mobile: '9999999999',
                        password: 'admin123',
                        role: 'admin',
                        ownerName: 'Administrator',
                        shopName: 'Deliverr Admin',
                        status: 'active',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (err) {
                console.error("Error seeding default admin:", err);
            }
        },

        getAdminByMobile: async (mobile) => {
            if (isMock) {
                const admins = mockStorage.get('admins') || [];
                const admin = admins.find(a => a.mobile === mobile);
                return admin || null;
            }
            const snapshot = await firestoreDb.collection('admins').where('mobile', '==', mobile).get();
            if (snapshot.empty) return null;
            const doc = snapshot.docs[0];
            return { uid: doc.id, ...doc.data() };
        },

        deleteUserDoc: async (uid) => {
            await firestoreDb.collection('users').doc(uid).delete();
        },

        // --- PRODUCTS ---
        getProducts: async () => {
            // Seed default admin in background
            db.seedAdminIfNeeded();

            if (isMock) {
                const rawProducts = mockStorage.get('products') || [];
                const grouped = {};
                rawProducts.forEach(p => {
                    const key = p.name.toLowerCase().trim();
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(p);
                });

                const filteredProducts = [];
                let hasChanges = false;
                for (const key of Object.keys(grouped)) {
                    const group = grouped[key];
                    if (group.length === 1) {
                        filteredProducts.push(group[0]);
                    } else {
                        group.sort((a, b) => {
                            const aVars = a.variants || [];
                            const bVars = b.variants || [];
                            const aHasSpecific = aVars.some(v => v.name !== 'Standard');
                            const bHasSpecific = bVars.some(v => v.name !== 'Standard');
                            if (aHasSpecific && !bHasSpecific) return -1;
                            if (!aHasSpecific && bHasSpecific) return 1;
                            return bVars.length - aVars.length;
                        });
                        filteredProducts.push(group[0]);
                        hasChanges = true;
                    }
                }
                if (hasChanges) {
                    mockStorage.set('products', filteredProducts);
                }
                return filteredProducts;
            } else {
                const snapshot = await firestoreDb.collection('products').get();
                if (snapshot.empty) {
                    console.log("Seeding default products to Firestore...");
                    const seeded = [];
                    for (const prod of defaultProducts) {
                        const docRef = await firestoreDb.collection('products').add({
                            ...prod,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        seeded.push({ id: docRef.id, ...prod });
                    }
                    return seeded;
                }
                
                const rawProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const grouped = {};
                rawProducts.forEach(p => {
                    const key = p.name.toLowerCase().trim();
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(p);
                });

                const filteredProducts = [];
                for (const key of Object.keys(grouped)) {
                    const group = grouped[key];
                    if (group.length === 1) {
                        filteredProducts.push(group[0]);
                    } else {
                        group.sort((a, b) => {
                            const aVars = a.variants || [];
                            const bVars = b.variants || [];
                            const aHasSpecific = aVars.some(v => v.name !== 'Standard');
                            const bHasSpecific = bVars.some(v => v.name !== 'Standard');
                            if (aHasSpecific && !bHasSpecific) return -1;
                            if (!aHasSpecific && bHasSpecific) return 1;
                            return bVars.length - aVars.length;
                        });
                        
                        const best = group[0];
                        filteredProducts.push(best);

                        // Delete legacy duplicates from Firestore in background
                        for (let i = 1; i < group.length; i++) {
                            const duplicate = group[i];
                            console.log(`Deleting duplicate legacy product from Firestore: ${duplicate.name} (${duplicate.id})`);
                            firestoreDb.collection('products').doc(duplicate.id).delete().catch(err => {
                                console.error("Error deleting duplicate:", err);
                            });
                        }
                    }
                }
                return filteredProducts;
            }
        },

        addProduct: async (productData) => {
            const fullProduct = {
                ...productData,
                variants: productData.variants || [
                    { name: "Standard", price: Number(productData.price) || 0, unit: productData.unit || "" }
                ]
            };
            if (isMock) {
                const products = mockStorage.get('products') || [];
                const newProduct = {
                    id: "p" + (products.length + 1) + "_" + Math.random().toString(36).substr(2, 5),
                    ...fullProduct,
                    status: "active",
                    createdAt: new Date().toISOString()
                };
                products.push(newProduct);
                mockStorage.set('products', products);
                return newProduct;
            } else {
                const docRef = await firestoreDb.collection('products').add({
                    ...fullProduct,
                    status: "active",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return { id: docRef.id, ...fullProduct };
            }
        },

        updateProduct: async (productId, updateData) => {
            const fullUpdate = { ...updateData };
            if (updateData.price || updateData.unit) {
                fullUpdate.variants = updateData.variants || [
                    { name: "Standard", price: Number(updateData.price) || 0, unit: updateData.unit || "" }
                ];
            }
            if (isMock) {
                const products = mockStorage.get('products') || [];
                const idx = products.findIndex(p => p.id === productId);
                if (idx !== -1) {
                    products[idx] = { ...products[idx], ...fullUpdate };
                    mockStorage.set('products', products);
                }
                return products[idx];
            } else {
                await firestoreDb.collection('products').doc(productId).update(fullUpdate);
                return { id: productId, ...fullUpdate };
            }
        },

        deleteProduct: async (productId) => {
            if (isMock) {
                let products = mockStorage.get('products') || [];
                products = products.filter(p => p.id !== productId);
                mockStorage.set('products', products);
                return true;
            } else {
                await firestoreDb.collection('products').doc(productId).delete();
                return true;
            }
        },

        // --- ORDERS ---
        getOrders: async () => {
            if (isMock) {
                return mockStorage.get('orders') || [];
            } else {
                const snapshot = await firestoreDb.collection('orders').orderBy('createdAt', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
        },

        subscribeToOrders: (callback) => {
            if (isMock) {
                return () => {};
            } else {
                return firestoreDb.collection('orders').orderBy('createdAt', 'desc')
                    .onSnapshot(snapshot => {
                        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        callback(orders);
                    }, err => console.error("Orders subscription error:", err));
            }
        },

        getCustomerOrders: async (customerId) => {
            if (isMock) {
                const orders = mockStorage.get('orders') || [];
                return orders.filter(o => o.customerId === customerId);
            } else {
                const snapshot = await firestoreDb.collection('orders')
                    .where('customerId', '==', customerId)
                    .get();
                const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                orders.sort((a, b) => {
                    const tA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : 0;
                    const tB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : 0;
                    return tB - tA;
                });
                return orders;
            }
        },

        createOrder: async (orderData) => {
            const shortId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
            const orderWithId = {
                id: shortId,
                ...orderData,
                deliveryStatus: "pending",
                createdAt: isMock ? new Date().toISOString() : firebase.firestore.FieldValue.serverTimestamp()
            };

            if (isMock) {
                const orders = mockStorage.get('orders') || [];
                orders.unshift(orderWithId);
                mockStorage.set('orders', orders);
                return orderWithId;
            } else {
                await firestoreDb.collection('orders').doc(shortId).set(orderWithId);
                return orderWithId;
            }
        },

        updateOrderStatus: async (orderId, updateData) => {
            if (isMock) {
                const orders = mockStorage.get('orders') || [];
                const idx = orders.findIndex(o => o.id === orderId);
                if (idx !== -1) {
                    orders[idx] = { ...orders[idx], ...updateData };
                    mockStorage.set('orders', orders);
                }
                return orders[idx];
            } else {
                await firestoreDb.collection('orders').doc(orderId).update(updateData);
                return { id: orderId, ...updateData };
            }
        },

        // --- CUSTOMERS ---
        getCustomers: async () => {
            if (isMock) {
                const users = mockStorage.get('users') || [];
                return users.filter(u => u.role === "customer");
            } else {
                const snapshot = await firestoreDb.collection('users').where('role', '==', 'customer').get();
                return snapshot.docs.map(doc => doc.data());
            }
        },

        updateCustomerStatus: async (customerUid, status) => {
            if (isMock) {
                const users = mockStorage.get('users') || [];
                const idx = users.findIndex(u => u.uid === customerUid);
                if (idx !== -1) {
                    users[idx].status = status;
                    mockStorage.set('users', users);
                }
                return true;
            } else {
                await firestoreDb.collection('users').doc(customerUid).update({ status });
                return true;
            }
        },

        // --- BROADCASTS ---
        getBroadcasts: async () => {
            if (isMock) {
                return mockStorage.get('broadcasts') || [];
            } else {
                const snapshot = await firestoreDb.collection('broadcasts').orderBy('createdAt', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
        },

        addBroadcast: async (broadcastData) => {
            if (isMock) {
                const broadcasts = mockStorage.get('broadcasts') || [];
                const newBroadcast = {
                    id: "b" + (broadcasts.length + 1) + "_" + Math.random().toString(36).substr(2, 5),
                    ...broadcastData,
                    createdAt: new Date().toISOString()
                };
                broadcasts.unshift(newBroadcast);
                mockStorage.set('broadcasts', broadcasts);
                return newBroadcast;
            } else {
                const docRef = await firestoreDb.collection('broadcasts').add({
                    ...broadcastData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return { id: docRef.id, ...broadcastData };
            }
        },

        deleteBroadcast: async (broadcastId) => {
            if (isMock) {
                let broadcasts = mockStorage.get('broadcasts') || [];
                broadcasts = broadcasts.filter(b => b.id !== broadcastId);
                mockStorage.set('broadcasts', broadcasts);
                return true;
            } else {
                await firestoreDb.collection('broadcasts').doc(broadcastId).delete();
                return true;
            }
        },

        // --- SETTINGS ---
        getSettings: async () => {
            const defaultSettings = { 
                orderClosingTime: CONFIG.defaultClosingTime,
                serviceAreas: [{ pincode: "121103", name: "Hathin", status: "active" }]
            };
            if (isMock) {
                const settings = mockStorage.get('settings');
                if (!settings) {
                    mockStorage.set('settings', defaultSettings);
                    return defaultSettings;
                }
                if (!settings.serviceAreas) {
                    settings.serviceAreas = defaultSettings.serviceAreas;
                    mockStorage.set('settings', settings);
                }
                return settings;
            } else {
                const doc = await firestoreDb.collection('settings').doc('global').get();
                if (doc.exists) {
                    const data = doc.data();
                    if (!data.serviceAreas) {
                        data.serviceAreas = defaultSettings.serviceAreas;
                        await firestoreDb.collection('settings').doc('global').update({ serviceAreas: data.serviceAreas });
                    }
                    return data;
                } else {
                    await firestoreDb.collection('settings').doc('global').set(defaultSettings);
                    return defaultSettings;
                }
            }
        },

        updateSettings: async (settingsData) => {
            if (isMock) {
                const current = mockStorage.get('settings') || {};
                const updated = { ...current, ...settingsData };
                mockStorage.set('settings', updated);
                return updated;
            } else {
                await firestoreDb.collection('settings').doc('global').update(settingsData);
                return settingsData;
            }
        }
    };
})();

// Export db if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = db;
}

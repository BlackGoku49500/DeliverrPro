// Deliverr - Customer Dashboard & Order Controller

const customer = (() => {
    let productsList = [];
    let cart = JSON.parse(localStorage.getItem('deliverr_customer_cart')) || {}; // Format: { cartKey: { productId, variantName, productName, price, unit, quantity } }
    let lastOrder = null;
    let regularProducts = [];
    let customerOrders = [];
    let cachedProducts = null; // Products in-memory cache
    let selectedVariants = {}; // Format: { productId: "variantName" }

    // --- RENDER CATALOG ---
    async function loadCatalog(searchQuery = "", categoryFilter = "") {
        try {
            if (!cachedProducts) {
                cachedProducts = await db.getProducts();
            }
            // Filter out inactive products
            productsList = cachedProducts.filter(p => p.status === 'active');
            
            let filtered = productsList;

            // Apply Search
            if (searchQuery.trim() !== "") {
                const q = searchQuery.toLowerCase();
                filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
            }

            // Apply Category Filter
            if (categoryFilter !== "") {
                filtered = filtered.filter(p => p.category === categoryFilter);
            }

            renderCatalogList(filtered);
        } catch (error) {
            console.error("Error loading catalog: ", error);
        }
    }

    function renderCatalogList(products) {
        const grid = document.getElementById('catalog-grid');
        if (!grid) return;

        if (products.length === 0) {
            grid.innerHTML = `<div class="no-data">कोई सामान नहीं मिला। 🔍</div>`;
            return;
        }

        grid.innerHTML = products.map(p => {
            // Default selected variant
            const selectedVarName = selectedVariants[p.id] || p.variants[0].name;
            const variant = p.variants.find(v => v.name === selectedVarName) || p.variants[0];
            
            // Cart item key: productId_variantName
            const cartKey = `${p.id}_${variant.name}`;
            const cartItem = cart[cartKey];
            const qty = cartItem ? cartItem.quantity : 0;
            const inCartClass = qty > 0 ? "in-cart" : "";

            // Render variant selection ONLY if more than 1 variant exists
            const variantSelector = p.variants.length > 1
                ? `<select class="variant-select" style="width: 100%; margin: 8px 0; padding: 6px; border-radius: 6px; border: 1px solid var(--border-color); font-family: inherit; font-size: 0.9rem;" onchange="customer.changeVariant('${p.id}', this.value)">
                    ${p.variants.map(v => `<option value="${v.name}" ${v.name === selectedVarName ? 'selected' : ''}>${v.name} (₹${v.price}/${v.unit})</option>`).join('')}
                   </select>`
                : `<div class="variant-single-label" style="font-size: 0.85rem; color: var(--text-muted); margin: 6px 0;">Option: ${variant.name}</div>`;

            return `
                <div class="product-card ${inCartClass}" id="prod-card-${p.id}">
                    <div class="product-info">
                        <span class="product-cat">${p.category}</span>
                        <h3 class="product-title">${p.name}</h3>
                        <p class="product-unit" id="unit-val-${p.id}">Packing: ${variant.unit}</p>
                        
                        ${variantSelector}

                        <div class="product-price-row" style="margin-top: 10px;">
                            <span class="product-price" id="price-val-${p.id}">₹${variant.price}</span>
                            
                            <!-- Large +/- Quantity Selector -->
                            <div class="qty-selector">
                                <button class="qty-btn minus" onclick="customer.updateCartQty('${p.id}', -1)">
                                    <i class="fa-solid fa-minus"></i>
                                </button>
                                <span class="qty-number" id="qty-val-${p.id}">${qty}</span>
                                <button class="qty-btn plus" onclick="customer.updateCartQty('${p.id}', 1)">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- CART OPERATIONS ---
    function changeVariant(productId, variantName) {
        selectedVariants[productId] = variantName;
        const prod = productsList.find(p => p.id === productId);
        if (!prod) return;

        const variant = prod.variants.find(v => v.name === variantName) || prod.variants[0];

        // Update price and unit display on card
        const priceEl = document.getElementById(`price-val-${productId}`);
        const unitEl = document.getElementById(`unit-val-${productId}`);
        if (priceEl) priceEl.textContent = `₹${variant.price}`;
        if (unitEl) unitEl.textContent = `Packing: ${variant.unit}`;

        // Update qty select state for this variant
        const cartKey = `${productId}_${variant.name}`;
        const qtyVal = document.getElementById(`qty-val-${productId}`);
        const qty = cart[cartKey] ? cart[cartKey].quantity : 0;
        if (qtyVal) qtyVal.textContent = qty;

        const card = document.getElementById(`prod-card-${productId}`);
        if (card) {
            if (qty > 0) card.classList.add('in-cart');
            else card.classList.remove('in-cart');
        }
    }

    function updateCartQty(productId, change) {
        const prod = productsList.find(p => p.id === productId);
        if (!prod) return;

        const selectedVarName = selectedVariants[productId] || prod.variants[0].name;
        const variant = prod.variants.find(v => v.name === selectedVarName) || prod.variants[0];

        const cartKey = `${productId}_${variant.name}`;

        if (!cart[cartKey]) {
            if (change > 0) {
                cart[cartKey] = {
                    productId: productId,
                    variantName: variant.name,
                    productName: prod.name,
                    category: prod.category,
                    imageUrl: prod.imageUrl,
                    price: variant.price,
                    unit: variant.unit,
                    quantity: change
                };
            }
        } else {
            cart[cartKey].quantity += change;
            if (cart[cartKey].quantity <= 0) {
                delete cart[cartKey];
            }
        }

        const qtyVal = document.getElementById(`qty-val-${productId}`);
        const qty = cart[cartKey] ? cart[cartKey].quantity : 0;
        if (qtyVal) qtyVal.textContent = qty;

        const card = document.getElementById(`prod-card-${productId}`);
        if (card) {
            if (qty > 0) card.classList.add('in-cart');
            else card.classList.remove('in-cart');
        }

        updateCartSummary();
    }

    function updateCartKeyQty(cartKey, change) {
        if (!cart[cartKey]) return;

        cart[cartKey].quantity += change;
        if (cart[cartKey].quantity <= 0) {
            delete cart[cartKey];
        }

        // Reload current catalog to sync displays
        loadCatalog(
            document.getElementById('catalog-search').value,
            document.getElementById('catalog-category').value
        );

        updateCartSummary();
    }

    function updateCartSummary() {
        let totalQty = 0;
        let totalAmt = 0;

        Object.keys(cart).forEach(key => {
            totalQty += cart[key].quantity;
            totalAmt += cart[key].quantity * cart[key].price;
        });

        // Persist cart to localStorage
        localStorage.setItem('deliverr_customer_cart', JSON.stringify(cart));

        // Update Floating Cart Bar & Cart Slide-in Modal
        const cartCountBadge = document.getElementById('cart-count-badge');
        const cartTotalText = document.getElementById('cart-total-text');
        const floatingCart = document.getElementById('floating-cart-bar');

        if (cartCountBadge) cartCountBadge.textContent = totalQty;
        if (cartTotalText) cartTotalText.textContent = `₹${totalAmt}`;

        if (floatingCart) {
            if (totalQty > 0) {
                floatingCart.classList.add('active');
            } else {
                floatingCart.classList.remove('active');
            }
        }

        // Render Slide-out Cart Details
        renderCartDetails(totalQty, totalAmt);
    }

    function renderCartDetails(totalQty, totalAmt) {
        const cartItemsContainer = document.getElementById('cart-items-list');
        const cartTotalModal = document.getElementById('cart-total-modal');
        const cartCountModal = document.getElementById('cart-count-modal');

        if (cartTotalModal) cartTotalModal.textContent = `₹${totalAmt}`;
        if (cartCountModal) cartCountModal.textContent = `${totalQty} Qty`;

        if (!cartItemsContainer) return;

        if (Object.keys(cart).length === 0) {
            cartItemsContainer.innerHTML = `<div class="empty-cart-msg">आपका Cart अभी खाली है। 🛒</div>`;
            return;
        }

        cartItemsContainer.innerHTML = Object.keys(cart).map(key => {
            const item = cart[key];
            return `
                <div class="cart-item">
                    <div class="cart-item-details">
                        <h4>${item.productName}</h4>
                        <p class="form-subtext">Option: ${item.variantName} | Packing: ${item.unit}</p>
                        <span class="product-price">₹${item.price}</span>
                    </div>
                    <div class="qty-selector">
                        <button class="qty-btn minus" onclick="customer.updateCartKeyQty('${key}', -1)">
                            <i class="fa-solid fa-minus"></i>
                        </button>
                        <span class="qty-number">${item.quantity}</span>
                        <button class="qty-btn plus" onclick="customer.updateCartKeyQty('${key}', 1)">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- REPEAT YESTERDAY'S ORDER ---
    async function repeatYesterdayOrder() {
        if (!lastOrder) {
            app.showNotification("Error 📍", "आपका कोई पुराना Order नहीं मिला।", "warning");
            return;
        }

        try {
            // Load catalog first to check stock / availability
            const allProducts = await db.getProducts();
            const activeProductsMap = new Map(
                allProducts.filter(p => p.status === 'active').map(p => [p.id, p])
            );

            let addedCount = 0;
            let unavailableItems = [];

            // Add last order items to cart
            lastOrder.items.forEach(item => {
                const pId = item.productId;
                const vName = item.variantName || "Standard";
                const currentProduct = activeProductsMap.get(pId);
                
                if (currentProduct) {
                    const variant = currentProduct.variants.find(v => v.name === vName) || currentProduct.variants[0];
                    const cartKey = `${pId}_${variant.name}`;
                    cart[cartKey] = {
                        productId: pId,
                        variantName: variant.name,
                        productName: currentProduct.name,
                        category: currentProduct.category,
                        imageUrl: currentProduct.imageUrl,
                        price: variant.price,
                        unit: variant.unit,
                        quantity: item.quantity
                    };
                    addedCount++;
                } else {
                    unavailableItems.push(item.name);
                }
            });

            // Update UI
            updateCartSummary();
            // Refresh catalog grid
            loadCatalog(
                document.getElementById('catalog-search').value,
                document.getElementById('catalog-category').value
            );

            if (addedCount > 0) {
                if (unavailableItems.length > 0) {
                    app.showNotification(
                        "Order Add हुआ! ⚡",
                        `पुराना Order Cart में Add हो गया है। लेकिन ये Products अभी Stock में नहीं हैं: ${unavailableItems.join(', ')}`,
                        "warning"
                    );
                } else {
                    app.showNotification("Order Add हुआ! ⚡", "पुराना Order Cart में Add हो गया है।", "success");
                }
                // Open Cart Drawer
                const cartModal = document.getElementById('cart-modal');
                if (cartModal) cartModal.classList.add('active');
            }
        } catch (e) {
            console.error("Repeat order error:", e);
            app.showNotification("Error ❌", "पुराना Order Load करने में समस्या हुई।", "error");
        }
    }

    // --- QUICK ADD PRODUCT (For Regular Products list) ---
    function quickAddProduct(productId, variantName) {
        const prod = productsList.find(p => p.id === productId);
        if (!prod) return;
        
        const vName = variantName || prod.variants[0].name;
        selectedVariants[productId] = vName;
        updateCartQty(productId, 1);
        
        // Highlight in catalog grid
        loadCatalog(
            document.getElementById('catalog-search').value,
            document.getElementById('catalog-category').value
        );
        
        app.showNotification("Add हुआ! 🛒", `${prod.name} (${vName}) Cart में Add हो गया है।`, "success");
    }

    // --- CHECKOUT ---
    async function checkout() {
        const user = auth.getCurrentUser();
        if (!user) {
            app.showNotification("Login करें ❌", "आपका Session Expire हो गया है।", "error");
            window.location.hash = '#login';
            return;
        }

        if (Object.keys(cart).length === 0) {
            app.showNotification("Cart खाली 🛒", "Order Submit करने के लिए Items Add करें।", "warning");
            return;
        }

        const isClosed = app.checkIfOrderClosed();
        if (isClosed) {
            app.showNotification("Window Closed 🔒", "आज के Order बंद हो चुके हैं।", "error");
            return;
        }

        proceedToPayment();
    }

    async function proceedToPayment() {
        const checkoutBtn = document.getElementById('btn-checkout-cart');
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Payment हो रहा है...';
        }

        const user = auth.getCurrentUser();
        let totalQty = 0;
        let totalAmt = 0;
        const items = [];

        Object.keys(cart).forEach(key => {
            const item = cart[key];
            totalQty += item.quantity;
            totalAmt += item.quantity * item.price;
            items.push({
                productId: item.productId,
                variantName: item.variantName,
                name: `${item.productName} (${item.variantName})`,
                unit: item.unit,
                price: item.price,
                quantity: item.quantity
            });
        });

        const orderDate = new Date().toISOString().split('T')[0];

        const orderData = {
            shopName: user.shopName,
            ownerName: user.ownerName,
            customerMobile: user.mobile,
            village: user.village || user.villageArea || "",
            pincode: user.pincode || "",
            landmark: user.landmark || "",
            items: items,
            totalQuantity: totalQty,
            totalAmount: totalAmt,
            orderDate: orderDate
        };

        if (typeof Razorpay === 'undefined') {
            app.showNotification("Internet Error ❌", "Internet चालू करके दोबारा कोशिश करें।", "error");
            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = 'Order Submit करें (Payment) <i class="fa-solid fa-arrow-right"></i>';
            }
            return;
        }

        try {
            let orderId = null;

            // Only call Firebase Functions if Firebase is the active database provider
            if (CONFIG && CONFIG.databaseProvider === 'firebase' && typeof firebase !== 'undefined' && firebase.functions) {
                try {
                    const createRazorpayOrderFn = firebase.functions().httpsCallable('createRazorpayOrder');
                    const orderRes = await createRazorpayOrderFn({ amount: totalAmt });
                    orderId = orderRes.data.orderId;
                } catch (fnErr) {
                    console.warn("Firebase Functions order creation skipped or failed:", fnErr);
                }
            }

            const options = {
                "key": CONFIG.razorpayKeyId,
                "amount": Math.round(totalAmt * 100),
                "currency": "INR",
                "name": "DeliverrPro B2B",
                "description": "Fast Food Supply Order",
                "image": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80",
                "handler": async function (response) {
                    try {
                        if (checkoutBtn) {
                            checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Order Save ho raha hai...';
                        }
                        
                        let savedOrder = null;

                        // If Firebase provider is active and Functions exist, verify via backend
                        if (CONFIG && CONFIG.databaseProvider === 'firebase' && typeof firebase !== 'undefined' && firebase.functions && orderId) {
                            const verifyAndSaveOrderFn = firebase.functions().httpsCallable('verifyAndSaveOrder');
                            const verifyRes = await verifyAndSaveOrderFn({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                orderData: orderData
                            });
                            if (verifyRes.data && verifyRes.data.success) {
                                savedOrder = verifyRes.data.order;
                            }
                        } else {
                            // Supabase / Direct Database Save
                            savedOrder = await db.createOrder({
                                ...orderData,
                                paymentStatus: "paid",
                                paymentId: response.razorpay_payment_id || ("pay_" + Math.random().toString(36).substr(2, 9))
                            });
                        }

                        if (savedOrder) {
                            cart = {};
                            localStorage.removeItem('deliverr_customer_cart');
                            updateCartSummary();
                            await loadDashboardData();
                            
                            const cartModal = document.getElementById('cart-modal');
                            if (cartModal) cartModal.classList.remove('active');
                            
                            showSuccessInvoice(savedOrder);
                        } else {
                            throw new Error("Order creation failed");
                        }
                    } catch (err) {
                        console.error(err);
                        app.showNotification("Payment Failed ❌", "Payment पूरा नहीं हुआ। दोबारा try करें।", "error");
                        if (checkoutBtn) {
                            checkoutBtn.disabled = false;
                            checkoutBtn.innerHTML = 'Order Submit करें (Payment) <i class="fa-solid fa-arrow-right"></i>';
                        }
                    }
                },
                "prefill": {
                    "name": user.ownerName,
                    "contact": user.mobile
                },
                "theme": {
                    "color": "#FF4B2B"
                },
                "modal": {
                    "ondismiss": function() {
                        app.showNotification("Payment Cancelled ❌", "आपने Payment Cancel कर दी।", "warning");
                        if (checkoutBtn) {
                            checkoutBtn.disabled = false;
                            checkoutBtn.innerHTML = 'Order Submit करें (Payment) <i class="fa-solid fa-arrow-right"></i>';
                        }
                    }
                }
            };

            const rzp = new Razorpay(options);
            
            rzp.on('payment.failed', function (response) {
                console.error("Payment failed event:", response.error);
                app.showNotification("Payment Failed ❌", "Payment पूरा नहीं हुआ। दोबारा try करें।", "error");
                if (checkoutBtn) {
                    checkoutBtn.disabled = false;
                    checkoutBtn.innerHTML = 'Order Submit करें (Payment) <i class="fa-solid fa-arrow-right"></i>';
                }
            });

            rzp.open();
        } catch (err) {
            console.error("Payment initialization error:", err);
            app.showNotification("Payment Error ❌", "Payment शुरू नहीं हो पाई। दोबारा try करें।", "error");
            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = 'Order Submit करें (Payment) <i class="fa-solid fa-arrow-right"></i>';
            }
        }
    }

    // --- SUCCESS INVOICE MODAL (HINDI) ---
    function showSuccessInvoice(order) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'invoice-modal';
        modal.innerHTML = `
            <div class="modal-card invoice-card" style="font-family: 'Poppins', 'Noto Sans Devanagari', sans-serif;">
                <button class="modal-close-btn" id="close-invoice-btn">&times;</button>
                <div class="text-center" style="margin-bottom: 20px;">
                    <div class="success-check-icon"><i class="fa-solid fa-circle-check"></i></div>
                    <h2 style="color: var(--success-color); font-family: 'Noto Sans Devanagari', sans-serif;">Order सफल हुआ! 🎉</h2>
                    <p class="form-subtext">आपका Order रिकॉर्ड कर लिया गया है।</p>
                </div>

                <div class="invoice-details" id="print-area" style="font-family: monospace;">
                    <div class="invoice-header">
                        <h3>DELIVERRPRO INVOICE</h3>
                        <p>Order Number: <strong>${order.id}</strong></p>
                        <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <hr class="divider">
                    <div class="invoice-address" style="text-align: left;">
                        <p><strong>Shop:</strong> ${order.shopName} (${order.ownerName})</p>
                        <p><strong>Address:</strong> ${order.village || order.villageArea || ""}${order.pincode ? ' (PIN: ' + order.pincode + ')' : ''} ${order.landmark ? '(' + order.landmark + ')' : ''}</p>
                        <p><strong>Mobile:</strong> ${order.customerMobile}</p>
                    </div>
                    <hr class="divider">
                    <div class="invoice-items">
                        <table style="width: 100%; text-align: left; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border-color); font-weight: 600;">
                                    <th style="padding: 8px 0;">Item Name</th>
                                    <th style="padding: 8px 0; text-align: center;">Qty</th>
                                    <th style="padding: 8px 0; text-align: right;">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items.map(item => `
                                    <tr style="border-bottom: 1px dotted var(--border-color);">
                                        <td style="padding: 8px 0;">${item.name}</td>
                                        <td style="padding: 8px 0; text-align: center;">${item.quantity}</td>
                                        <td style="padding: 8px 0; text-align: right;">₹${item.price * item.quantity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <hr class="divider">
                    <div class="invoice-total" style="text-align: right;">
                        <p>Total Qty: <strong>${order.totalQuantity} items</strong></p>
                        <h3 style="font-family: 'Poppins', sans-serif;">Total Amount: <span class="text-gradient">₹${order.totalAmount}</span></h3>
                        <p style="font-size: 0.85rem; color: var(--success-color); font-weight: 600;">Online Payment Successful (ID: ${order.paymentId.substr(0, 12)}...)</p>
                    </div>
                </div>

                <div class="modal-actions" style="display: flex; gap: 15px; margin-top: 25px;">
                    <button class="btn btn-primary" style="flex: 1;" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Invoice</button>
                    <button class="btn" style="flex: 1; background: var(--border-color); color: var(--dark-color);" id="btn-close-invoice">Done</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        document.getElementById('close-invoice-btn').addEventListener('click', closeModal);
        document.getElementById('btn-close-invoice').addEventListener('click', closeModal);
    }

    // --- LOAD DASHBOARD DATA ---
    async function loadDashboardData() {
        const user = auth.getCurrentUser();
        if (!user) return;

        try {
            // Fetch customer specific orders securely
            customerOrders = await db.getCustomerOrders(user.uid);

            document.getElementById('cust-welcome-name').textContent = user.ownerName;
            document.getElementById('cust-shop-name').textContent = user.shopName;

            // Check if today's order is already placed
            const todayStr = new Date().toISOString().split('T')[0];
            const todayOrder = customerOrders.find(o => o.orderDate === todayStr && o.deliveryStatus !== 'cancelled');

            const statusCard = document.getElementById('today-status-card');
            if (statusCard) {
                if (todayOrder) {
                    statusCard.className = "status-banner status-success";
                    statusCard.innerHTML = `
                        <div class="status-icon"><i class="fa-solid fa-circle-check"></i></div>
                        <div>
                            <h4 style="font-family: 'Noto Sans Devanagari', sans-serif;">आपका आज का Order मिल चुका है! 🎉</h4>
                            <p>Order Number: <strong>${todayOrder.id}</strong> | Status: <strong>${translateStatus(todayOrder.deliveryStatus)}</strong></p>
                        </div>
                    `;
                } else {
                    const isClosed = app.checkIfOrderClosed();
                    if (isClosed) {
                        statusCard.className = "status-banner status-danger";
                        statusCard.innerHTML = `
                            <div class="status-icon"><i class="fa-solid fa-lock"></i></div>
                            <div>
                                <h4 style="font-family: 'Noto Sans Devanagari', sans-serif;">आज के Order बंद हो चुके हैं। 🔒</h4>
                                <p>कल सुबह नए Order की Window खुलेगी।</p>
                            </div>
                        `;
                    } else {
                        statusCard.className = "status-banner status-warning";
                        statusCard.innerHTML = `
                            <div class="status-icon"><i class="fa-solid fa-clock"></i></div>
                            <div>
                                <h4 style="font-family: 'Noto Sans Devanagari', sans-serif;">आपने आज का Order नहीं किया है! ⚠️</h4>
                                <p>कृपया समय समाप्त होने से पहले अपना Order Submit करें।</p>
                            </div>
                        `;
                    }
                }
            }

            // Fetch Last Successful Order
            lastOrder = customerOrders.find(o => o.deliveryStatus !== 'cancelled');
            const repeatBtn = document.getElementById('btn-repeat-order');
            if (repeatBtn) {
                if (!lastOrder) {
                    repeatBtn.classList.add('disabled');
                } else {
                    repeatBtn.classList.remove('disabled');
                }
            }

            // Identify "Regular Products"
            const productFreq = {};
            customerOrders.forEach(o => {
                if (o.deliveryStatus !== 'cancelled') {
                    o.items.forEach(item => {
                        productFreq[item.productId] = (productFreq[item.productId] || 0) + 1;
                    });
                }
            });

            const sortedIds = Object.keys(productFreq).sort((a, b) => productFreq[b] - productFreq[a]);
            const allProducts = await db.getProducts();
            const activeProductsMap = new Map(allProducts.filter(p => p.status === 'active').map(p => [p.id, p]));

            regularProducts = sortedIds
                .map(id => activeProductsMap.get(id))
                .filter(p => p !== undefined)
                .slice(0, 4);

            renderRegularProducts();
            renderOrderHistory();
            updateCartSummary(); // Restore cart visual state and badges on load

        } catch (error) {
            console.error("Error loading customer dashboard data: ", error);
        }
    }

    function renderRegularProducts() {
        const container = document.getElementById('regular-products-list');
        if (!container) return;

        if (regularProducts.length === 0) {
            container.innerHTML = `<p class="form-subtext">आपने अभी तक कोई Order नहीं किया है।</p>`;
            return;
        }

        container.innerHTML = regularProducts.map(p => {
            const firstVar = p.variants[0];
            return `
                <button class="btn btn-secondary regular-prod-btn" onclick="customer.quickAddProduct('${p.id}', '${firstVar.name}')">
                    <i class="fa-solid fa-plus"></i> ${p.name} (${firstVar.name})
                </button>
            `;
        }).join('');
    }

    function renderOrderHistory() {
        const list = document.getElementById('order-history-list');
        if (!list) return;

        if (customerOrders.length === 0) {
            list.innerHTML = `<div class="no-data">आपका कोई पुराना Order History नहीं है।</div>`;
            return;
        }

        list.innerHTML = customerOrders.map(o => {
            const formattedDate = new Date(o.createdAt).toLocaleDateString();
            const statusClass = `status-badge badge-${o.deliveryStatus}`;
            
            return `
                <div class="history-card">
                    <div class="history-header">
                        <div>
                            <h4>Order Number: ${o.id}</h4>
                            <span class="history-date">${formattedDate}</span>
                        </div>
                        <span class="${statusClass}">${translateStatus(o.deliveryStatus)}</span>
                    </div>
                    <div class="history-body">
                        <p class="history-items-summary">
                            ${o.items.map(item => `${item.name} (x${item.quantity})`).join(', ')}
                        </p>
                        <div class="history-footer">
                            <span>Total: <strong>₹${o.totalAmount}</strong></span>
                            <span class="payment-paid-badge"><i class="fa-solid fa-circle-check"></i> Paid</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Translate status to Hindi Devanagari
    function translateStatus(status) {
        switch(status) {
            case 'pending': return 'पहुंचने वाला है (Pending)';
            case 'accepted': return 'स्वीकार किया गया (Accepted)';
            case 'preparing': return 'पैक हो रहा है (Preparing)';
            case 'out_for_delivery': return 'रास्ते में है 🏍️ (Out for Delivery)';
            case 'delivered': return 'सामान मिल गया ✅ (Delivered)';
            case 'cancelled': return 'कैंसिल हो गया ❌ (Cancelled)';
            default: return status;
        }
    }

    function showInvoiceById(orderId) {
        const order = customerOrders.find(o => o.id === orderId);
        if (order) {
            showSuccessInvoice(order);
        } else {
            app.showNotification("Error ❌", "Order Invoice नहीं मिली।", "error");
        }
    }

    return {
        loadCatalog: loadCatalog,
        updateCartQty: updateCartQty,
        updateCartKeyQty: updateCartKeyQty,
        changeVariant: changeVariant,
        updateCartSummary: updateCartSummary,
        repeatYesterdayOrder: repeatYesterdayOrder,
        checkout: checkout,
        quickAddProduct: quickAddProduct,
        loadDashboardData: loadDashboardData,
        showInvoiceById: showInvoiceById,
        getCart: () => cart,
        clearCart: () => {
            cart = {};
            localStorage.removeItem('deliverr_customer_cart');
            updateCartSummary();
        }
    };
})();

// Export customer if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = customer;
}

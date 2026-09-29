// Deliverr - Admin Dashboard & Operations Controller

const admin = (() => {
    let ordersList = [];
    let customersList = [];
    let productsList = [];
    let broadcastsList = [];
    let unsubscribeOrders = null;

    // --- INIT ADMIN DATA ---
    async function initAdmin() {
        try {
            await loadAllData();
            renderDashboardStats();
            renderOrdersTable();
            renderDeliveryList();
            renderProcurementSummary();
            renderInventoryList();
            renderCustomersList();
            renderBroadcastsList();
            await loadServiceAreasSettings();

            // Set up real-time listener for orders (Ensuring only one active listener exists)
            if (unsubscribeOrders) {
                unsubscribeOrders();
                unsubscribeOrders = null;
            }

            unsubscribeOrders = db.subscribeToOrders((updatedOrders) => {
                ordersList = updatedOrders;
                renderDashboardStats();
                renderOrdersTable();
                renderDeliveryList();
                renderProcurementSummary();
            });
        } catch (error) {
            console.error("Error initializing admin panel: ", error);
        }
    }

    async function loadAllData() {
        ordersList = await db.getOrders();
        customersList = await db.getCustomers();
        productsList = await db.getProducts();
        broadcastsList = await db.getBroadcasts();
    }

    // --- RENDER STATS ---
    function renderDashboardStats() {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayOrders = ordersList.filter(o => o.orderDate === todayStr && o.deliveryStatus !== 'cancelled');
        
        const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const pendingCount = ordersList.filter(o => ['pending', 'accepted', 'preparing', 'out_for_delivery'].includes(o.deliveryStatus)).length;
        const completedCount = ordersList.filter(o => o.deliveryStatus === 'delivered').length;

        document.getElementById('stat-today-orders').textContent = todayOrders.length;
        document.getElementById('stat-today-revenue').textContent = `₹${todayRevenue}`;
        document.getElementById('stat-pending-orders').textContent = pendingCount;
        document.getElementById('stat-completed-orders').textContent = completedCount;
        document.getElementById('stat-total-customers').textContent = customersList.length;
        document.getElementById('stat-total-products').textContent = productsList.length;
    }

    // --- ORDER LIST & STATUS UPDATES ---
    function renderOrdersTable() {
        const container = document.getElementById('admin-orders-list');
        if (!container) return;

        if (ordersList.length === 0) {
            container.innerHTML = `<div class="no-data">अभी कोई Order नहीं मिला। 📋</div>`;
            return;
        }

        container.innerHTML = ordersList.map(o => {
            const date = new Date(o.createdAt).toLocaleString();
            const statusClass = `status-badge badge-${o.deliveryStatus}`;
            
            return `
                <div class="admin-order-card" id="admin-order-${o.id}">
                    <div class="order-card-header">
                        <div>
                            <h3>Order: ${o.id}</h3>
                            <p class="order-time">${date}</p>
                        </div>
                        <span class="${statusClass}">${translateStatus(o.deliveryStatus)}</span>
                    </div>
                    <div class="order-card-body">
                        <p><strong>Shop:</strong> ${o.shopName} (${o.ownerName})</p>
                        <p><strong>Address:</strong> ${o.village || o.villageArea || ""}${o.pincode ? ', PIN: ' + o.pincode : ''}${o.area ? ', ' + o.area : ''} ${o.landmark ? '(' + o.landmark + ')' : ''}</p>
                        <p><strong>Mobile:</strong> ${o.customerMobile}</p>
                        <div class="order-items-box">
                            <strong>Products List:</strong>
                            <ul>
                                ${o.items.map(item => `<li>${item.name} - <strong>${item.quantity}</strong> ${item.unit} (₹${item.price * item.quantity})</li>`).join('')}
                            </ul>
                        </div>
                        <div class="order-card-footer">
                            <span>Total Qty: <strong>${o.totalQuantity}</strong></span>
                            <span>Total Amount: <strong>₹${o.totalAmount}</strong></span>
                        </div>
                    </div>
                    <div class="order-card-actions">
                        ${renderActionButtons(o)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderActionButtons(order) {
        const s = order.deliveryStatus;
        if (s === 'delivered') return `<span style="color:var(--success-color); font-weight:600;"><i class="fa-solid fa-circle-check"></i> Deliver हो गया है</span>`;
        if (s === 'cancelled') return `<span style="color:var(--text-muted); font-weight:600;"><i class="fa-solid fa-ban"></i> Cancelled</span>`;

        let buttons = '';
        if (s === 'pending') {
            buttons += `<button class="btn btn-action btn-accept" onclick="admin.updateStatus('${order.id}', 'accepted')"><i class="fa-solid fa-check"></i> Accept</button>`;
        }
        if (s === 'accepted') {
            buttons += `<button class="btn btn-action btn-prepare" onclick="admin.updateStatus('${order.id}', 'preparing')"><i class="fa-solid fa-box"></i> Packing शुरू</button>`;
        }
        if (s === 'preparing') {
            buttons += `<button class="btn btn-action btn-out" onclick="admin.updateStatus('${order.id}', 'out_for_delivery')"><i class="fa-solid fa-motorcycle"></i> Out for Delivery</button>`;
        }
        if (s === 'out_for_delivery') {
            buttons += `<button class="btn btn-action btn-deliver" onclick="admin.updateStatus('${order.id}', 'delivered')"><i class="fa-solid fa-circle-check"></i> Deliver हो गया</button>`;
        }
        
        // Add cancel button for any active state
        buttons += `<button class="btn btn-action btn-cancel" onclick="admin.updateStatus('${order.id}', 'cancelled')"><i class="fa-solid fa-xmark"></i> Cancel</button>`;

        return buttons;
    }

    async function updateStatus(orderId, newStatus) {
        try {
            await db.updateOrderStatus(orderId, { deliveryStatus: newStatus });
            app.showNotification("Status Update हुआ! 🔄", `Order ${orderId} का Status Update हो गया है।`, "success");
            
            // Reload all and refresh dashboards
            await loadAllData();
            renderDashboardStats();
            renderOrdersTable();
            renderDeliveryList();
            renderProcurementSummary();
        } catch (error) {
            console.error("Error updating status: ", error);
        }
    }

    // --- TODAY'S DELIVERY LIST (Grouped by Village/Area) ---
    function renderDeliveryList() {
        const container = document.getElementById('delivery-list-container');
        if (!container) return;

        const todayStr = new Date().toISOString().split('T')[0];
        // Filter today's active orders
        const todayOrders = ordersList.filter(o => o.orderDate === todayStr && o.deliveryStatus !== 'cancelled');

        if (todayOrders.length === 0) {
            container.innerHTML = `<div class="no-data">आज Delivery के लिए कोई Order नहीं है। 🚚</div>`;
            return;
        }

        // Group by Village / Area
        const grouped = {};
        todayOrders.forEach(o => {
            const groupKey = o.area ? `${o.village} / ${o.area}` : `${o.village}${o.pincode ? ' (PIN: ' + o.pincode + ')' : ''}`;
            if (!grouped[groupKey]) {
                grouped[groupKey] = [];
            }
            grouped[groupKey].push(o);
        });

        container.innerHTML = Object.keys(grouped).map(location => {
            const orders = grouped[location];
            return `
                <div class="delivery-group">
                    <div class="delivery-group-header">
                        <i class="fa-solid fa-map-location-dot"></i> ${location}
                    </div>
                    <div class="delivery-group-body">
                        ${orders.map(o => {
                            const isDelivered = o.deliveryStatus === 'delivered';
                            const checked = isDelivered ? 'checked' : '';
                            const completedClass = isDelivered ? 'delivery-completed' : '';
                            
                            return `
                                <div class="delivery-customer-row ${completedClass}">
                                    <div class="delivery-cust-info">
                                        <h4>${o.shopName} (${o.ownerName})</h4>
                                        <p><i class="fa-solid fa-phone"></i> ${o.customerMobile} ${o.landmark ? '| Landmark: ' + o.landmark : ''}</p>
                                        <div class="delivery-items-summary">
                                            ${o.items.map(item => `<span>${item.name} (x${item.quantity})</span>`).join(', ')}
                                        </div>
                                        <p class="delivery-amount">Total Amount: <strong>₹${o.totalAmount}</strong> | Status: <strong class="payment-paid">Paid</strong></p>
                                    </div>
                                    <div class="delivery-checkbox-wrapper">
                                        <label class="custom-checkbox">
                                            <input type="checkbox" ${checked} onchange="admin.toggleDeliveryCheckbox('${o.id}', this.checked)">
                                            <span class="checkmark"></span>
                                            <span class="checkbox-label">✅ Deliver किया</span>
                                        </label>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function toggleDeliveryCheckbox(orderId, isChecked) {
        const newStatus = isChecked ? 'delivered' : 'accepted';
        await updateStatus(orderId, newStatus);
    }

    // --- DAILY PROCUREMENT SUMMARY ---
    let aggregatedProcurement = {};

    function renderProcurementSummary() {
        const container = document.getElementById('procurement-summary-table');
        if (!container) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const todayOrders = ordersList.filter(o => o.orderDate === todayStr && o.deliveryStatus !== 'cancelled');

        if (todayOrders.length === 0) {
            container.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px;">आज कोई Order नहीं मिला। नया Summary बनाने के लिए Orders की ज़रूरत है।</td></tr>`;
            return;
        }

        // Aggregate quantities
        aggregatedProcurement = {};
        todayOrders.forEach(order => {
            order.items.forEach(item => {
                if (!aggregatedProcurement[item.productId]) {
                    aggregatedProcurement[item.productId] = {
                        name: item.name,
                        unit: item.unit,
                        quantity: 0
                    };
                }
                aggregatedProcurement[item.productId].quantity += item.quantity;
            });
        });

        // Render Table Rows
        let idx = 1;
        container.innerHTML = Object.keys(aggregatedProcurement).map(id => {
            const item = aggregatedProcurement[id];
            return `
                <tr>
                    <td>${idx++}</td>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.unit}</td>
                    <td style="font-size: 1.2rem; font-weight: 700; color: var(--primary-color);">${item.quantity}</td>
                </tr>
            `;
        }).join('');
    }

    // Export Excel (CSV)
    function exportProcurementExcel() {
        if (Object.keys(aggregatedProcurement).length === 0) {
            app.showNotification("Error", "Export करने के लिए कोई Data नहीं है।", "error");
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "S.No,Product Name,Unit,Total Quantity Required\n";

        let idx = 1;
        Object.keys(aggregatedProcurement).forEach(id => {
            const item = aggregatedProcurement[id];
            // Escape commas in product name
            const safeName = item.name.replace(/,/g, " ");
            csvContent += `${idx++},${safeName},${item.unit},${item.quantity}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Procurement_Summary_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- PRODUCT INVENTORY MANAGEMENT (Simple B2C/B2B CRUD) ---
    function renderInventoryList() {
        const container = document.getElementById('admin-inventory-list');
        if (!container) return;

        if (productsList.length === 0) {
            container.innerHTML = `<div class="no-data">कोई Product नहीं मिला।</div>`;
            return;
        }

        container.innerHTML = productsList.map(p => {
            const isActive = p.status === 'active';
            const statusText = isActive ? "Active" : "Inactive";
            const btnClass = isActive ? "btn-success" : "btn-danger";
            const cardClass = isActive ? "" : "product-inactive";
            
            // Format variants text list
            const variantsHtml = p.variants && p.variants.length > 0 
                ? p.variants.map(v => `<span style="display:inline-block; background:rgba(0,0,0,0.04); padding:3px 6px; border-radius:4px; margin:2px; font-size:0.85rem;">${v.name}: ₹${v.price}/${v.unit}</span>`).join(' ')
                : 'कोई Variant नहीं है';

            return `
                <div class="inventory-card ${cardClass}">
                    <div class="inventory-card-details" style="padding: 20px;">
                        <h4 style="margin-bottom: 5px;">${p.name}</h4>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 8px;">Cat: ${p.category}</p>
                        <div class="inventory-variants-list" style="margin-top: 5px;">
                            ${variantsHtml}
                        </div>
                    </div>
                    <div class="inventory-card-actions">
                        <button class="btn btn-action" onclick="admin.openEditProductModal('${p.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button class="btn btn-action ${btnClass}" onclick="admin.toggleProductStatus('${p.id}', '${p.status}')">
                            ${isActive ? '<i class="fa-solid fa-eye"></i> Active' : '<i class="fa-solid fa-eye-slash"></i> Inactive'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function toggleProductStatus(productId, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        await db.updateProduct(productId, { status: newStatus });
        app.showNotification("Status Update हुआ!", "Product Status Update हो गया है।", "success");
        await loadAllData();
        renderInventoryList();
    }

    function addVariantInputRow() {
        const container = document.getElementById('variants-list-inputs');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'variant-edit-row';
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        row.style.alignItems = 'center';
        row.innerHTML = `
            <input type="text" class="var-name" required placeholder="e.g. Chhota" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
            <input type="number" class="var-price" required placeholder="Price" style="flex: 1.2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
            <input type="text" class="var-unit" required placeholder="e.g. Darjan" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
            <button type="button" class="btn" style="background: var(--danger-color); color: var(--white); padding: 8px 12px; border-radius: 4px; border: none; cursor: pointer;" onclick="this.closest('.variant-edit-row').remove()"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(row);
    }

    function openAddProductModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'product-crud-modal';
        modal.innerHTML = `
            <div class="modal-card">
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                <h3>नया Product Add करें ✨</h3>
                <form id="product-crud-form" style="margin-top: 20px;">
                    <div class="form-group">
                        <label for="prod-name">Product Name</label>
                        <div class="input-wrapper">
                            <input type="text" id="prod-name" required placeholder="e.g. Burger Buns">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="prod-category">Category</label>
                        <select id="prod-category" class="form-select-custom" required>
                            <option value="Breads & Buns">Breads & Buns</option>
                            <option value="Momos">Momos</option>
                            <option value="Noodles & Pasta">Noodles & Pasta</option>
                            <option value="Rolls">Rolls</option>
                            <option value="Patties & Snacks">Patties & Snacks</option>
                            <option value="Cheese & Dairy">Cheese & Dairy</option>
                            <option value="Sauces & Spreads">Sauces & Spreads</option>
                            <option value="Eggs & Dairy">Eggs & Dairy</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="prod-image">Product Image URL (Optional)</label>
                        <div class="input-wrapper">
                            <input type="text" id="prod-image" placeholder="https://unsplash.com/...">
                        </div>
                    </div>

                    <div class="variants-edit-section" id="variants-edit-container" style="margin-bottom: 15px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 8px;">Product Variants</label>
                        <div id="variants-list-inputs">
                            <div class="variant-edit-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                                <input type="text" class="var-name" value="Standard" required placeholder="e.g. Chhota" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                                <input type="number" class="var-price" required placeholder="Price" style="flex: 1.2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                                <input type="text" class="var-unit" required placeholder="e.g. Darjan" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                                <button type="button" class="btn" style="background: var(--danger-color); color: var(--white); padding: 8px 12px; border-radius: 4px; border: none; cursor: pointer;" onclick="this.closest('.variant-edit-row').remove()"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                        <button type="button" class="btn" style="background: var(--secondary-color); color: var(--white); font-size: 0.85rem; padding: 6px 12px; margin-top: 5px; border-radius: 4px; border: none; cursor: pointer;" onclick="admin.addVariantInputRow()"><i class="fa-solid fa-plus"></i> Add Variant</button>
                    </div>

                    <button type="submit" class="btn btn-primary btn-block">Product Save करें 🚀</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('product-crud-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('prod-name').value;
            const category = document.getElementById('prod-category').value;
            const imageUrl = document.getElementById('prod-image').value || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80";

            const variantRows = document.querySelectorAll('.variant-edit-row');
            const variants = Array.from(variantRows).map(row => {
                return {
                    name: row.querySelector('.var-name').value.trim(),
                    price: parseFloat(row.querySelector('.var-price').value),
                    unit: row.querySelector('.var-unit').value.trim()
                };
            });

            if (variants.length === 0) {
                app.showNotification("Error", "कम से कम एक Variant ज़रूरी है।", "error");
                return;
            }

            await db.addProduct({ name, category, imageUrl, variants });
            modal.remove();
            app.showNotification("Product Add हुआ! 🎉", "नया Product सफलता से Add हो गया है।", "success");
            await loadAllData();
            renderInventoryList();
        });
    }

    function openEditProductModal(productId) {
        const p = productsList.find(prod => prod.id === productId);
        if (!p) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'product-crud-modal';
        
        const variantsHtml = p.variants && p.variants.length > 0
            ? p.variants.map((v, i) => `
                <div class="variant-edit-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                    <input type="text" class="var-name" value="${v.name}" required placeholder="e.g. Chhota" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                    <input type="number" class="var-price" value="${v.price}" required placeholder="Price" style="flex: 1.2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                    <input type="text" class="var-unit" value="${v.unit}" required placeholder="e.g. Darjan" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                    <button type="button" class="btn" style="background: var(--danger-color); color: var(--white); padding: 8px 12px; border-radius: 4px; border: none; cursor: pointer;" onclick="this.closest('.variant-edit-row').remove()"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('')
            : `<div class="variant-edit-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                <input type="text" class="var-name" value="Standard" required placeholder="e.g. Chhota" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                <input type="number" class="var-price" value="${p.price || ''}" required placeholder="Price" style="flex: 1.2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                <input type="text" class="var-unit" value="${p.unit || ''}" required placeholder="e.g. Darjan" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit;">
                <button type="button" class="btn" style="background: var(--danger-color); color: var(--white); padding: 8px 12px; border-radius: 4px; border: none; cursor: pointer;" onclick="this.closest('.variant-edit-row').remove()"><i class="fa-solid fa-trash"></i></button>
               </div>`;

        modal.innerHTML = `
            <div class="modal-card">
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                <h3>Product Edit करें ✏️</h3>
                <form id="product-crud-form" style="margin-top: 20px;">
                    <div class="form-group">
                        <label for="prod-name">Product Name</label>
                        <div class="input-wrapper">
                            <input type="text" id="prod-name" value="${p.name}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="prod-category">Category</label>
                        <select id="prod-category" class="form-select-custom" required>
                            <option value="Breads & Buns" ${p.category === 'Breads & Buns' ? 'selected' : ''}>Breads & Buns</option>
                            <option value="Momos" ${p.category === 'Momos' ? 'selected' : ''}>Momos</option>
                            <option value="Noodles & Pasta" ${p.category === 'Noodles & Pasta' ? 'selected' : ''}>Noodles & Pasta</option>
                            <option value="Rolls" ${p.category === 'Rolls' ? 'selected' : ''}>Rolls</option>
                            <option value="Patties & Snacks" ${p.category === 'Patties & Snacks' ? 'selected' : ''}>Patties & Snacks</option>
                            <option value="Cheese & Dairy" ${p.category === 'Cheese & Dairy' ? 'selected' : ''}>Cheese & Dairy</option>
                            <option value="Sauces & Spreads" ${p.category === 'Sauces & Spreads' ? 'selected' : ''}>Sauces & Spreads</option>
                            <option value="Eggs & Dairy" ${p.category === 'Eggs & Dairy' ? 'selected' : ''}>Eggs & Dairy</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="prod-image">Product Image URL</label>
                        <div class="input-wrapper">
                            <input type="text" id="prod-image" value="${p.imageUrl || ''}">
                        </div>
                    </div>

                    <div class="variants-edit-section" id="variants-edit-container" style="margin-bottom: 15px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 8px;">Product Variants</label>
                        <div id="variants-list-inputs">
                            ${variantsHtml}
                        </div>
                        <button type="button" class="btn" style="background: var(--secondary-color); color: var(--white); font-size: 0.85rem; padding: 6px 12px; margin-top: 5px; border-radius: 4px; border: none; cursor: pointer;" onclick="admin.addVariantInputRow()"><i class="fa-solid fa-plus"></i> Add Variant</button>
                    </div>

                    <button type="submit" class="btn btn-primary btn-block">बदलाव Save करें 💾</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('product-crud-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('prod-name').value;
            const category = document.getElementById('prod-category').value;
            const imageUrl = document.getElementById('prod-image').value;

            const variantRows = document.querySelectorAll('.variant-edit-row');
            const variants = Array.from(variantRows).map(row => {
                return {
                    name: row.querySelector('.var-name').value.trim(),
                    price: parseFloat(row.querySelector('.var-price').value),
                    unit: row.querySelector('.var-unit').value.trim()
                };
            });

            if (variants.length === 0) {
                app.showNotification("Error", "कम से कम एक Variant ज़रूरी है।", "error");
                return;
            }

            await db.updateProduct(productId, { name, category, imageUrl, variants });
            modal.remove();
            app.showNotification("Product Update हुआ! 💾", "Product Details Save हो गए हैं।", "success");
            await loadAllData();
            renderInventoryList();
        });
    }

    // --- CUSTOMER MANAGEMENT ---
    function renderCustomersList(searchQuery = "") {
        const container = document.getElementById('admin-customers-list');
        if (!container) return;

        let filtered = customersList;
        if (searchQuery.trim() !== "") {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c => c.shopName.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q) || c.mobile.includes(q));
        }

        if (filtered.length === 0) {
            container.innerHTML = `<div class="no-data">कोई Customer नहीं मिला।</div>`;
            return;
        }

        container.innerHTML = filtered.map(c => {
            const isActive = c.status === 'active';
            const btnText = isActive ? "Block" : "Unblock";
            const btnClass = isActive ? "btn-danger" : "btn-success";
            const statusClass = isActive ? "status-active" : "status-blocked";
            
            return `
                <div class="customer-card">
                    <div class="customer-info-row">
                        <div>
                            <h4>${c.shopName}</h4>
                            <p><strong>Owner:</strong> ${c.ownerName} | <strong>Mobile:</strong> ${c.mobile}</p>
                            <p><strong>Address:</strong> ${c.village || c.villageArea || ""}${c.pincode ? ', PIN: ' + c.pincode : ''}${c.area ? ', ' + c.area : ''} ${c.landmark ? '(' + c.landmark + ')' : ''}</p>
                        </div>
                        <span class="cust-status ${statusClass}">${isActive ? 'Active' : 'Blocked'}</span>
                    </div>
                    <div class="customer-card-actions">
                        <button class="btn btn-action" onclick="admin.viewCustomerHistory('${c.uid}')"><i class="fa-solid fa-history"></i> History</button>
                        <button class="btn btn-action ${btnClass}" onclick="admin.toggleCustomerStatus('${c.uid}', '${c.status}')">
                            <i class="fa-solid fa-user-slash"></i> ${btnText}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function toggleCustomerStatus(uid, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
        await db.updateCustomerStatus(uid, newStatus);
        app.showNotification("Status Update हुआ!", "Customer Status Update हो गया है।", "success");
        await loadAllData();
        renderCustomersList();
    }

    function viewCustomerHistory(uid) {
        const cust = customersList.find(c => c.uid === uid);
        if (!cust) return;

        const custOrders = ordersList.filter(o => o.customerId === uid);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'customer-history-modal';
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 600px;">
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                <h3>${cust.shopName} - Order History</h3>
                <p class="form-subtext">Owner: ${cust.ownerName} | कुल Orders: ${custOrders.length}</p>
                
                <div class="cust-history-list" style="max-height: 400px; overflow-y: auto; margin-top: 20px;">
                    ${custOrders.length === 0 ? '<p class="no-data">कोई Order History नहीं है।</p>' : 
                        custOrders.map(o => `
                            <div class="history-card" style="margin-bottom: 15px; border: 1px solid var(--border-color);">
                                <div class="history-header">
                                    <div>
                                        <h4>Order: ${o.id}</h4>
                                        <span class="history-date">${new Date(o.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <span class="status-badge badge-${o.deliveryStatus}">${translateStatus(o.deliveryStatus)}</span>
                                </div>
                                <div class="history-body">
                                    <p class="history-items-summary" style="font-size: 0.9rem;">
                                        ${o.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                                    </p>
                                    <div style="margin-top: 8px; font-weight: 600;">Total Amount: ₹${o.totalAmount}</div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // --- ADMIN BROADCAST CENTER ---
    function renderBroadcastsList() {
        const container = document.getElementById('admin-broadcasts-list');
        if (!container) return;

        if (broadcastsList.length === 0) {
            container.innerHTML = `<div class="no-data">अभी तक कोई Announcement नहीं भेजी गई है।</div>`;
            return;
        }

        container.innerHTML = broadcastsList.map(b => {
            const expDate = new Date(b.expiryDate).toLocaleString();
            const priorityClass = `priority-${b.priority}`;
            
            return `
                <div class="broadcast-admin-card">
                    <div class="broadcast-header-row">
                        <h4>${b.title}</h4>
                        <span class="priority-badge ${priorityClass}">${b.priority.toUpperCase()}</span>
                    </div>
                    <p class="broadcast-message-text">${b.message}</p>
                    <div class="broadcast-footer-row">
                        <span>Expires: ${expDate}</span>
                        <button class="btn btn-action btn-cancel" style="padding: 6px 12px; font-size: 0.85rem;" onclick="admin.deleteBroadcast('${b.id}')">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function submitBroadcast(e) {
        e.preventDefault();
        const title = document.getElementById('bc-title').value.trim();
        const message = document.getElementById('bc-message').value.trim();
        const priority = document.getElementById('bc-priority').value;
        const expiryVal = document.getElementById('bc-expiry').value;

        if (!title || !message || !expiryVal) {
            app.showNotification("Error ⚠️", "कृपया सभी Fields भरें।", "error");
            return;
        }

        const expiryDate = new Date(expiryVal).toISOString();

        await db.addBroadcast({ title, message, priority, expiryDate });
        
        // Reset Form
        document.getElementById('bc-form').reset();
        app.showNotification("Broadcast Send हुआ! 📢", "Announcement सभी Customers को भेज दी गई है।", "success");
        
        await loadAllData();
        renderBroadcastsList();
    }

    async function deleteBroadcast(id) {
        await db.deleteBroadcast(id);
        app.showNotification("Delete हुआ!", "Announcement Delete हो गई।", "success");
        await loadAllData();
        renderBroadcastsList();
    }

    // --- TIME WINDOW SETTING MANAGEMENT ---
    async function loadTimeSettings() {
        const settings = await db.getSettings();
        const input = document.getElementById('admin-close-time-input');
        if (input) {
            input.value = settings.orderClosingTime;
        }
    }

    async function saveTimeSettings() {
        const input = document.getElementById('admin-close-time-input');
        if (!input) return;
        
        const closingTime = input.value;
        await db.updateSettings({ orderClosingTime: closingTime });
        
        app.showNotification("Settings Save हुईं! 💾", `Order Closing Time बदलकर ${closingTime} कर दिया गया है।`, "success");
        
        // Update global timer
        app.updateClosingTime();
    }

    // --- SERVICE AREAS MANAGEMENT ---
    async function loadServiceAreasSettings() {
        const container = document.getElementById('admin-service-areas-list');
        if (!container) return;

        const settings = await db.getSettings();
        const serviceAreas = settings.serviceAreas || [];

        if (serviceAreas.length === 0) {
            container.innerHTML = `<p class="form-subtext" style="color: var(--text-muted);">कोई PIN Code Configure नहीं है। 📍</p>`;
            return;
        }

        container.innerHTML = serviceAreas.map(area => {
            const isActive = area.status === 'active';
            const badgeClass = isActive ? 'badge-delivered' : 'badge-cancelled';
            const toggleText = isActive ? 'Disable' : 'Enable';
            return `
                <div class="service-area-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color); gap: 10px;">
                    <div>
                        <strong>${area.name}</strong> <span class="form-subtext">(PIN: ${area.pincode})</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="status-badge ${badgeClass}" style="padding: 2px 8px; font-size: 0.75rem; border-radius: var(--radius-sm);">
                            ${isActive ? 'Active' : 'Disabled'}
                        </span>
                        <button class="btn btn-action" onclick="admin.toggleServiceAreaStatus('${area.pincode}')" style="font-size: 0.8rem; padding: 4px 8px;">
                            ${toggleText}
                        </button>
                        <button class="btn btn-action" onclick="admin.deleteServiceArea('${area.pincode}')" style="font-size: 0.8rem; padding: 4px 8px; background: #fce4e4; color: #c0392b; border: 1px solid #f9c2c2;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function addServiceArea() {
        const pincodeInput = document.getElementById('admin-pincode-input');
        const areaNameInput = document.getElementById('admin-area-name-input');
        if (!pincodeInput || !areaNameInput) return;

        const pincode = pincodeInput.value.trim();
        const areaName = areaNameInput.value.trim();

        if (!pincode || !areaName) {
            app.showNotification("गलती ❌", "PIN Code और Area Name दोनों लिखें।", "warning");
            return;
        }

        if (!/^[0-9]{6}$/.test(pincode)) {
            app.showNotification("गलती ❌", "PIN Code सही 6-digit का होना चाहिए।", "warning");
            return;
        }

        const settings = await db.getSettings();
        const serviceAreas = settings.serviceAreas || [];

        if (serviceAreas.some(a => a.pincode === pincode)) {
            app.showNotification("गलती ❌", "यह PIN Code पहले से Add है।", "warning");
            return;
        }

        serviceAreas.push({ pincode: pincode, name: areaName, status: 'active' });
        await db.updateSettings({ serviceAreas: serviceAreas });

        pincodeInput.value = '';
        areaNameInput.value = '';

        app.showNotification("सफल! 📍", `${areaName} (${pincode}) Service Areas में Add हो गया है।`, "success");
        await loadServiceAreasSettings();
    }

    async function toggleServiceAreaStatus(pincode) {
        const settings = await db.getSettings();
        const serviceAreas = settings.serviceAreas || [];
        const area = serviceAreas.find(a => a.pincode === pincode);
        if (!area) return;

        area.status = area.status === 'active' ? 'disabled' : 'active';
        await db.updateSettings({ serviceAreas: serviceAreas });
        app.showNotification("सफल! 📍", `${area.name} बदलकर ${area.status === 'active' ? 'Active' : 'Disabled'} कर दिया।`, "success");
        await loadServiceAreasSettings();
    }

    async function deleteServiceArea(pincode) {
        if (!confirm("क्या आप सच में इस Service Area को Delete करना चाहते हैं?")) return;

        const settings = await db.getSettings();
        let serviceAreas = settings.serviceAreas || [];
        const area = serviceAreas.find(a => a.pincode === pincode);
        if (!area) return;

        serviceAreas = serviceAreas.filter(a => a.pincode !== pincode);
        await db.updateSettings({ serviceAreas: serviceAreas });
        app.showNotification("सफल! 📍", "Service Area Delete हो गया है।", "success");
        await loadServiceAreasSettings();
    }

    // Helper to translate status to Hinglish
    function translateStatus(status) {
        switch(status) {
            case 'pending': return 'Pending';
            case 'accepted': return 'Accepted';
            case 'preparing': return 'Packing शुरू';
            case 'out_for_delivery': return 'Out for Delivery 🏍️';
            case 'delivered': return 'Deliver हो गया ✅';
            case 'cancelled': return 'Cancel हो गया ❌';
            default: return status;
        }
    }

    // --- PUBLIC METHODS ---
    return {
        init: initAdmin,
        updateStatus: updateStatus,
        toggleDeliveryCheckbox: toggleDeliveryCheckbox,
        exportProcurementExcel: exportProcurementExcel,
        toggleProductStatus: toggleProductStatus,
        openAddProductModal: openAddProductModal,
        openEditProductModal: openEditProductModal,
        addVariantInputRow: addVariantInputRow,
        renderCustomersList: renderCustomersList,
        toggleCustomerStatus: toggleCustomerStatus,
        viewCustomerHistory: viewCustomerHistory,
        deleteBroadcast: deleteBroadcast,
        submitBroadcast: submitBroadcast,
        loadTimeSettings: loadTimeSettings,
        saveTimeSettings: saveTimeSettings,
        addServiceArea: addServiceArea,
        toggleServiceAreaStatus: toggleServiceAreaStatus,
        deleteServiceArea: deleteServiceArea,
        loadServiceAreasSettings: loadServiceAreasSettings,
        cleanup: () => {
            if (unsubscribeOrders) {
                unsubscribeOrders();
                unsubscribeOrders = null;
            }
        }
    };
})();

// Export admin if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = admin;
}

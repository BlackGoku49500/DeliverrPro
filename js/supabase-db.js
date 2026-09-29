// DeliverrPro - Supabase Database Abstraction Layer
// Compatible with Deliverr unified db interface

const db = (() => {
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

    // --- MOCK STORAGE FALLBACK (LocalStorage) ---
    const mockStorage = {
        get: (key) => JSON.parse(localStorage.getItem(`deliverr_${key}`)),
        set: (key, val) => localStorage.setItem(`deliverr_${key}`, JSON.stringify(val)),
        init: () => {
            console.log("🚀 Running in MOCK DATABASE mode (LocalStorage fallback).");
            
            if (!localStorage.getItem('deliverr_products')) {
                const initialProducts = defaultProducts.map((p, index) => ({
                    id: "p" + (index + 1),
                    ...p
                }));
                mockStorage.set('products', initialProducts);
            }

            if (!localStorage.getItem('deliverr_settings')) {
                mockStorage.set('settings', {
                    orderClosingTime: CONFIG.defaultClosingTime,
                    serviceAreas: [{ pincode: "121103", name: "Hathin", status: "active" }]
                });
            }

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
                    }
                ];
                mockStorage.set('broadcasts', initialBroadcasts);
            }
        }
    };

    // --- SUPABASE CLIENT INITIALIZATION ---
    let supabaseClient = null;

    try {
        if (!isMock && window.supabase && CONFIG.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey) {
            supabaseClient = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
            console.log("✅ Supabase Client initialized successfully.");
        }
    } catch (e) {
        console.error("Supabase client initialization failed:", e);
    }

    if (isMock) {
        mockStorage.init();
    }

    // Helper to format timestamps
    const nowISO = () => new Date().toISOString();

    return {
        isMockMode: () => isMock,
        getSupabaseClient: () => supabaseClient,
        getUserByUid: async (uid) => {
            if (isMock || !supabaseClient) {
                const users = mockStorage.get('users') || [];
                return users.find(u => u.uid === uid) || null;
            }
            const { data, error } = await supabaseClient.from('users').select('*').eq('uid', uid).maybeSingle();
            if (error) {
                console.error("Supabase getUserByUid error:", error);
                return null;
            }
            return data;
        },

        getUserByMobile: async (mobile) => {
            if (isMock || !supabaseClient) {
                const users = mockStorage.get('users') || [];
                const matched = users.filter(u => u.mobile === mobile);
                if (matched.length > 1) {
                    throw new Error("Data Integrity Error: इस Mobile Number से एक से अधिक Accounts रजिस्टर हैं।");
                }
                return matched[0] || null;
            }
            const { data, error } = await supabaseClient.from('users').select('*').eq('mobile', mobile);
            if (error) {
                console.error("Supabase getUserByMobile error:", error);
                throw error;
            }
            if (!data || data.length === 0) return null;
            if (data.length > 1) {
                throw new Error("Data Integrity Error: इस Mobile Number से एक से अधिक Accounts रजिस्टर हैं।");
            }
            return data[0];
        },

        createUserProfile: async (uid, profileData) => {
            const userData = {
                uid: uid,
                shopName: (profileData.shopName || "").trim(),
                ownerName: (profileData.ownerName || "").trim(),
                mobile: (profileData.mobile || "").trim(),
                village: (profileData.village || "").trim(),
                pincode: (profileData.pincode || "").trim(),
                villageArea: profileData.villageArea || ((profileData.village || "").trim() + " (PIN: " + (profileData.pincode || "").trim() + ")"),
                landmark: (profileData.landmark || "").trim(),
                role: profileData.role || "customer",
                status: profileData.status || "active",
                createdAt: nowISO()
            };

            if (isMock || !supabaseClient) {
                const users = mockStorage.get('users') || [];
                const existingIdx = users.findIndex(u => u.uid === uid);
                if (existingIdx !== -1) {
                    users[existingIdx] = userData;
                } else {
                    users.push(userData);
                }
                mockStorage.set('users', users);
                return userData;
            }

            const { data, error } = await supabaseClient.from('users').upsert(userData, { onConflict: 'uid' }).select().single();
            if (error) {
                console.error("Supabase createUserProfile error:", error);
                throw error;
            }
            return data || userData;
        },

        deleteUserDoc: async (uid) => {
            if (isMock || !supabaseClient) {
                let users = mockStorage.get('users') || [];
                users = users.filter(u => u.uid !== uid);
                mockStorage.set('users', users);
                return;
            }
            await supabaseClient.from('users').delete().eq('uid', uid);
        },

        // --- ADMINS ---
        seedAdminIfNeeded: async () => {
            const defaultAdmin = {
                uid: 'admin_9999999999',
                mobile: '9999999999',
                password: 'admin123',
                role: 'admin',
                ownerName: 'Administrator',
                shopName: 'Deliverr Admin',
                status: 'active',
                createdAt: nowISO()
            };

            if (isMock || !supabaseClient) {
                const admins = mockStorage.get('admins') || [];
                if (admins.length === 0) {
                    admins.push(defaultAdmin);
                    mockStorage.set('admins', admins);
                }
                return;
            }

            try {
                const { count, error } = await supabaseClient.from('admins').select('*', { count: 'exact', head: true });
                if (!error && (count === 0 || count === null)) {
                    console.log("Seeding default admin to Supabase...");
                    await supabaseClient.from('admins').insert([defaultAdmin]);
                }
            } catch (err) {
                console.error("Error seeding default admin in Supabase:", err);
            }
        },

        getAdminByMobile: async (mobile) => {
            if (isMock || !supabaseClient) {
                const admins = mockStorage.get('admins') || [];
                return admins.find(a => a.mobile === mobile) || null;
            }
            const { data, error } = await supabaseClient.from('admins').select('*').eq('mobile', mobile).maybeSingle();
            if (error) {
                console.error("Supabase getAdminByMobile error:", error);
                return null;
            }
            return data;
        },

        // --- PRODUCTS ---
        getProducts: async () => {
            db.seedAdminIfNeeded();

            if (isMock || !supabaseClient) {
                const rawProducts = mockStorage.get('products') || [];
                return rawProducts;
            }

            const { data, error } = await supabaseClient.from('products').select('*');
            if (error) {
                console.error("Supabase getProducts error:", error);
                return [];
            }

            // Seed default products if table is empty
            if (!data || data.length === 0) {
                console.log("Seeding default products to Supabase...");
                const toInsert = defaultProducts.map((p, idx) => ({
                    id: "p" + (idx + 1),
                    ...p,
                    createdAt: nowISO()
                }));
                const { data: inserted } = await supabaseClient.from('products').insert(toInsert).select();
                return inserted || toInsert;
            }

            return data;
        },

        addProduct: async (productData) => {
            const newId = "p" + Date.now().toString(36);
            const fullProduct = {
                id: newId,
                ...productData,
                variants: productData.variants || [
                    { name: "Standard", price: Number(productData.price) || 0, unit: productData.unit || "" }
                ],
                status: "active",
                createdAt: nowISO()
            };

            if (isMock || !supabaseClient) {
                const products = mockStorage.get('products') || [];
                products.push(fullProduct);
                mockStorage.set('products', products);
                return fullProduct;
            }

            const { data, error } = await supabaseClient.from('products').insert([fullProduct]).select().single();
            if (error) {
                console.error("Supabase addProduct error:", error);
                throw error;
            }
            return data || fullProduct;
        },

        updateProduct: async (productId, updateData) => {
            const fullUpdate = { ...updateData };
            if (updateData.price || updateData.unit) {
                fullUpdate.variants = updateData.variants || [
                    { name: "Standard", price: Number(updateData.price) || 0, unit: updateData.unit || "" }
                ];
            }

            if (isMock || !supabaseClient) {
                const products = mockStorage.get('products') || [];
                const idx = products.findIndex(p => p.id === productId);
                if (idx !== -1) {
                    products[idx] = { ...products[idx], ...fullUpdate };
                    mockStorage.set('products', products);
                }
                return products[idx];
            }

            const { data, error } = await supabaseClient.from('products').update(fullUpdate).eq('id', productId).select().single();
            if (error) {
                console.error("Supabase updateProduct error:", error);
                throw error;
            }
            return data || { id: productId, ...fullUpdate };
        },

        deleteProduct: async (productId) => {
            if (isMock || !supabaseClient) {
                let products = mockStorage.get('products') || [];
                products = products.filter(p => p.id !== productId);
                mockStorage.set('products', products);
                return true;
            }

            const { error } = await supabaseClient.from('products').delete().eq('id', productId);
            if (error) {
                console.error("Supabase deleteProduct error:", error);
                throw error;
            }
            return true;
        },

        // --- ORDERS ---
        getOrders: async () => {
            if (isMock || !supabaseClient) {
                return mockStorage.get('orders') || [];
            }
            const { data, error } = await supabaseClient.from('orders').select('*').order('createdAt', { ascending: false });
            if (error) {
                console.error("Supabase getOrders error:", error);
                return [];
            }
            return data || [];
        },

        subscribeToOrders: (callback) => {
            if (isMock || !supabaseClient) {
                return () => {};
            }

            // Realtime subscription via Supabase Channel
            const channel = supabaseClient
                .channel('public:orders')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
                    const { data } = await supabaseClient.from('orders').select('*').order('createdAt', { ascending: false });
                    if (data) callback(data);
                })
                .subscribe();

            return () => {
                supabaseClient.removeChannel(channel);
            };
        },

        getCustomerOrders: async (customerId) => {
            if (isMock || !supabaseClient) {
                const orders = mockStorage.get('orders') || [];
                return orders.filter(o => o.customerId === customerId);
            }
            const { data, error } = await supabaseClient.from('orders').select('*').eq('customerId', customerId).order('createdAt', { ascending: false });
            if (error) {
                console.error("Supabase getCustomerOrders error:", error);
                return [];
            }
            return data || [];
        },

        createOrder: async (orderData) => {
            const shortId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
            const orderWithId = {
                id: shortId,
                ...orderData,
                deliveryStatus: "pending",
                createdAt: nowISO()
            };

            if (isMock || !supabaseClient) {
                const orders = mockStorage.get('orders') || [];
                orders.unshift(orderWithId);
                mockStorage.set('orders', orders);
                return orderWithId;
            }

            const { data, error } = await supabaseClient.from('orders').insert([orderWithId]).select().single();
            if (error) {
                console.error("Supabase createOrder error:", error);
                throw error;
            }
            return data || orderWithId;
        },

        updateOrderStatus: async (orderId, updateData) => {
            if (isMock || !supabaseClient) {
                const orders = mockStorage.get('orders') || [];
                const idx = orders.findIndex(o => o.id === orderId);
                if (idx !== -1) {
                    orders[idx] = { ...orders[idx], ...updateData };
                    mockStorage.set('orders', orders);
                }
                return orders[idx];
            }

            const { data, error } = await supabaseClient.from('orders').update(updateData).eq('id', orderId).select().single();
            if (error) {
                console.error("Supabase updateOrderStatus error:", error);
                throw error;
            }
            return data || { id: orderId, ...updateData };
        },

        // --- CUSTOMERS ---
        getCustomers: async () => {
            if (isMock || !supabaseClient) {
                const users = mockStorage.get('users') || [];
                return users.filter(u => u.role === "customer");
            }
            const { data, error } = await supabaseClient.from('users').select('*').eq('role', 'customer');
            if (error) {
                console.error("Supabase getCustomers error:", error);
                return [];
            }
            return data || [];
        },

        updateCustomerStatus: async (customerUid, status) => {
            if (isMock || !supabaseClient) {
                const users = mockStorage.get('users') || [];
                const idx = users.findIndex(u => u.uid === customerUid);
                if (idx !== -1) {
                    users[idx].status = status;
                    mockStorage.set('users', users);
                }
                return true;
            }

            const { error } = await supabaseClient.from('users').update({ status }).eq('uid', customerUid);
            if (error) {
                console.error("Supabase updateCustomerStatus error:", error);
                throw error;
            }
            return true;
        },

        // --- BROADCASTS ---
        getBroadcasts: async () => {
            if (isMock || !supabaseClient) {
                return mockStorage.get('broadcasts') || [];
            }
            const { data, error } = await supabaseClient.from('broadcasts').select('*').order('createdAt', { ascending: false });
            if (error) {
                console.error("Supabase getBroadcasts error:", error);
                return [];
            }
            return data || [];
        },

        addBroadcast: async (broadcastData) => {
            const newBroadcast = {
                id: "b" + Date.now().toString(36),
                ...broadcastData,
                createdAt: nowISO()
            };

            if (isMock || !supabaseClient) {
                const broadcasts = mockStorage.get('broadcasts') || [];
                broadcasts.unshift(newBroadcast);
                mockStorage.set('broadcasts', broadcasts);
                return newBroadcast;
            }

            const { data, error } = await supabaseClient.from('broadcasts').insert([newBroadcast]).select().single();
            if (error) {
                console.error("Supabase addBroadcast error:", error);
                throw error;
            }
            return data || newBroadcast;
        },

        deleteBroadcast: async (broadcastId) => {
            if (isMock || !supabaseClient) {
                let broadcasts = mockStorage.get('broadcasts') || [];
                broadcasts = broadcasts.filter(b => b.id !== broadcastId);
                mockStorage.set('broadcasts', broadcasts);
                return true;
            }

            const { error } = await supabaseClient.from('broadcasts').delete().eq('id', broadcastId);
            if (error) {
                console.error("Supabase deleteBroadcast error:", error);
                throw error;
            }
            return true;
        },

        // --- SETTINGS ---
        getSettings: async () => {
            const defaultSettings = { 
                id: 'global',
                orderClosingTime: CONFIG.defaultClosingTime,
                serviceAreas: [{ pincode: "121103", name: "Hathin", status: "active" }]
            };

            if (isMock || !supabaseClient) {
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
            }

            const { data, error } = await supabaseClient.from('settings').select('*').eq('id', 'global').maybeSingle();
            if (error) {
                console.error("Supabase getSettings error:", error);
                return defaultSettings;
            }
            if (!data) {
                await supabaseClient.from('settings').insert([defaultSettings]);
                return defaultSettings;
            }
            return data;
        },

        updateSettings: async (settingsData) => {
            if (isMock || !supabaseClient) {
                const current = mockStorage.get('settings') || {};
                const updated = { ...current, ...settingsData };
                mockStorage.set('settings', updated);
                return updated;
            }

            const { data, error } = await supabaseClient.from('settings').upsert({ id: 'global', ...settingsData }).select().single();
            if (error) {
                console.error("Supabase updateSettings error:", error);
                throw error;
            }
            return data || settingsData;
        }
    };
})();

// Export db if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = db;
}

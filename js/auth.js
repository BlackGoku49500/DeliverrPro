// DeliverrPro - Authentication Module (Supabase Phone OTP & Admin Login)

const auth = (() => {
    let currentUser = null;
    let pendingMobile = null;
    let authReadyResolve = null;
    const authReadyPromise = new Promise(resolve => { authReadyResolve = resolve; });

    const isAdminPage = window.location.pathname.includes('admin.html');

    // Helper to validate mobile number strictly (Indian 10-digit mobile)
    function validateMobile(mobile) {
        const mobileRegex = /^[6789]\d{9}$/;
        if (!mobile || !mobileRegex.test(mobile)) {
            throw new Error("कृपया सही 10 अंकों का Mobile Number दर्ज करें।");
        }
    }

    // --- SESSION INITIALIZATION ---
    async function initSession() {
        try {
            const loggedInMobile = localStorage.getItem('deliverr_logged_in_mobile');
            
            if (!loggedInMobile) {
                currentUser = null;
                authReadyResolve();
                return;
            }

            // 1. Check if logged-in user is an Admin
            const adminProfile = await db.getAdminByMobile(loggedInMobile);
            if (adminProfile) {
                if (adminProfile.status !== 'active') {
                    localStorage.removeItem('deliverr_logged_in_mobile');
                    currentUser = null;
                } else {
                    currentUser = adminProfile;
                }
                authReadyResolve();
                return;
            }

            // 2. Check if logged-in user is a Customer in Supabase
            const userProfile = await db.getUserByMobile(loggedInMobile);
            if (userProfile) {
                if (userProfile.status === 'disabled') {
                    localStorage.removeItem('deliverr_logged_in_mobile');
                    currentUser = null;
                } else {
                    currentUser = userProfile;
                }
            } else {
                localStorage.removeItem('deliverr_logged_in_mobile');
                currentUser = null;
            }
        } catch (err) {
            console.error("Error loading Supabase user session:", err);
            currentUser = null;
        } finally {
            authReadyResolve();
        }
    }

    return {
        init: () => {
            initSession();
        },

        // Resolves when authentication state is determined
        whenReady: () => authReadyPromise,

        getCurrentUser: () => currentUser,
        isLoggedIn: () => currentUser !== null,
        isAdmin: () => currentUser && currentUser.role === 'admin',
        getPendingMobile: () => pendingMobile,

        // --- STEP 1: SEND PHONE OTP VIA SUPABASE ---
        sendOTP: async (mobile) => {
            validateMobile(mobile);
            pendingMobile = mobile;

            const client = typeof db.getSupabaseClient === 'function' ? db.getSupabaseClient() : null;

            if (db.isMockMode() || !client) {
                console.log(`[MOCK MODE] Demo OTP sent to +91${mobile}. Use OTP: 123456`);
                return { success: true, mobile };
            }

            // Real Supabase Phone OTP Request
            const fullPhone = '+91' + mobile;
            const { data, error } = await client.auth.signInWithOtp({
                phone: fullPhone
            });

            if (error) {
                console.error("Supabase signInWithOtp error:", error);
                // If Supabase phone provider has an error, provide a clear helpful message
                if (error.message.includes("SMS provider") || error.message.includes("unsupported_phone_provider")) {
                    throw new Error("Supabase Phone Provider setup nahi hai. Supabase Dashboard me Phone Auth activate karein.");
                }
                throw error;
            }

            return { success: true, mobile };
        },

        // --- STEP 2: VERIFY OTP VIA SUPABASE ---
        verifyOTP: async (otpCode) => {
            if (!pendingMobile) throw new Error("Mobile Number नहीं मिला। कृपया दोबारा शुरू करें।");
            if (!otpCode || otpCode.length !== 6) {
                throw new Error("कृपया सही 6 अंकों का OTP कोड दर्ज करें।");
            }

            const client = typeof db.getSupabaseClient === 'function' ? db.getSupabaseClient() : null;

            // Mock Mode verification fallback (Accepts 123456)
            if (db.isMockMode() || !client) {
                if (otpCode !== '123456') {
                    throw new Error("गलत OTP! Demo OTP 123456 दर्ज करें।");
                }
            } else {
                // Real Supabase OTP Verification
                const fullPhone = '+91' + pendingMobile;
                const { data, error } = await client.auth.verifyOtp({
                    phone: fullPhone,
                    token: otpCode,
                    type: 'sms'
                });

                if (error) {
                    console.error("Supabase verifyOtp error:", error);
                    throw new Error("गलत या expired OTP कोड। कृपया दोबारा कोशिश करें।");
                }
            }

            // OTP Verified Successfully! Now check if user profile exists in Supabase
            const existingProfile = await db.getUserByMobile(pendingMobile);

            if (existingProfile) {
                if (existingProfile.status === 'disabled') {
                    throw new Error("आपका Account बंद (disabled) कर दिया गया है। कृपया Admin से संपर्क करें।");
                }
                localStorage.setItem('deliverr_logged_in_mobile', pendingMobile);
                currentUser = existingProfile;
                return { isNewUser: false, user: existingProfile };
            } else {
                // New user - needs to fill profile details (Shop name, village, etc.)
                return { isNewUser: true, user: null };
            }
        },

        // --- RESEND OTP ---
        resendOTP: async () => {
            if (!pendingMobile) throw new Error("Mobile Number नहीं मिला।");

            const client = typeof db.getSupabaseClient === 'function' ? db.getSupabaseClient() : null;

            if (db.isMockMode() || !client) {
                console.log(`[MOCK MODE] Demo OTP resent to +91${pendingMobile}. Use OTP: 123456`);
                return true;
            }

            const fullPhone = '+91' + pendingMobile;
            const { error } = await client.auth.signInWithOtp({
                phone: fullPhone
            });

            if (error) throw error;
            return true;
        },

        // --- RESET AUTH FLOW ---
        resetAuthFlow: () => {
            pendingMobile = null;
        },

        // --- STEP 3: COMPLETE PROFILE (New Customer Registration in Supabase) ---
        completeProfile: async (profileData) => {
            if (!pendingMobile) throw new Error("Registration Error: Mobile Number नहीं मिला।");
            
            validateMobile(pendingMobile);

            // Check if customer already exists in Supabase
            const existingProfile = await db.getUserByMobile(pendingMobile);
            if (existingProfile) {
                localStorage.setItem('deliverr_logged_in_mobile', pendingMobile);
                currentUser = existingProfile;
                return existingProfile;
            }

            const uid = "usr_" + pendingMobile;

            const fullProfile = {
                uid: uid,
                shopName: profileData.shopName.trim(),
                ownerName: profileData.ownerName.trim(),
                mobile: pendingMobile,
                village: profileData.village.trim(),
                pincode: profileData.pincode.trim(),
                villageArea: profileData.village.trim() + " (PIN: " + profileData.pincode.trim() + ")",
                landmark: profileData.landmark ? profileData.landmark.trim() : "",
                role: "customer",
                status: "active"
            };

            const created = await db.createUserProfile(uid, fullProfile);
            localStorage.setItem('deliverr_logged_in_mobile', pendingMobile);
            currentUser = created || fullProfile;
            return currentUser;
        },

        // --- ADMIN LOGIN (Mobile + Password via Supabase admins table) ---
        adminLogin: async (mobile, password) => {
            if (!mobile || mobile.length !== 10 || !/^[6789]\d{9}$/.test(mobile)) {
                throw new Error("कृपया सही 10 अंकों का Mobile Number दर्ज करें।");
            }
            if (!password || password.length < 6) {
                throw new Error("Password कम से कम 6 characters का होना चाहिए।");
            }

            try {
                // Seed default admin if admins table in Supabase is empty
                await db.seedAdminIfNeeded();

                // Fetch admin document from 'admins' table in Supabase
                const adminDoc = await db.getAdminByMobile(mobile);
                
                if (!adminDoc) {
                    throw new Error("गलत Mobile Number या Password!");
                }
                if (adminDoc.role !== 'admin') {
                    throw new Error("यह पोर्टल सिर्फ Admin के लिए है!");
                }
                if (adminDoc.status !== 'active') {
                    throw new Error("आपका Admin Account अभी inactive है।");
                }
                if (adminDoc.password !== password) {
                    throw new Error("गलत Mobile Number या Password!");
                }

                // Persist session
                localStorage.setItem('deliverr_logged_in_mobile', mobile);
                currentUser = adminDoc;
                return adminDoc;
            } catch (error) {
                console.error("Supabase Admin Login error:", error);
                throw error;
            }
        },

        // --- LOGOUT ---
        logout: () => {
            currentUser = null;
            pendingMobile = null;
            localStorage.removeItem('deliverr_logged_in_mobile');

            const client = typeof db.getSupabaseClient === 'function' ? db.getSupabaseClient() : null;
            if (client && client.auth) {
                client.auth.signOut().catch(e => console.error("Supabase signout:", e));
            }

            if (isAdminPage) {
                window.location.reload();
            } else {
                window.location.hash = '';
                window.location.reload();
            }
        }
    };
})();

// Export auth if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}

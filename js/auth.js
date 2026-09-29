// Deliverr - Authentication Module (Firebase OTP & Admin Email/Password)

const auth = (() => {
    let currentUser = null;
    let confirmationResult = null; // Stores Firebase OTP confirmation result
    let pendingMobile = null; // Mobile number that OTP was sent to
    let authReadyResolve = null;
    const authReadyPromise = new Promise(resolve => { authReadyResolve = resolve; });

    const isAdminPage = window.location.pathname.includes('admin.html');

    // Helper to validate mobile number strictly
    function validateMobile(mobile) {
        const mobileRegex = /^[6789]\d{9}$/;
        if (!mobile || !mobileRegex.test(mobile)) {
            throw new Error("कृपया सही 10 अंकों का Mobile Number दर्ज करें।");
        }
    }

    // Helper to check if Firebase is initialized (only active when using Firebase)
    function checkFirebase() {
        if (CONFIG && CONFIG.databaseProvider === 'firebase') {
            if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
                throw new Error("Firebase configuration नहीं मिला। कृपया config.js जांचें।");
            }
        }
    }

    // --- SESSION INITIALIZATION ---
    function initSession() {
        // TEMPORARY_AUTH_BYPASS
        // In bypass mode, check local storage session first
        const bypassedMobile = localStorage.getItem('deliverr_logged_in_mobile');
        if (bypassedMobile) {
            db.getAdminByMobile(bypassedMobile).then(adminProfile => {
                if (adminProfile) {
                    if (adminProfile.status !== 'active') {
                        localStorage.removeItem('deliverr_logged_in_mobile');
                        currentUser = null;
                    } else {
                        currentUser = adminProfile;
                    }
                    authReadyResolve();
                } else {
                    db.getUserByMobile(bypassedMobile).then(profile => {
                        if (profile) {
                            if (profile.status === 'disabled') {
                                localStorage.removeItem('deliverr_logged_in_mobile');
                                currentUser = null;
                            } else {
                                currentUser = profile;
                            }
                        } else {
                            localStorage.removeItem('deliverr_logged_in_mobile');
                            currentUser = null;
                        }
                        authReadyResolve();
                    }).catch(err => {
                        console.error("Error loading bypassed user session:", err);
                        localStorage.removeItem('deliverr_logged_in_mobile');
                        currentUser = null;
                        authReadyResolve();
                    });
                }
            }).catch(err => {
                console.error("Error loading bypassed admin session:", err);
                localStorage.removeItem('deliverr_logged_in_mobile');
                currentUser = null;
                authReadyResolve();
            });
            return;
        }

        if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
            console.warn("⚠️ Firebase has not been initialized. Please configure CONFIG.firebase in js/config.js.");
            authReadyResolve();
            return;
        }

        // Set persistence to Local so users stay logged in across restarts
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch(err => console.error("Persistence error:", err));

        // Listen for authentication state changes
        firebase.auth().onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    let profile = await db.getUserByUid(firebaseUser.uid);

                    // Profile linking fallback: if user UID profile doesn't exist, search by mobile
                    if (!profile) {
                        const mobile = firebaseUser.phoneNumber ? firebaseUser.phoneNumber.replace('+91', '') : '';
                        if (mobile) {
                            const profileByMobile = await db.getUserByMobile(mobile);
                            if (profileByMobile) {
                                // Pre-created profile exists by mobile. Link it to their Firebase UID.
                                profile = { ...profileByMobile, uid: firebaseUser.uid };
                                await db.createUserProfile(firebaseUser.uid, profile);
                                // Delete old document if it had a different ID (e.g. mobile or temp string)
                                if (profileByMobile.uid !== firebaseUser.uid) {
                                    await db.deleteUserDoc(profileByMobile.uid);
                                }
                            }
                        }
                    }

                    // Admin view requires 'admin' role
                    if (profile) {
                        if (profile.status === 'disabled') {
                            await firebase.auth().signOut();
                            currentUser = null;
                        } else {
                            currentUser = profile;
                        }
                    } else {
                        // User exists in Auth but has not completed registration profile yet
                        currentUser = null;
                        pendingMobile = firebaseUser.phoneNumber ? firebaseUser.phoneNumber.replace('+91', '') : null;
                    }
                } catch (err) {
                    console.error("Error fetching user profile on auth state change:", err);
                    currentUser = null;
                }
            } else {
                currentUser = null;
            }
            authReadyResolve();
        });
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

        // --- SEND OTP (TEMPORARY_AUTH_BYPASS enabled) ---
        sendOTP: async (mobile) => {
            // Strict 10-digit mobile number validation before database query
            validateMobile(mobile);
            pendingMobile = mobile;

            // TEMPORARY_AUTH_BYPASS: Disable real OTP verification and query Firestore directly
            try {
                const profile = await db.getUserByMobile(mobile);
                if (profile) {
                    // Existing User: save local session key, set user, and redirect
                    localStorage.setItem('deliverr_logged_in_mobile', mobile);
                    currentUser = profile;
                    return { isExistingUser: true, user: profile };
                }
                // New User: redirect to profile form
                return { isExistingUser: false };
            } catch (err) {
                console.error("OTP send bypass error:", err);
                throw err; // propagates data integrity error or connection error to UI
            }
        },

        // --- RESEND OTP (Bypassed) ---
        resendOTP: async () => {
            throw new Error("OTP Verification अस्थाई रूप से बंद है।");
        },

        // --- RESET AUTH FLOW (Bypassed) ---
        resetAuthFlow: () => {
            confirmationResult = null;
            pendingMobile = null;
        },

        // --- VERIFY OTP (Bypassed) ---
        verifyOTP: async (otpCode) => {
            throw new Error("OTP Verification अस्थाई रूप से बंद है।");
        },

        // --- COMPLETE PROFILE (New Customer - TEMPORARY_AUTH_BYPASS enabled) ---
        completeProfile: async (profileData) => {
            if (!pendingMobile) throw new Error("Registration Error: Mobile Number नहीं मिला।");
            
            // Validate mobile number
            validateMobile(pendingMobile);

            // Check if exactly one customer already exists to prevent duplicate profiles
            const existingProfile = await db.getUserByMobile(pendingMobile);
            if (existingProfile) {
                localStorage.setItem('deliverr_logged_in_mobile', pendingMobile);
                currentUser = existingProfile;
                return existingProfile;
            }

            // TEMPORARY_AUTH_BYPASS
            // Generate usr_{mobile} as the document ID for Firestore
            const uid = "usr_" + pendingMobile;

            const fullProfile = {
                uid: uid,
                shopName: profileData.shopName.trim(),
                ownerName: profileData.ownerName.trim(),
                mobile: pendingMobile,
                village: profileData.village.trim(),
                pincode: profileData.pincode.trim(),
                villageArea: profileData.village.trim() + " (PIN: " + profileData.pincode.trim() + ")", // fallback compatibility
                area: "",
                landmark: profileData.landmark ? profileData.landmark.trim() : "",
                role: "customer",
                status: "active"
            };

            // Validate fields
            if (!fullProfile.shopName) throw new Error("Shop का नाम (Shop Name) भरना ज़रूरी है।");
            if (!fullProfile.ownerName) throw new Error("मालिक का नाम (Owner Name) भरना ज़रूरी है।");
            if (!fullProfile.village) throw new Error("गांव का नाम (Village/Area) भरना ज़रूरी है।");
            if (!fullProfile.pincode) throw new Error("PIN Code भरना ज़रूरी है।");

            const user = await db.createUserProfile(uid, fullProfile);
            
            // Persist session locally
            localStorage.setItem('deliverr_logged_in_mobile', pendingMobile);
            currentUser = user;
            return user;
        },

        // --- ADMIN LOGIN (Mobile + Password, admin.html only) ---
        adminLogin: async (mobile, password) => {
            checkFirebase();
            if (!mobile || mobile.length !== 10 || !/^[6789]\d{9}$/.test(mobile)) {
                throw new Error("कृपया सही 10 अंकों का Mobile Number दर्ज करें।");
            }
            if (!password || password.length < 6) {
                throw new Error("Password कम से कम 6 characters का होना चाहिए।");
            }
 
            try {
                // Fetch admin document from the 'admins' collection in Firestore
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

                // Persist session locally
                localStorage.setItem('deliverr_logged_in_mobile', mobile);
                currentUser = adminDoc;
                return adminDoc;
            } catch (error) {
                console.error("Admin Mobile login error:", error);
                throw error;
            }
        },

        // --- LOGOUT ---
        logout: () => {
            currentUser = null;
            confirmationResult = null;
            pendingMobile = null;

            // TEMPORARY_AUTH_BYPASS
            localStorage.removeItem('deliverr_logged_in_mobile');

            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                firebase.auth().signOut().catch(err => console.error("Firebase SignOut error:", err));
            }

            if (isAdminPage) {
                window.location.reload();
            } else {
                window.location.hash = '#landing';
            }
        }
    };
})();

// Export auth if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}

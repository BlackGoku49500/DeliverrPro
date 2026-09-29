// Deliverr - Main Application Orchestrator & Router

const app = (() => {
    let closingTimeStr = CONFIG.defaultClosingTime; // Default e.g. "21:00"
    let timerInterval = null;
    let isClosed = false;
    let resendTimerInterval = null; // For OTP resend countdown

    // Detect if we are on the Admin Portal page
    const isAdminPage = window.location.pathname.includes('admin.html');

    // --- VIEW ROUTING (SPA Router) ---
    function router() {
        const hash = window.location.hash || (isAdminPage ? '#dashboard' : '#landing');
        const user = auth.getCurrentUser();

        // Clean up active subscriptions if moving away from admin views
        if (typeof admin !== 'undefined' && typeof admin.cleanup === 'function') {
            admin.cleanup();
        }

        // Hide all views first
        const views = ['view-landing', 'view-auth', 'view-customer', 'view-admin'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.style.display = 'none';
        });

        if (isAdminPage) {
            // --- ADMIN PORTAL ROUTING ---
            if (!user || user.role !== 'admin') {
                if (user && user.role !== 'admin') {
                    // Logged in user is not admin! Logout to protect page
                    auth.logout();
                    showNotification("पहुंच अस्वीकृत ❌", "यह पोर्टल सिर्फ Admin के लिए है!", "error");
                    return;
                }
                // Not logged in as Admin -> Show Admin Login
                document.getElementById('view-auth').style.display = 'block';
                updateNavState('auth');
                stopCountdownTimer();
            } else {
                // Logged in as Admin -> Show Admin Dashboard
                document.getElementById('view-admin').style.display = 'block';
                admin.init();
                admin.loadTimeSettings();
                updateNavState('admin');
                stopCountdownTimer();
            }
        } else {
            // --- CUSTOMER PORTAL ROUTING ---
            if (hash === '#customer') {
                if (!user) {
                    window.location.hash = '#login';
                    return;
                }
                if (user.role === 'admin') {
                    // Admins should not access customer dashboard here, redirect to admin.html
                    window.location.href = 'admin.html';
                    return;
                }
                document.getElementById('view-customer').style.display = 'block';
                customer.loadDashboardData();
                customer.loadCatalog();
                updateNavState('customer');
                startCountdownTimer();
                loadBroadcastBanners();
            } 
            else if (hash === '#login' || hash === '#register') {
                if (user) {
                    if (user.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.hash = '#customer';
                    }
                    return;
                }
                document.getElementById('view-auth').style.display = 'block';
                // Show step 1 (mobile entry) by default
                showOTPStep('mobile');
                updateNavState('auth');
            }
            else if (hash === '#complete-profile') {
                // New user needs to complete profile
                document.getElementById('view-auth').style.display = 'block';
                showOTPStep('profile');
                updateNavState('auth');
            }
            else { // Default landing
                if (user && user.role === 'customer') {
                    // If user is already logged in, go directly to dashboard
                    window.location.hash = '#customer';
                    return;
                }
                document.getElementById('view-landing').style.display = 'block';
                updateNavState('landing');
                stopCountdownTimer();
            }
        }

        // Scroll to top on route change
        window.scrollTo(0, 0);
    }

    // --- OTP STEP MANAGEMENT ---
    function showOTPStep(step) {
        const stepMobile = document.getElementById('otp-step-mobile');
        const stepVerify = document.getElementById('otp-step-verify');
        const stepProfile = document.getElementById('otp-step-profile');

        if (stepMobile) stepMobile.classList.remove('active');
        if (stepVerify) stepVerify.classList.remove('active');
        if (stepProfile) stepProfile.classList.remove('active');

        if (step === 'mobile' && stepMobile) {
            stepMobile.classList.add('active');
        } else if (step === 'verify' && stepVerify) {
            stepVerify.classList.add('active');
        } else if (step === 'profile' && stepProfile) {
            stepProfile.classList.add('active');
        }
    }

    // --- RESEND OTP COUNTDOWN (30 seconds) ---
    function startResendCountdown() {
        const resendBtn = document.getElementById('btn-resend-otp');
        const resendText = document.getElementById('resend-timer-text');
        if (!resendBtn || !resendText) return;

        let seconds = 30;
        resendBtn.disabled = true;
        resendText.textContent = `${seconds}s में दोबारा भेजें`;

        if (resendTimerInterval) clearInterval(resendTimerInterval);

        resendTimerInterval = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(resendTimerInterval);
                resendTimerInterval = null;
                resendBtn.disabled = false;
                resendText.textContent = `OTP दोबारा भेजें`;
            } else {
                resendText.textContent = `${seconds}s में दोबारा भेजें`;
            }
        }, 1000);
    }

    // --- NAV STATE MANAGER (HINDI FOR CUSTOMERS) ---
    function updateNavState(activeView) {
        const navLinks = document.getElementById('nav-links-container');
        if (!navLinks) return;

        const user = auth.getCurrentUser();

        if (isAdminPage) {
            if (user && user.role === 'admin') {
                navLinks.innerHTML = `
                    <span style="font-weight:600; color:var(--dark-color); margin-right:10px;">Hello, Admin</span>
                    <button class="btn btn-primary btn-action" onclick="auth.logout()">
                        <i class="fa-solid fa-sign-out-alt"></i> Logout
                    </button>
                `;
            } else {
                navLinks.innerHTML = `<span style="font-weight:600; color:var(--text-muted);">Operations Center</span>`;
            }
        } else {
            if (user) {
                navLinks.innerHTML = `
                    <a href="#customer" class="nav-link ${activeView==='customer'?'active':''}">Order करें</a>
                    <button class="btn btn-primary" onclick="auth.logout()">
                        <i class="fa-solid fa-sign-out-alt"></i> Logout (${user.ownerName.split(' ')[0]})
                    </button>
                `;
            } else {
                navLinks.innerHTML = `
                    <a href="#landing" class="nav-link">Home</a>
                    <a href="#landing#features" class="nav-link">कैसे काम करता है?</a>
                    <a href="#login" class="btn btn-primary">
                        <i class="fa-solid fa-user"></i> Login
                    </a>
                `;
            }
        }
    }

    // --- ORDER TIME WINDOW & COUNTDOWN (HINDI) ---
    async function updateClosingTime() {
        try {
            const settings = await db.getSettings();
            closingTimeStr = settings.orderClosingTime;
        } catch (e) {
            console.error("Error fetching closing time setting: ", e);
        }
    }

    function startCountdownTimer() {
        stopCountdownTimer();
        updateCountdown(); // Run immediately
        timerInterval = setInterval(updateCountdown, 1000);
    }

    function stopCountdownTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateCountdown() {
        const timerText = document.getElementById('countdown-timer-text');
        const warningBanner = document.getElementById('order-warning-banner');
        if (!timerText) return;

        const now = new Date();
        const [closeHours, closeMinutes] = closingTimeStr.split(':').map(Number);
        
        const closeTime = new Date();
        closeTime.setHours(closeHours, closeMinutes, 0, 0);

        let diffMs = closeTime - now;

        // If current time is past closing time, check if it's before midnight (reset)
        if (diffMs < 0) {
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            
            if (now < midnight) {
                isClosed = true;
                timerText.textContent = "आज के Order बंद हो चुके हैं। 🔒";
                if (warningBanner) {
                    warningBanner.className = "warning-banner warning-red active";
                    warningBanner.innerHTML = `<i class="fa-solid fa-lock"></i> आज के Order बंद हो गए हैं। कल फिर Order कर सकते हैं।`;
                }
                toggleOrderButtons(false);
                return;
            } else {
                isClosed = false;
                diffMs = (closeTime.getTime() + 24 * 60 * 60 * 1000) - now.getTime();
            }
        }

        isClosed = false;
        toggleOrderButtons(true);

        const hrs = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

        const timeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        timerText.innerHTML = `Order बंद होने में समय बचा है: <strong>${timeStr}</strong> ⏳`;

        const totalMinutesLeft = hrs * 60 + mins;

        if (warningBanner) {
            if (totalMinutesLeft < 10) {
                warningBanner.className = "warning-banner warning-red active";
                warningBanner.innerHTML = `<i class="fa-solid fa-circle-exclamation fa-beat"></i> <strong>ALERT:</strong> सिर्फ ${totalMinutesLeft} मिनट बचे हैं! जल्दी अपना Order Submit करें।`;
                timerText.style.color = "var(--primary-color)";
            } else if (totalMinutesLeft < 30) {
                warningBanner.className = "warning-banner warning-orange active";
                warningBanner.innerHTML = `<i class="fa-solid fa-clock"></i> <strong>ध्यान दें:</strong> Order बंद होने में सिर्फ ${totalMinutesLeft} मिनट बचे हैं।`;
                timerText.style.color = "var(--secondary-color)";
            } else {
                warningBanner.className = "warning-banner";
                timerText.style.color = "inherit";
            }
        }
    }

    function toggleOrderButtons(isEnabled) {
        const checkoutBtn = document.getElementById('btn-checkout-cart');
        if (checkoutBtn) {
            checkoutBtn.disabled = !isEnabled;
            if (!isEnabled) {
                checkoutBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Order बंद हो चुका है`;
                checkoutBtn.style.background = 'var(--text-muted)';
            } else {
                checkoutBtn.innerHTML = `Order Submit करें (Payment) <i class="fa-solid fa-arrow-right"></i>`;
                checkoutBtn.style.background = 'var(--primary-gradient)';
            }
        }
    }

    // --- BROADCAST BANNER & ACKNOWLEDGEMENT (HINDI) ---
    async function loadBroadcastBanners() {
        const bannerContainer = document.getElementById('broadcast-banners-area');
        if (!bannerContainer) return;

        try {
            const broadcasts = await db.getBroadcasts();
            const now = new Date();

            const activeBc = broadcasts.filter(b => new Date(b.expiryDate) > now);

            if (activeBc.length === 0) {
                bannerContainer.innerHTML = '';
                return;
            }

            const urgentBc = activeBc.find(b => b.priority === 'urgent');

            if (urgentBc) {
                const isAcked = sessionStorage.getItem(`acked_bc_${urgentBc.id}`);
                if (!isAcked) {
                    showUrgentBroadcastModal(urgentBc);
                }
            }

            bannerContainer.innerHTML = activeBc.map(b => {
                const priorityText = b.priority === 'urgent' ? 'Urgent Alert' : (b.priority === 'important' ? 'Important' : 'Update');
                return `
                    <div class="broadcast-banner-strip bc-priority-${b.priority}">
                        <span class="bc-strip-title"><i class="fa-solid fa-bullhorn"></i> ${priorityText}:</span>
                        <span class="bc-strip-message">${b.message}</span>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error("Error loading broadcasts: ", error);
        }
    }

    function showUrgentBroadcastModal(bc) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'urgent-broadcast-modal';
        modal.style.zIndex = "3000";
        modal.innerHTML = `
            <div class="modal-card text-center border-urgent" style="border-top: 6px solid var(--primary-color);">
                <div class="urgent-bc-icon"><i class="fa-solid fa-triangle-exclamation fa-beat"></i></div>
                <h2 style="margin-top: 15px; color: var(--primary-color); font-family: 'Noto Sans Devanagari', sans-serif;">Urgent Alert!</h2>
                <h3 style="margin-top: 10px;">${bc.title}</h3>
                <p class="form-subtext" style="font-size: 1.1rem; color: var(--dark-color); margin-top: 15px; line-height: 1.5;">
                    "${bc.message}"
                </p>
                
                <button class="btn btn-primary btn-block" style="margin-top: 30px;" id="btn-ack-broadcast">
                    <i class="fa-solid fa-check-double"></i> हाँ, मैं समझ गया
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-ack-broadcast').addEventListener('click', () => {
            sessionStorage.setItem(`acked_bc_${bc.id}`, "true");
            modal.remove();
            showNotification("Notification स्वीकृत! 👍", "अब आप Order place कर सकते हैं।", "success");
        });
    }

    // --- TOAST NOTIFICATIONS (HINDI COMPATIBLE) ---
    function showNotification(title, message, type = "success") {
        const toast = document.getElementById('toast-notification');
        const toastTitle = document.getElementById('toast-title');
        const toastBody = document.getElementById('toast-body');
        const toastIcon = document.querySelector('.toast-icon');

        if (!toast || !toastTitle || !toastBody) return;

        toastTitle.textContent = title;
        toastBody.textContent = message;

        if (type === "success") {
            toast.style.borderLeftColor = "var(--success-color)";
            toastIcon.className = "fa-solid fa-circle-check toast-icon";
            toastIcon.style.color = "var(--success-color)";
        } else if (type === "warning") {
            toast.style.borderLeftColor = "var(--secondary-color)";
            toastIcon.className = "fa-solid fa-triangle-exclamation toast-icon";
            toastIcon.style.color = "var(--secondary-color)";
        } else if (type === "error") {
            toast.style.borderLeftColor = "var(--primary-color)";
            toastIcon.className = "fa-solid fa-circle-xmark toast-icon";
            toastIcon.style.color = "var(--primary-color)";
        }

        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // --- SETUP GLOBAL EVENT LISTENERS ---
    function setupEventListeners() {
        // --- OTP FLOW EVENT LISTENERS (Customer page only) ---
        const otpMobileForm = document.getElementById('otp-step-mobile');
        const otpVerifyForm = document.getElementById('otp-step-verify');
        const otpProfileForm = document.getElementById('otp-step-profile');

        // Step 1: Send OTP
        if (otpMobileForm) {
            otpMobileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mobile = document.getElementById('otp-mobile-input').value.trim();

                // Strict 10-digit mobile number validation before database query
                const mobileRegex = /^[6789]\d{9}$/;
                if (!mobileRegex.test(mobile)) {
                    showNotification("Error ❌", "कृपया सही 10 अंकों का Mobile Number दर्ज करें।", "error");
                    return;
                }

                const submitBtn = otpMobileForm.querySelector('button[type="submit"]');
                const origText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
                submitBtn.disabled = true;

                try {
                    // TEMPORARY_AUTH_BYPASS
                    const result = await auth.sendOTP(mobile);
                    if (result && result.isExistingUser) {
                        showNotification("Login सफल! 👋", `नमस्ते ${result.user.ownerName.split(' ')[0]}!`);
                        window.location.hash = '#customer';
                        return;
                    }
                    // New User: Skip OTP verification step and go straight to Profile completion
                    document.getElementById('otp-display-mobile').textContent = mobile;
                    showOTPStep('profile');
                    showNotification("Mobile Number Verify हो गया! ✅", "कृपया अपनी Profile Details भरें।");
                } catch (err) {
                    console.error("Login send error:", err);
                    let msg = err.message;
                    if (!navigator.onLine) {
                        msg = "Internet चालू करके दोबारा कोशिश करें।";
                    }
                    showNotification("Error ❌", msg, "error");
                } finally {
                    submitBtn.innerHTML = origText;
                    submitBtn.disabled = false;
                }
            });
        }

        // Step 2: Verify OTP
        if (otpVerifyForm) {
            otpVerifyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const otpCode = document.getElementById('otp-code-input').value.trim();

                const submitBtn = otpVerifyForm.querySelector('button[type="submit"]');
                const origText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verify हो रहा है...';
                submitBtn.disabled = true;

                try {
                    const result = await auth.verifyOTP(otpCode);

                    if (result.isNewUser) {
                        // New user — show profile completion form
                        showNotification("Mobile Number Verify हो गया! ✅", "कृपया अपनी Profile Details भरें।");
                        showOTPStep('profile');
                    } else {
                        // Existing user — go to dashboard
                        showNotification("Login सफल! 👋", `नमस्ते ${result.user.ownerName.split(' ')[0]}!`);
                        window.location.hash = '#customer';
                    }
                } catch (err) {
                    console.error("OTP verify error:", err);
                    let msg = "OTP Verify करने में समस्या हुई।";
                    if (err.code === 'auth/invalid-verification-code' || err.message.toLowerCase().includes("code") || err.message.toLowerCase().includes("otp")) {
                        msg = "OTP सही नहीं है। फिर से कोशिश करें।";
                    }
                    if (!navigator.onLine) {
                        msg = "Internet चालू करके दोबारा कोशिश करें।";
                    }
                    showNotification("Error ❌", msg, "error");
                } finally {
                    submitBtn.innerHTML = origText;
                    submitBtn.disabled = false;
                }
            });
        }

        // Resend OTP button
        const resendBtn = document.getElementById('btn-resend-otp');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                resendBtn.disabled = true;
                try {
                    await auth.resendOTP();
                    showNotification("OTP Resend किया! 📱", "नया OTP कोड आपके Mobile Number पर भेज दिया गया है।");
                    startResendCountdown();
                } catch (err) {
                    showNotification("गलती ❌", err.message, "error");
                    resendBtn.disabled = false;
                }
            });
        }

        // Change Mobile Number button
        const changeNumberBtn = document.getElementById('btn-change-number');
        if (changeNumberBtn) {
            changeNumberBtn.addEventListener('click', () => {
                auth.resetAuthFlow();
                document.getElementById('otp-mobile-input').value = '';
                document.getElementById('otp-code-input').value = '';
                showOTPStep('mobile');
                // Clear resend timer
                if (resendTimerInterval) {
                    clearInterval(resendTimerInterval);
                    resendTimerInterval = null;
                }
            });
        }

        // Step 3: Complete Profile
        if (otpProfileForm) {
            otpProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const submitBtn = otpProfileForm.querySelector('button[type="submit"]');
                const origText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> सेव हो रहा है...';
                submitBtn.disabled = true;

                try {
                    const enteredPincode = document.getElementById('profile-pincode').value.trim();

                    // TEMPORARY_AUTH_BYPASS
                    // Service area validation: Only PIN Code 121103 is allowed. Reject every other PIN.
                    if (enteredPincode !== "121103") {
                        throw new Error("हमारी Delivery अभी सिर्फ Hathin (PIN: 121103) में उपलब्ध है।");
                    }

                    const profileData = {
                        shopName: document.getElementById('profile-shop').value,
                        ownerName: document.getElementById('profile-owner').value,
                        village: document.getElementById('profile-village').value,
                        pincode: enteredPincode,
                        landmark: document.getElementById('profile-landmark').value
                    };

                    const user = await auth.completeProfile(profileData);
                    showNotification("Profile Save हो गई! 🎉", `नमस्ते ${user.ownerName.split(' ')[0]}!`);
                    window.location.hash = '#customer';
                } catch (err) {
                    showNotification("Registration failed ❌", err.message, "error");
                } finally {
                    submitBtn.innerHTML = origText;
                    submitBtn.disabled = false;
                }
            });
        }

        // --- ADMIN LOGIN (Mobile + Password, admin.html only) ---
        const adminLoginForm = document.getElementById('page-login-form');
        if (adminLoginForm && isAdminPage) {
            adminLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mobile = document.getElementById('page-login-mobile').value.trim();
                const pass = document.getElementById('page-login-pass').value.trim();
                
                const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
                const origText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Login ho raha hai...';
                submitBtn.disabled = true;

                try {
                    const user = await auth.adminLogin(mobile, pass);
                    showNotification("Login सफल! 🛠️", "Dashboard खुल रहा है...");
                    window.location.hash = '#dashboard';
                    router();
                } catch (err) {
                    console.error("Admin login click error:", err);
                    let msg = err.message;
                    if (!navigator.onLine) {
                        msg = "Internet चालू करके दोबारा कोशिश करें।";
                    }
                    showNotification("Error ❌", msg, "error");
                } finally {
                    submitBtn.innerHTML = origText;
                    submitBtn.disabled = false;
                }
            });
        }

        // Catalog Filter and Search
        const searchInput = document.getElementById('catalog-search');
        const catSelect = document.getElementById('catalog-category');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                customer.loadCatalog(e.target.value, catSelect ? catSelect.value : "");
            });
        }

        if (catSelect) {
            catSelect.addEventListener('change', (e) => {
                customer.loadCatalog(searchInput ? searchInput.value : "", e.target.value);
            });
        }

        // Cart Slide-out Controls
        const cartModal = document.getElementById('cart-modal');
        const openCartBtn = document.getElementById('floating-cart-bar');
        const closeCartBtn = document.getElementById('close-cart-btn');

        if (openCartBtn && cartModal) {
            openCartBtn.addEventListener('click', () => cartModal.classList.add('active'));
        }
        if (closeCartBtn && cartModal) {
            closeCartBtn.addEventListener('click', () => cartModal.classList.remove('active'));
        }

        // Admin Broadcast Submission
        const bcForm = document.getElementById('bc-form');
        if (bcForm) {
            bcForm.addEventListener('submit', admin.submitBroadcast);
        }
    }

    function updateOnlineStatus() {
        const offlineBanner = document.getElementById('offline-banner');
        const sendOtpBtn = document.getElementById('btn-send-otp');
        const checkoutBtn = document.getElementById('btn-checkout-cart');

        if (!offlineBanner) return;

        if (navigator.onLine) {
            offlineBanner.style.display = 'none';
            if (sendOtpBtn) sendOtpBtn.disabled = false;
            if (checkoutBtn && !isClosed) {
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> 💳 Payment करें';
            }
        } else {
            offlineBanner.style.display = 'block';
            if (sendOtpBtn) sendOtpBtn.disabled = true;
            if (checkoutBtn) {
                checkoutBtn.disabled = true;
                checkoutBtn.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> Internet बंद है';
            }
            showNotification("Internet बंद ❌", "Internet चालू करके दोबारा कोशिश करें।", "error");
        }
    }

    // --- RUN APPLICATION ---
    async function init() {
        // Connection status listeners
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        
        auth.init();
        updateClosingTime();
        setupEventListeners();
        updateOnlineStatus(); // Check immediately

        // Wait for auth state to be determined before routing
        await auth.whenReady();

        // Listen for route changes
        window.addEventListener('hashchange', router);
        
        // Initial route trigger
        router();
    }

    return {
        init: init,
        showNotification: showNotification,
        checkIfOrderClosed: () => isClosed,
        updateClosingTime: updateClosingTime
    };
})();

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', app.init);

// Deliverr - Configuration File

const CONFIG = {
    // Active Database Provider: "supabase" | "firebase"
    databaseProvider: "supabase",

    // 1. Supabase Configuration
    // Paste your Supabase project URL and anon/public key here
    supabase: {
        url: "https://gbbstntdisgppwttajjn.supabase.co",
        anonKey: "sb_publishable_J4Yqh0okMQ5tmszZ-ggW2g_UKDD19P3"
    },

    // 2. Firebase Configuration (Archived / Inactive - preserved for fallback)
    firebase: {
        apiKey: "",
        authDomain: "",
        projectId: "deliverr-c7900",
        storageBucket: "deliverr-c7900.firebasestorage.app",
        messagingSenderId: "1018867296999",
        appId: "1:1018867296999:web:4ed3aaff83c5d2f6ab9042",
        measurementId: "G-WW9Q1WDKZL"
    },

    // 3. Razorpay Configuration
    // Paste your Razorpay Key ID here for online payments (e.g. "rzp_test_xxxxxxxxx")
    razorpayKeyId: "rzp_test_default_key",

    // 4. App Settings
    defaultClosingTime: "21:00", // Default 9:00 PM

    // 5. Mode Selection
    // If database credentials are empty, the app automatically runs in "MOCK" mode (using LocalStorage).
    // This allows you to test the entire application instantly without any setup!
    get useMockMode() {
        if (this.databaseProvider === 'supabase') {
            return !this.supabase.url || this.supabase.url.trim() === "" || !this.supabase.anonKey || this.supabase.anonKey.trim() === "";
        }
        return !this.firebase.apiKey || this.firebase.apiKey.trim() === "";
    }
};

// Export config if using modules, otherwise it will be available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// ==========================================
// ShrinkNest Authentication
// File: js/auth.js
// ==========================================

import {
    auth,
    db,
    provider
} from "./firebase-config.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    signOut,
    updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ==========================================
// HELPER: FRIENDLY FIREBASE AUTH ERRORS
// ==========================================

export function getFriendlyAuthErrorMessage(error) {
    if (!error) return "An unknown error occurred.";
    const code = error.code || "";
    const msg = error.message || "";

    switch (code) {
        case "auth/email-already-in-use":
            return "An account with this email already exists. Please log in.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/weak-password":
            return "Password is too weak. Please use at least 6 characters.";
        case "auth/user-not-found":
            return "No account found with this email.";
        case "auth/wrong-password":
            return "Incorrect password. Please try again.";
        case "auth/invalid-credential":
            return "Invalid email or password. Please check your credentials.";
        case "auth/operation-not-allowed":
            return "This sign-in method is disabled in Firebase Console.";
        case "auth/popup-closed-by-user":
            return "Google sign-in popup was closed before completing.";
        case "auth/popup-blocked":
            return "Google sign-in popup was blocked by your browser. Please allow popups for this site.";
        case "auth/cancelled-popup-request":
            return "Google sign-in popup was cancelled.";
        case "auth/account-exists-with-different-credential":
            return "An account already exists with the same email address but different sign-in credentials.";
        case "auth/unauthorized-domain":
            return "Domain not authorized in Firebase Console (Authentication > Settings > Authorized Domains).";
        case "auth/network-request-failed":
            return "Network error. Please check your internet connection.";
        default:
            if (msg.includes("auth/")) {
                const match = msg.match(/auth\/[a-zA-Z0-9-]+/);
                if (match) return `Authentication error (${match[0]}). Check Firebase Console settings.`;
            }
            return msg || "Authentication failed.";
    }
}

// ==========================================
// SIGN UP
// ==========================================

export async function signup(name, email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;

        // Try updating profile display name
        try {
            await updateProfile(user, { displayName: name });
        } catch (pErr) {
            console.warn("Failed to update profile display name:", pErr);
        }

        // Try creating Firestore user doc (non-blocking for auth)
        try {
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                photoURL: user.photoURL || "",
                createdAt: new Date().toISOString()
            });
        } catch (dbErr) {
            console.warn("Firestore user document creation failed (non-critical):", dbErr);
        }

        return {
            success: true,
            message: "Account created successfully."
        };

    } catch (error) {
        console.error("Signup Error:", error);
        return {
            success: false,
            code: error.code,
            message: getFriendlyAuthErrorMessage(error)
        };
    }
}

// ==========================================
// LOGIN
// ==========================================

export async function login(email, password) {
    try {
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        return {
            success: true,
            message: "Login successful."
        };

    } catch (error) {
        console.error("Login Error:", error);
        return {
            success: false,
            code: error.code,
            message: getFriendlyAuthErrorMessage(error)
        };
    }
}

// ==========================================
// GOOGLE LOGIN (popup-based — instant)
// ==========================================

export async function googleLogin() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Non-blocking Firestore user doc creation/update
        try {
            const userRef = doc(db, "users", user.uid);
            const snapshot = await getDoc(userRef);
            if (!snapshot.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    name: user.displayName || "User",
                    email: user.email,
                    photoURL: user.photoURL || "",
                    createdAt: new Date().toISOString()
                });
            }
        } catch (dbError) {
            console.warn("Firestore user lookup/creation failed (non-critical):", dbError);
        }

        return { success: true, message: "Google login successful." };

    } catch (error) {
        console.error("Google Login Error:", error);
        return {
            success: false,
            code: error.code,
            message: getFriendlyAuthErrorMessage(error)
        };
    }
}

// ==========================================
// HANDLE GOOGLE REDIRECT RESULT
// ==========================================

export async function handleRedirectResult() {
    return { success: false, message: "No redirect result." };
}

// ==========================================
// FORGOT PASSWORD
// ==========================================

export async function forgotPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return {
            success: true,
            message: "Password reset email sent successfully."
        };
    } catch (error) {
        console.error("Forgot Password Error:", error);
        return {
            success: false,
            code: error.code,
            message: getFriendlyAuthErrorMessage(error)
        };
    }
}

// ==========================================
// LOGOUT
// ==========================================

export async function logout() {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

// ==========================================
// AUTH STATE LISTENER
// ==========================================

export function observeAuth(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let userData = {};
            try {
                const userRef = doc(db, "users", user.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    userData = snap.data();
                }
            } catch (err) {
                console.warn("Could not fetch user profile from Firestore:", err);
            }

            callback({
                loggedIn: true,
                user: user,
                profile: userData
            });
        } else {
            callback({
                loggedIn: false,
                user: null,
                profile: null
            });
        }
    });
}

// ==========================================
// PROTECTED PAGE CHECK
// ==========================================

export function protectPage() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "login.html";
        }
    });
}

// ==========================================
// GET CURRENT USER
// ==========================================

export function getCurrentUser() {
    return auth.currentUser;
}

// ==========================================
// EMAIL VALIDATION
// ==========================================

export function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ==========================================
// PASSWORD STRENGTH
// ==========================================

export function checkPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
        return {
            score,
            label: "Weak",
            color: "#ff4d4f"
        };
    }

    if (score === 3 || score === 4) {
        return {
            score,
            label: "Medium",
            color: "#faad14"
        };
    }

    return {
        score,
        label: "Strong",
        color: "#52c41a"
    };
}

// ==========================================
// FORM VALIDATION
// ==========================================

export function validateSignupForm(data) {
    const errors = {};

    if (!data.name || data.name.trim().length < 2) {
        errors.name = "Name must contain at least 2 characters.";
    }

    if (!validateEmail(data.email)) {
        errors.email = "Please enter a valid email address.";
    }

    if (!data.password || data.password.length < 6) {
        errors.password = "Password must be at least 6 characters.";
    }

    if (data.password !== data.confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

export function validateLoginForm(data) {
    const errors = {};

    if (!validateEmail(data.email)) {
        errors.email = "Invalid email address.";
    }

    if (!data.password) {
        errors.password = "Password is required.";
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

// ==========================================
// NAVBAR AUTH BUTTONS
// ==========================================

export function updateNavbarAuth() {
    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const dashboardBtn = document.getElementById("dashboardBtn");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (loginBtn) loginBtn.style.display = "none";
            if (signupBtn) signupBtn.style.display = "none";
            if (dashboardBtn) dashboardBtn.style.display = "inline-flex";
        } else {
            if (loginBtn) loginBtn.style.display = "inline-flex";
            if (signupBtn) signupBtn.style.display = "inline-flex";
            if (dashboardBtn) dashboardBtn.style.display = "none";
        }
    });
}

// ==========================================
// DISPLAY USER INFO
// ==========================================

export function displayUserInfo() {
    onAuthStateChanged(auth, (user) => {
        if (!user) return;

        const nameElement = document.getElementById("userName");
        const photoElement = document.getElementById("userPhoto");

        if (nameElement) {
            nameElement.textContent = user.displayName || "User";
        }

        if (photoElement) {
            const defaultAvatar = "assets/images/default-avatar.svg";
            photoElement.setAttribute("referrerpolicy", "no-referrer");
            photoElement.alt = "";
            photoElement.src = user.photoURL || defaultAvatar;
            photoElement.onerror = function() {
                this.onerror = null;
                this.src = defaultAvatar;
            };
        }
    });
}

// ==========================================
// UPDATE USER PROFILE PHOTO
// ==========================================

export async function updateUserPhoto(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            try {
                const user = auth.currentUser;
                if (!user) {
                    resolve({ success: false, message: "Not logged in." });
                    return;
                }

                try {
                    const userRef = doc(db, "users", user.uid);
                    await updateDoc(userRef, { photoURL: base64 });
                } catch (dbErr) {
                    console.warn("Firestore photo update failed:", dbErr);
                }

                await updateProfile(user, { photoURL: base64 });
                resolve({ success: true, photoURL: base64 });
            } catch (err) {
                resolve({ success: false, message: err.message });
            }
        };
        reader.readAsDataURL(file);
    });
}

// ==========================================
// REDIRECT IF ALREADY LOGGED IN
// ==========================================

export function redirectIfLoggedIn() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = "index.html";
        }
    });
}

// ==========================================
// INITIALIZE AUTH
// ==========================================

export function initializeAuth() {
    updateNavbarAuth();
}

// ==========================================
// GLOBAL HELPERS (OPTIONAL)
// ==========================================

window.ShrinkNestAuth = {
    signup,
    login,
    googleLogin,
    handleRedirectResult,
    forgotPassword,
    logout,
    observeAuth,
    protectPage,
    getCurrentUser,
    validateEmail,
    validateSignupForm,
    validateLoginForm,
    checkPasswordStrength,
    updateNavbarAuth,
    displayUserInfo,
    updateUserPhoto,
    redirectIfLoggedIn,
    initializeAuth,
    getFriendlyAuthErrorMessage
};

// ==========================================
// AUTO INITIALIZE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    initializeAuth();
});

// ==========================================
// END OF FILE
// ==========================================
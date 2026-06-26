// ==========================================
// ShrinkNest Firebase Configuration
// File: js/firebase-config.js
// ==========================================

// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


// ==========================================
// Replace this with YOUR Firebase Config
// ==========================================

const firebaseConfig = {

    apiKey: "YOUR_API_KEY",

    authDomain: "YOUR_PROJECT.firebaseapp.com",

    projectId: "YOUR_PROJECT_ID",

    storageBucket: "YOUR_PROJECT.appspot.com",

    messagingSenderId: "YOUR_SENDER_ID",

    appId: "YOUR_APP_ID"

};


// ==========================================
// Initialize Firebase
// ==========================================

const app = initializeApp(firebaseConfig);


// ==========================================
// Authentication
// ==========================================

const auth = getAuth(app);


// ==========================================
// Google Provider
// ==========================================

const provider = new GoogleAuthProvider();

provider.setCustomParameters({

    prompt: "select_account"

});


// ==========================================
// Firestore Database
// ==========================================

const db = getFirestore(app);


// ==========================================
// Export Everything
// ==========================================

export {

    app,

    auth,

    db,

    provider

};
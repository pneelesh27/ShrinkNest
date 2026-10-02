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

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";


// ==========================================
// Replace this with YOUR Firebase Config
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyC9I2GW2JzJ67BZVKzQLgb5x2ob6nay5qY",
  authDomain: "shrinknest.web.app",
  projectId: "shrinknest",
  storageBucket: "shrinknest.firebasestorage.app",
  messagingSenderId: "505871213137",
  appId: "1:505871213137:web:432c607f996a704e87ce70",
  measurementId: "G-6C4B2FDPN3"
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
// Storage
// ==========================================

const storage = getStorage(app);


// ==========================================
// Export Everything
// ==========================================

export {

    app,

    auth,

    db,

    storage,

    provider

};
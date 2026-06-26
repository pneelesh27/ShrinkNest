// ==========================================
// SHRINKNEST NAVBAR
// File: js/navbar.js
// ==========================================

import { auth } from "./firebase-config.js";
import { logout } from "./auth.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

    const menuBtn = document.querySelector(".hamburger");
    const navLinks = document.querySelector(".nav-links");

    // Mobile Menu
    if (menuBtn && navLinks) {

        menuBtn.addEventListener("click", () => {

            navLinks.classList.toggle("active");
            menuBtn.classList.toggle("active");

        });

    }

    // Navbar Auth Buttons
    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const dashboardBtn = document.getElementById("dashboardBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    onAuthStateChanged(auth, (user) => {

        if (user) {

            if (loginBtn) loginBtn.style.display = "none";
            if (signupBtn) signupBtn.style.display = "none";
            if (dashboardBtn) dashboardBtn.style.display = "inline-flex";
            if (logoutBtn) logoutBtn.style.display = "inline-flex";

        } else {

            if (loginBtn) loginBtn.style.display = "inline-flex";
            if (signupBtn) signupBtn.style.display = "inline-flex";
            if (dashboardBtn) dashboardBtn.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "none";

        }

    });

    // Logout
    if (logoutBtn) {

        logoutBtn.addEventListener("click", async () => {

            await logout();

        });

    }

});

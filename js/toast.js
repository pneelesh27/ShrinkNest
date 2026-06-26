// ==========================================
// SHRINKNEST TOAST NOTIFICATIONS
// File: js/toast.js
// ==========================================

let toastContainer = document.getElementById("toastContainer");

if (!toastContainer) {

    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";

    toastContainer.style.position = "fixed";
    toastContainer.style.bottom = "20px";
    toastContainer.style.right = "20px";
    toastContainer.style.display = "flex";
    toastContainer.style.flexDirection = "column";
    toastContainer.style.gap = "12px";
    toastContainer.style.zIndex = "9999";

    document.body.appendChild(toastContainer);

}

// ==========================================
// SHOW TOAST
// ==========================================

export function showToast(message, type = "success") {

    const toast = document.createElement("div");

    toast.textContent = message;

    toast.style.padding = "14px 18px";
    toast.style.borderRadius = "12px";
    toast.style.color = "#fff";
    toast.style.fontWeight = "600";
    toast.style.minWidth = "250px";
    toast.style.boxShadow = "0 10px 25px rgba(0,0,0,.15)";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all .3s ease";

    switch (type) {

        case "success":
            toast.style.background = "#22c55e";
            break;

        case "error":
            toast.style.background = "#ef4444";
            break;

        case "warning":
            toast.style.background = "#f59e0b";
            break;

        case "info":
            toast.style.background = "#3b82f6";
            break;

        default:
            toast.style.background = "#6C63FF";

    }

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {

        toast.style.opacity = "1";
        toast.style.transform = "translateX(0)";

    });

    setTimeout(() => {

        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 3000);

}

// ==========================================
// SHORTCUT METHODS
// ==========================================

export const toast = {

    success(message) {

        showToast(message, "success");

    },

    error(message) {

        showToast(message, "error");

    },

    warning(message) {

        showToast(message, "warning");

    },

    info(message) {

        showToast(message, "info");

    }

};

// ==========================================
// END OF FILE
// ==========================================
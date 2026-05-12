/**
 * Reusable notification system for CCS Sit-In Monitoring
 * Provides toast notifications and success/error modals using DaisyUI components.
 */

// ─── Toast Notifications ────────────────────────────────────────
function showToast(message, type = "info", duration = 3000) {
    // Create container if not exists
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.setAttribute("popover", "manual");
        container.className = "toast toast-top toast-end bg-transparent border-none p-0 overflow-visible";
        document.body.appendChild(container);
        container.showPopover();
    }

    const typeClasses = {
        success: "alert-success",
        error: "alert-error",
        warning: "alert-warning",
        info: "alert-info",
    };

    const typeIcons = {
        success: '<i class="fa-solid fa-circle-check"></i>',
        error: '<i class="fa-solid fa-circle-xmark"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
        info: '<i class="fa-solid fa-circle-info"></i>',
    };

    const toast = document.createElement("div");
    toast.className = `alert ${typeClasses[type] || typeClasses.info} shadow-lg flex items-center gap-2 animate-slide-in-right`;
    toast.innerHTML = `${typeIcons[type] || typeIcons.info} <span class="font-medium">${message}</span>`;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ─── Success / Info Modal ───────────────────────────────────────
function showSuccessModal(title, message, redirectUrl = null, autoCloseSeconds = 0) {
    _showModal(title, message, "success", redirectUrl, autoCloseSeconds);
}

function showErrorModal(title, message) {
    _showModal(title, message, "error");
}

function _showModal(title, message, type, redirectUrl = null, autoCloseSeconds = 0) {
    // Remove existing notification modal if any
    const existing = document.getElementById("notify-modal");
    if (existing) {
        if (existing._autoCloseTimer) clearInterval(existing._autoCloseTimer);
        existing.remove();
    }

    const iconMap = {
        success:
            '<div class="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-circle-check text-success text-3xl"></i></div>',
        error: '<div class="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-circle-xmark text-error text-3xl"></i></div>',
        info: '<div class="w-16 h-16 rounded-full bg-info/20 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-circle-info text-info text-3xl"></i></div>',
    };

    const btnClass = type === "error" ? "btn-error" : "btn-primary";
    const btnLabel = autoCloseSeconds > 0 ? `OK (${autoCloseSeconds}s)` : "OK";

    const modal = document.createElement("dialog");
    modal.id = "notify-modal";
    modal.className = "modal";
    modal.innerHTML = `
        <div class="modal-box max-w-sm text-center">
            ${iconMap[type] || iconMap.info}
            <h3 class="text-xl font-black">${title}</h3>
            <p class="py-3 opacity-70">${message}</p>
            ${autoCloseSeconds > 0 ? `<div class="flex justify-center mb-2"><div class="radial-progress text-primary text-xs font-black" style="--value:100;--size:3rem;--thickness:3px;" id="notify-countdown-ring">${autoCloseSeconds}</div></div>` : ''}
            <div class="modal-action justify-center">
                <button class="btn ${btnClass} rounded-2xl px-8 font-bold" id="notify-modal-btn">${btnLabel}</button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    const closeModal = () => {
        if (modal._autoCloseTimer) clearInterval(modal._autoCloseTimer);
        modal.close();
        setTimeout(() => {
            modal.remove();
            if (redirectUrl) window.location.href = redirectUrl;
        }, 200);
    };

    // Auto-close countdown
    if (autoCloseSeconds > 0) {
        let remaining = autoCloseSeconds;
        const btn = modal.querySelector("#notify-modal-btn");
        const ring = modal.querySelector("#notify-countdown-ring");
        modal._autoCloseTimer = setInterval(() => {
            remaining--;
            if (btn) btn.textContent = `OK (${remaining}s)`;
            if (ring) {
                const pct = Math.round((remaining / autoCloseSeconds) * 100);
                ring.style.setProperty('--value', pct);
                ring.textContent = remaining;
            }
            if (remaining <= 0) closeModal();
        }, 1000);
    }

    modal.querySelector("#notify-modal-btn").addEventListener("click", closeModal);
    modal.querySelector(".modal-backdrop button").addEventListener("click", closeModal);
}

// ─── Confirm Modal (replaces confirm()) ─────────────────────────
function showConfirm(title, message, onConfirm) {
    const existing = document.getElementById("confirm-modal");
    if (existing) existing.remove();

    const modal = document.createElement("dialog");
    modal.id = "confirm-modal";
    modal.className = "modal";
    modal.innerHTML = `
        <div class="modal-box max-w-sm text-center">
            <div class="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                <i class="fa-solid fa-triangle-exclamation text-warning text-3xl"></i>
            </div>
            <h3 class="text-xl font-black">${title}</h3>
            <p class="py-3 opacity-70">${message}</p>
            <div class="modal-action justify-center gap-3">
                <button class="btn btn-ghost rounded-2xl px-6 font-bold border border-base-content/10" id="confirm-cancel">Cancel</button>
                <button class="btn btn-error rounded-2xl px-6 font-bold" id="confirm-ok">Confirm</button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    const closeModal = () => {
        modal.close();
        setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector("#confirm-cancel").addEventListener("click", closeModal);
    modal.querySelector(".modal-backdrop button").addEventListener("click", closeModal);
    modal.querySelector("#confirm-ok").addEventListener("click", () => {
        closeModal();
        if (onConfirm) onConfirm();
    });
}

/**
 * Real-Time Notification Client for CCS Sit-In Monitoring
 * Uses Socket.IO for instant push + polling fallback.
 * Include AFTER notify.js and the Socket.IO client script.
 */

(function () {
    'use strict';

    // ─── Configuration ──────────────────────────────────────────────
    const POLL_INTERVAL = 15000; // 15 seconds fallback polling
    let _role = null;            // 'admin' | 'student' | null
    let _idNumber = null;
    let _pollTimer = null;
    let _socket = null;
    let _initialized = false;

    // ─── DOM Helpers ────────────────────────────────────────────────
    function getBellBadge() {
        return document.querySelector('#notif-bell-badge');
    }
    function getNotifList() {
        return document.querySelector('#notif-dropdown-list');
    }

    // ─── Render Notifications ───────────────────────────────────────
    function renderNotifications(data) {
        const list = getNotifList();
        const badge = getBellBadge();
        if (!list || !badge) return;

        const unreadCount = data.filter(n => !n.isRead).length;

        // Badge
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.innerText = '';
            badge.classList.add('hidden');
        }

        // List
        if (data.length === 0) {
            list.innerHTML = `<li><a class="text-sm py-3 opacity-60 italic justify-center">No new notifications</a></li>`;
        } else {
            list.innerHTML = data.map(n => `
                <li>
                    <a class="flex flex-col items-start gap-1 py-3 ${!n.isRead ? 'bg-primary/5' : ''}">
                        <div class="flex items-center gap-2">
                            <span class="badge badge-xs ${n.type === 'success' ? 'badge-success' : n.type === 'error' ? 'badge-error' : 'badge-info'}"></span>
                            <span class="text-xs font-bold">${n.message}</span>
                        </div>
                        <span class="text-[10px] opacity-40">${new Date(n.created_at).toLocaleString()}</span>
                    </a>
                </li>
            `).join('');

            if (unreadCount > 0) {
                list.innerHTML += `
                    <li class="mt-2 pt-2 border-t border-base-content/5">
                        <button class="btn btn-ghost btn-xs w-full text-[10px] uppercase tracking-tighter"
                                onclick="NotificationClient.markAllRead()">Mark all as read</button>
                    </li>`;
            }
        }
    }

    // ─── Fetch from API ─────────────────────────────────────────────
    function fetchNotifications() {
        fetch('/api/notifications')
            .then(r => r.json())
            .then(data => renderNotifications(data))
            .catch(err => console.error('Notification fetch error:', err));
    }

    // ─── Mark All Read ──────────────────────────────────────────────
    function markAllRead() {
        fetch('/api/notifications/mark-read', { method: 'POST' })
            .then(() => fetchNotifications());
    }

    // ─── Socket.IO Setup ────────────────────────────────────────────
    function initSocket() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO client not loaded, falling back to polling only');
            return;
        }

        _socket = io();

        _socket.on('connect', () => {
            console.log('Notification socket connected');
        });

        // Admin-targeted event
        if (_role === 'admin') {
            _socket.on('notification:admin', (payload) => {
                // Instant refresh
                fetchNotifications();
                // Optional: also show a toast for real-time awareness
                if (payload && payload.message) {
                    showToast(payload.message, payload.type || 'info');
                }
            });
        }

        // Student-targeted event
        if (_role === 'student') {
            _socket.on('notification:student', (payload) => {
                // If payload has a specific idNumber, only fire for that student
                if (payload.idNumber && payload.idNumber !== _idNumber) return;
                fetchNotifications();
                if (payload && payload.message) {
                    showToast(payload.message, payload.type || 'info');
                }
            });
        }
    }

    // ─── Initialize ─────────────────────────────────────────────────
    function init() {
        if (_initialized) return;
        _initialized = true;

        // Determine role from session
        fetch('/check-session')
            .then(r => r.json())
            .then(data => {
                if (!data.loggedIn) return;
                _role = data.role;
                _idNumber = data.idNumber;

                // Initial fetch
                fetchNotifications();

                // Socket.IO for instant push
                initSocket();

                // Polling fallback
                _pollTimer = setInterval(fetchNotifications, POLL_INTERVAL);
            })
            .catch(() => {});
    }

    // Auto-initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ─── Public API ─────────────────────────────────────────────────
    window.NotificationClient = {
        init: init,
        fetchNotifications: fetchNotifications,
        markAllRead: markAllRead
    };
})();

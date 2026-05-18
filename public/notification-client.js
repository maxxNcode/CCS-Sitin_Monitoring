/**
 * Real-Time Notification Client for CCS Sit-In Monitoring
 * Uses Socket.IO for instant push + polling fallback.
 * Include AFTER notify.js and the Socket.IO client script.
 */

(function () {
    'use strict';

    // ─── Configuration ──────────────────────────────────────────────
    const POLL_INTERVAL = 3000; // 3 seconds fallback polling
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
            return;
        }

        _socket = io({ transports: ['websocket'] });

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
                    // Silent refresh check - e.g. for simple announcement toggling
                    const isSilent = payload.category === 'announcement' && !payload.message.startsWith('New announcement:');
                    if (!isSilent) {
                        showToast(payload.message, payload.type || 'info');
                    }
                }
                
                // Dispatch custom event for page-level dynamic updates (e.g. homepage announcements)
                document.dispatchEvent(new CustomEvent('notification:student', { detail: payload }));
            });
        }
    }

    // ─── Initialize ─────────────────────────────────────────────────
    async function init() {
        if (_initialized) return;
        _initialized = true;

        try {
            const r = await fetch('/check-session');
            const data = await r.json();
            if (!data.loggedIn) return;
            _role = data.role;
            _idNumber = data.idNumber;

            // Initial fetch
            fetchNotifications();

            // Dynamic Socket.IO script loading only for local development
            const isLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
            if (isLocal) {
                const loaded = await new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = '/socket.io/socket.io.js';
                    script.onload = () => resolve(true);
                    script.onerror = () => resolve(false);
                    document.head.appendChild(script);
                });
                if (loaded) {
                    initSocket();
                } else {
                    console.warn('Socket.IO script failed to load locally, polling fallback active.');
                }
            } else {
                console.log('Production cloud environment: Notification polling fallback active.');
            }

            // Polling fallback
            _pollTimer = setInterval(fetchNotifications, POLL_INTERVAL);
        } catch (e) {
            console.error('Notification client initialization failed:', e);
        }
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

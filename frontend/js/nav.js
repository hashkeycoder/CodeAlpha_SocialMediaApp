const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

if (!token) {
  window.location.href = 'index.html';
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  // Clear cached chat data too — otherwise a different account logging in
  // on this same browser would briefly flash the previous user's messages
  Object.keys(localStorage)
    .filter(key => key.startsWith('messages_cache_') || key === 'conversations_cache')
    .forEach(key => localStorage.removeItem(key));

  window.location.href = 'index.html';
});

const isAdmin = currentUser && currentUser.role === 'admin';
const adminLink = document.getElementById('adminLink');
if (adminLink) adminLink.style.display = isAdmin ? 'inline' : 'none';

async function refreshNotifBadge() {
  const badgeEl = document.getElementById('notifBadge');
  if (!badgeEl) return;
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    badgeEl.textContent = data.unreadCount > 0 ? data.unreadCount : '';
    badgeEl.style.display = data.unreadCount > 0 ? 'inline' : 'none';
  } catch (err) {}
}
refreshNotifBadge();

// ---------- Live toast notifications ----------
// No WebSockets — polls every 8s and toasts anything newer than the last check.
// This is what makes notifications "pop up" while you're active on the platform.

let lastNotifCheck = new Date().toISOString();

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function ensureToastContainer() {
  let el = document.getElementById('toastContainer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastContainer';
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

const toastText = {
  like: (u) => `<strong>${u}</strong> liked your post`,
  comment: (u) => `<strong>${u}</strong> commented on your post`,
  follow: (u) => `<strong>${u}</strong> started following you`,
  follow_request: (u) => `<strong>${u}</strong> requested to follow you`,
  follow_accepted: (u) => `<strong>${u}</strong> accepted your follow request`,
  message: (u) => `<strong>${u}</strong> sent you a message`,
  repost: (u) => `<strong>${u}</strong> reposted your post`,
};

function showToast(notif) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';

  const avatarHtml = notif.fromUser?.profilePicUrl
    ? `<img src="${API_BASE.replace('/api', '')}${notif.fromUser.profilePicUrl}" class="toast-avatar">`
    : `<div class="toast-avatar-placeholder">${initials(notif.fromUser?.username)}</div>`;

  toast.innerHTML = `
    ${avatarHtml}
    <div class="toast-text">${toastText[notif.type] ? toastText[notif.type](notif.fromUser?.username || 'Someone') : 'New notification'}</div>
  `;

  toast.addEventListener('click', () => {
    window.location.href = 'notifications.html';
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut .25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, 5000);
}

async function pollForNewNotifications() {
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    const newOnes = data.notifications.filter(
      (n) => new Date(n.createdAt) > new Date(lastNotifCheck)
    );

    newOnes.reverse().forEach(showToast);

    lastNotifCheck = new Date().toISOString();

    const badgeEl = document.getElementById('notifBadge');
    if (badgeEl) {
      badgeEl.textContent = data.unreadCount > 0 ? data.unreadCount : '';
      badgeEl.style.display = data.unreadCount > 0 ? 'inline' : 'none';
    }
  } catch (err) {}
}

setInterval(pollForNewNotifications, 8000);
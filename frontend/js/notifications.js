const notifList = document.getElementById('notifList');
const pendingRequests = document.getElementById('pendingRequests');
const markAllReadBtn = document.getElementById('markAllReadBtn');

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function avatarHtml(user, cls = 'notif-avatar') {
  return user.profilePicUrl
    ? `<img src="${API_BASE.replace('/api', '')}${user.profilePicUrl}" class="${cls}">`
    : `<div class="${cls}-placeholder">${initials(user.username)}</div>`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const notifText = {
  like: (u) => `<strong>${u}</strong> liked your post`,
  comment: (u) => `<strong>${u}</strong> commented on your post`,
  follow: (u) => `<strong>${u}</strong> started following you`,
  follow_request: (u) => `<strong>${u}</strong> requested to follow you`,
  follow_accepted: (u) => `<strong>${u}</strong> accepted your follow request`,
  message: (u) => `<strong>${u}</strong> sent you a message`,
  repost: (u) => `<strong>${u}</strong> reposted your post`,
};

async function loadPendingRequests() {
  try {
    const res = await fetch(`${API_BASE}/follow/requests/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const requests = await res.json();

    if (requests.length === 0) {
      pendingRequests.innerHTML = '';
      return;
    }

    pendingRequests.innerHTML = `
      <p class="section-label">Follow Requests</p>
      ${requests.map(r => `
        <div class="request-card" data-follower="${r.follower.id}">
          ${avatarHtml(r.follower)}
          <span class="username">${r.follower.username}</span>
          <div class="request-actions">
            <button class="accept-btn" onclick="handleRequest('${r.follower.id}', 'accept', this)">Accept</button>
            <button class="reject-btn" onclick="handleRequest('${r.follower.id}', 'reject', this)">Reject</button>
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    console.error(err);
  }
}

async function handleRequest(followerId, action, btn) {
  btn.disabled = true;
  try {
    await fetch(`${API_BASE}/follow/${action}/${followerId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    btn.closest('.request-card').remove();
  } catch (err) {
    alert('Failed to process request');
    btn.disabled = false;
  }
}

function notifTarget(n) {
  if (n.type === 'message') return `messages.html?withUser=${n.fromUser?.username}`;
  if (n.type === 'like' || n.type === 'comment' || n.type === 'repost') {
    return n.postId ? `post-view.html?id=${n.postId}` : null;
  }
  if (n.type === 'follow' || n.type === 'follow_accepted' || n.type === 'follow_request') {
    return n.fromUser ? `profile.html?username=${n.fromUser.username}` : null;
  }
  return null;
}

async function loadNotifications() {
  notifList.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading...</div>';
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.notifications.length === 0) {
      notifList.innerHTML = '<p style="text-align:center; color:var(--muted); padding:30px 0;">No notifications yet.</p>';
      return;
    }

    notifList.innerHTML = `
      <p class="section-label">Recent</p>
      ${data.notifications.map(n => `
        <div class="notif-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
          <div class="notif-clickable" onclick="handleNotifClick('${n.id}', '${notifTarget(n) || ''}')">
            ${n.fromUser ? avatarHtml(n.fromUser) : '<div class="notif-avatar-placeholder">📢</div>'}
            <div>
              <div class="notif-text">${notifText[n.type] ? notifText[n.type](n.fromUser?.username || 'Someone') : 'New notification'}</div>
              <div class="notif-time">${timeAgo(n.createdAt)}</div>
            </div>
          </div>
          <button class="notif-delete-btn" onclick="deleteNotification(event, '${n.id}')" title="Delete">✕</button>
        </div>
      `).join('')}
    `;
  } catch (err) {
    notifList.innerHTML = '<p>Failed to load notifications.</p>';
  }
}

async function handleNotifClick(id, target) {
  await markRead(id);
  if (target) window.location.href = target;
}

async function deleteNotification(event, id) {
  event.stopPropagation();
  try {
    await fetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    document.querySelector(`.notif-item[data-id="${id}"]`)?.remove();
    refreshNotifBadge();
  } catch (err) {
    alert('Failed to delete notification');
  }
}

async function markRead(id) {
  try {
    await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    refreshNotifBadge();
  } catch (err) {
    // fail silently
  }
}

markAllReadBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    refreshNotifBadge();
  } catch (err) {
    alert('Failed to mark all as read');
  }
});

loadPendingRequests();
loadNotifications();
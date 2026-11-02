const conversationsEl = document.getElementById('conversations');
const chatHeader = document.getElementById('chatHeader');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const userSearchInput = document.getElementById('userSearchInput');
const userSearchResults = document.getElementById('userSearchResults');

let activeConversationId = null;
let activeOtherUser = null;
let conversationsCache = [];
let pollTimer = null;
let lastMessageTimestamp = null;
let renderedMessages = [];
let searchDebounce = null;

const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

// ---------- Local cache (stale-while-revalidate) ----------
// Shows saved data instantly, then quietly refreshes from the network.
// Makes the biggest difference on slow/high-latency connections.
function getCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (err) {
    return null;
  }
}
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    // storage full or unavailable — fail silently, caching is a bonus not a requirement
  }
}
function clearCache(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {}
}

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function otherMember(conv) {
  return conv.members.find(m => m.user.id !== currentUser.id)?.user || { username: 'Unknown' };
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function loadConversations() {
  // Show cached list immediately if we have one — no spinner, no wait
  const cached = getCache('conversations_cache');
  if (cached) {
    conversationsCache = cached;
    renderConversationList();
  }

  try {
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    conversationsCache = await res.json();
    setCache('conversations_cache', conversationsCache);
    renderConversationList();
  } catch (err) {
    if (!cached) {
      conversationsEl.innerHTML = '<p>Failed to load conversations.</p>';
    }
    // if we have cached data, silently keep showing it — the fetch failing
    // (e.g. flaky wifi) shouldn't wipe out what's already on screen
  }
}

function renderConversationList(filterQuery = '') {
  const q = filterQuery.trim().toLowerCase();
  const list = q
    ? conversationsCache.filter(conv => otherMember(conv).username.toLowerCase().includes(q))
    : conversationsCache;

  if (conversationsCache.length === 0) {
    conversationsEl.innerHTML = '<p style="font-size:.8rem; color:var(--muted); padding:10px;">No conversations yet.</p>';
    return;
  }
  if (list.length === 0) {
    conversationsEl.innerHTML = '<p style="font-size:.8rem; color:var(--muted); padding:10px;">No matching conversations.</p>';
    return;
  }

  conversationsEl.innerHTML = list.map(conv => {
    const other = otherMember(conv);
    const lastMsg = conv.messages[0];
    return `
      <div class="conv-item ${conv.id === activeConversationId ? 'active' : ''}" onclick="openConversation('${conv.id}')">
        ${other.profilePicUrl
          ? `<img src="${API_BASE.replace('/api', '')}${other.profilePicUrl}" class="conv-avatar">`
          : `<div class="conv-avatar-placeholder">${initials(other.username)}</div>`}
        <div>
          <div class="conv-name">${other.username}</div>
          <div class="conv-preview">${lastMsg ? (lastMsg.content || (lastMsg.sharedPostId ? 'Shared a post' : 'Media')) : 'Say hello!'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderChatHeader(conv) {
  const other = otherMember(conv);
  activeOtherUser = other;

  const avatarHtml = other.profilePicUrl
    ? `<img src="${API_BASE.replace('/api', '')}${other.profilePicUrl}" class="chat-header-avatar" onclick="goToProfile()">`
    : `<div class="chat-header-avatar-placeholder" onclick="goToProfile()">${initials(other.username)}</div>`;

  chatHeader.innerHTML = `
    ${avatarHtml}
    <span class="chat-header-name" onclick="goToProfile()">${other.username}</span>
    <div class="chat-header-actions">
      <button onclick="placeholderCall('voice')" title="Voice call">📞</button>
      <button onclick="placeholderCall('video')" title="Video call">🎥</button>
      <button onclick="clearChat()" title="Clear chat">🧹</button>
      <button onclick="deleteChat()" title="Delete chat">🗑️</button>
    </div>
  `;
  chatHeader.classList.remove('hidden');
}

function goToProfile() {
  if (activeOtherUser) window.location.href = `profile.html?username=${activeOtherUser.username}`;
}

function placeholderCall(type) {
  alert(`${type === 'video' ? 'Video' : 'Voice'} calling isn't wired up yet — icon's here, feature's coming later.`);
}

async function clearChat() {
  if (!activeConversationId) return;
  if (!confirm('Clear all messages in this chat? This cannot be undone.')) return;
  try {
    await fetch(`${API_BASE}/messages/${activeConversationId}/clear`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    lastMessageTimestamp = null;
    renderedMessages = [];
    clearCache(`messages_cache_${activeConversationId}`);
    chatMessages.innerHTML = '<p style="text-align:center; color:var(--muted); padding:20px;">Chat cleared.</p>';
    loadConversations();
  } catch (err) {
    alert('Failed to clear chat');
  }
}

async function deleteChat() {
  if (!activeConversationId) return;
  if (!confirm('Delete this chat entirely? This cannot be undone.')) return;
  try {
    await fetch(`${API_BASE}/messages/${activeConversationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    clearCache(`messages_cache_${activeConversationId}`);
    if (pollTimer) clearInterval(pollTimer);
    activeConversationId = null;
    chatHeader.classList.add('hidden');
    chatForm.classList.add('hidden');
    chatMessages.innerHTML = '<p style="text-align:center; color:var(--muted); padding:40px 20px;">Select a conversation to start chatting.</p>';
    loadConversations();
  } catch (err) {
    alert('Failed to delete chat');
  }
}

async function openConversation(conversationId) {
  activeConversationId = conversationId;

  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  const clickedItem = [...document.querySelectorAll('.conv-item')].find(
    el => el.getAttribute('onclick')?.includes(conversationId)
  );
  clickedItem?.classList.add('active');

  const conv = conversationsCache.find(c => c.id === conversationId);
  if (conv) renderChatHeader(conv);

  chatForm.classList.remove('hidden');

  // Show cached history instantly — no loading spinner if we already have it
  const cachedMessages = getCache(`messages_cache_${conversationId}`);
  if (cachedMessages && cachedMessages.length > 0) {
    renderedMessages = cachedMessages;
    lastMessageTimestamp = cachedMessages[cachedMessages.length - 1].createdAt;
    chatMessages.innerHTML = renderMessages(renderedMessages);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    chatMessages.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
    lastMessageTimestamp = null;
    renderedMessages = [];
  }

  // With lastMessageTimestamp already set from cache, this fetch only
  // pulls anything new since the cached snapshot — fast even on slow wifi
  await loadMessages();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(loadMessages, 3000);
}

function renderReactions(msg) {
  if (!msg.reactions || msg.reactions.length === 0) return '';
  const counts = {};
  msg.reactions.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
  return `<div class="msg-reactions">${Object.entries(counts).map(([e, c]) => `${e}${c > 1 ? c : ''}`).join(' ')}</div>`;
}

function renderMessages(messages) {
  let lastSenderId = null;
  let html = '';

  messages.forEach((m, i) => {
    const mine = m.sender.id === currentUser.id;
    const showAvatar = !mine && m.sender.id !== lastSenderId;
    const isLastOfGroup = i === messages.length - 1 || messages[i + 1].sender.id !== m.sender.id;
    const isTemp = String(m.id).startsWith('temp-');

    const avatarHtml = !mine
      ? (showAvatar
          ? (m.sender.profilePicUrl
              ? `<img src="${API_BASE.replace('/api', '')}${m.sender.profilePicUrl}" class="msg-row-avatar" onclick="window.location.href='profile.html?username=${m.sender.username}'">`
              : `<div class="msg-row-avatar-placeholder" onclick="window.location.href='profile.html?username=${m.sender.username}'">${initials(m.sender.username)}</div>`)
          : `<div class="msg-row-spacer"></div>`)
      : '';

    let bubbleContent;
    if (m.sharedPostId && m.sharedPost) {
      bubbleContent = `
        <div class="msg-shared-post">
          ${m.sharedPost.mediaUrl ? `<img src="${API_BASE.replace('/api', '')}${m.sharedPost.mediaUrl}">` : ''}
          <p><strong>${m.sharedPost.user.username}</strong>: ${m.sharedPost.caption || ''}</p>
        </div>
      `;
    } else {
      bubbleContent = `<div class="msg-bubble">${m.content || ''}${m.editedAt ? '<span class="msg-edited"> (edited)</span>' : ''}</div>`;
    }

    const menuBtn = !isTemp
      ? `<button class="msg-menu-btn" onclick="toggleMsgMenu(event, '${m.id}')">⋮</button>`
      : '';

    const menu = !isTemp ? `
      <div class="msg-menu hidden" id="menu-${m.id}">
        <div class="msg-menu-reactions">
          ${REACTION_EMOJIS.map(e => `<span onclick="reactToMessage('${m.id}', '${e}')">${e}</span>`).join('')}
        </div>
        ${mine && !m.sharedPostId ? `<button onclick="startEditMessage('${m.id}')">Edit</button>` : ''}
        <button onclick="forwardMessage('${m.id}')">Forward</button>
        ${mine ? `<button onclick="deleteMessage('${m.id}')" class="danger-option">Delete</button>` : ''}
      </div>
    ` : '';

    html += `
      <div class="msg-row ${mine ? 'mine' : 'theirs'}" data-msg-id="${m.id}">
        ${avatarHtml}
        <div class="msg-bubble-wrap">
          ${bubbleContent}
          ${renderReactions(m)}
        </div>
        ${menuBtn}
        ${menu}
      </div>
    `;

    if (isLastOfGroup) {
      html += `<div class="msg-time ${mine ? 'mine' : ''}">${formatTime(m.createdAt)}</div>`;
    }

    lastSenderId = m.sender.id;
  });

  return html || '<p style="text-align:center; color:var(--muted); padding:20px;">No messages yet. Say hello!</p>';
}

function toggleMsgMenu(e, msgId) {
  e.stopPropagation();
  document.querySelectorAll('.msg-menu').forEach(el => {
    if (el.id !== `menu-${msgId}`) el.classList.add('hidden');
  });
  document.getElementById(`menu-${msgId}`)?.classList.toggle('hidden');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.msg-menu').forEach(el => el.classList.add('hidden'));
});

async function reactToMessage(msgId, emoji) {
  try {
    await fetch(`${API_BASE}/messages/message/${msgId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emoji }),
    });
    // Force a fresh full reload of this conversation's messages to pick up the reaction
    lastMessageTimestamp = null;
    renderedMessages = [];
    await loadMessages();
  } catch (err) {
    alert('Failed to react');
  }
}

function startEditMessage(msgId) {
  const row = document.querySelector(`[data-msg-id="${msgId}"]`);
  const bubble = row.querySelector('.msg-bubble');
  const currentText = bubble.firstChild.textContent;

  bubble.innerHTML = `
    <input type="text" value="${currentText}" id="edit-input-${msgId}" style="font-size:.85rem; padding:4px 8px; width:100%; border-radius:8px; border:1px solid var(--line);">
    <div style="display:flex; gap:6px; margin-top:4px;">
      <button onclick="saveEditMessage('${msgId}')" class="primary-btn" style="width:auto; padding:4px 10px; font-size:.75rem;">Save</button>
      <button onclick="cancelEditMessage('${msgId}')" style="width:auto; padding:4px 10px; font-size:.75rem; background:var(--surface-2); color:var(--ink);">Cancel</button>
    </div>
  `;
  document.getElementById(`menu-${msgId}`)?.classList.add('hidden');
}

async function saveEditMessage(msgId) {
  const input = document.getElementById(`edit-input-${msgId}`);
  const newContent = input.value.trim();
  if (!newContent) return;

  try {
    await fetch(`${API_BASE}/messages/message/${msgId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: newContent }),
    });
    lastMessageTimestamp = null;
    renderedMessages = [];
    await loadMessages();
  } catch (err) {
    alert('Failed to edit message');
  }
}

function cancelEditMessage(msgId) {
  lastMessageTimestamp = null;
  renderedMessages = [];
  loadMessages();
}

async function deleteMessage(msgId) {
  if (!confirm('Delete this message?')) return;
  try {
    await fetch(`${API_BASE}/messages/message/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    document.querySelector(`[data-msg-id="${msgId}"]`)?.remove();
    renderedMessages = renderedMessages.filter(m => m.id !== msgId);
  } catch (err) {
    alert('Failed to delete message');
  }
}

function forwardMessage(msgId) {
  const others = conversationsCache.filter(c => c.id !== activeConversationId);
  if (others.length === 0) {
    alert('No other conversations to forward to.');
    return;
  }

  const options = others.map((c, i) => `${i + 1}. ${otherMember(c).username}`).join('\n');
  const choice = prompt(`Forward to which chat?\n${options}\n\nEnter a number:`);
  const index = parseInt(choice) - 1;
  if (isNaN(index) || !others[index]) return;

  fetch(`${API_BASE}/messages/message/${msgId}/forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conversationId: others[index].id }),
  })
    .then(() => alert('Message forwarded!'))
    .catch(() => alert('Failed to forward message'));
}

async function loadMessages() {
  if (!activeConversationId) return;
  try {
    const url = lastMessageTimestamp
      ? `${API_BASE}/messages/${activeConversationId}?since=${encodeURIComponent(lastMessageTimestamp)}`
      : `${API_BASE}/messages/${activeConversationId}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const newMessages = await res.json();

    if (newMessages.length === 0 && lastMessageTimestamp) return;

    renderedMessages = lastMessageTimestamp ? renderedMessages.concat(newMessages) : newMessages;
    if (newMessages.length > 0) {
      lastMessageTimestamp = newMessages[newMessages.length - 1].createdAt;
    }

    chatMessages.innerHTML = renderMessages(renderedMessages);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Cache the up-to-date list (capped to the most recent 200 so
    // localStorage doesn't grow unbounded on very long conversations)
    setCache(`messages_cache_${activeConversationId}`, renderedMessages.slice(-200));
  } catch (err) {
    console.error(err);
    // Network hiccup — keep showing whatever's already rendered (cached or otherwise)
  }
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = chatInput.value.trim();
  if (!content || !activeConversationId) return;

  chatInput.value = '';

  const tempMsg = {
    id: `temp-${Date.now()}`,
    content,
    sender: currentUser,
    createdAt: new Date().toISOString(),
    reactions: [],
  };
  renderedMessages.push(tempMsg);
  chatMessages.innerHTML = renderMessages(renderedMessages);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const formData = new FormData();
    formData.append('content', content);

    const res = await fetch(`${API_BASE}/messages/${activeConversationId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const realMsg = await res.json();

    const tempIndex = renderedMessages.findIndex(m => m.id === tempMsg.id);
    if (tempIndex !== -1) renderedMessages[tempIndex] = realMsg;
    lastMessageTimestamp = realMsg.createdAt;
    chatMessages.innerHTML = renderMessages(renderedMessages);

    loadConversations();
  } catch (err) {
    renderedMessages = renderedMessages.filter(m => m.id !== tempMsg.id);
    chatMessages.innerHTML = renderMessages(renderedMessages);
    alert('Failed to send message');
  }
});

async function startConversationWith(user) {
  try {
    const convRes = await fetch(`${API_BASE}/messages/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user.id }),
    });
    const conv = await convRes.json();

    userSearchInput.value = '';
    userSearchResults.classList.add('hidden');
    await loadConversations();
    openConversation(conv.id);
  } catch (err) {
    alert('Failed to start conversation');
  }
}

userSearchInput.addEventListener('input', () => {
  const q = userSearchInput.value.trim();
  renderConversationList(q);

  clearTimeout(searchDebounce);
  if (!q) {
    userSearchResults.classList.add('hidden');
    return;
  }

  searchDebounce = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&type=users`);
      const data = await res.json();
      const users = (data.users || []).filter(u => u.id !== currentUser.id);

      if (users.length === 0) {
        userSearchResults.classList.add('hidden');
        return;
      }

      userSearchResults.innerHTML = users.map(u => `
        <div class="user-search-result-item" onclick='startConversationWith(${JSON.stringify(u)})'>
          ${u.profilePicUrl
            ? `<img src="${API_BASE.replace('/api', '')}${u.profilePicUrl}" class="conv-avatar">`
            : `<div class="conv-avatar-placeholder">${initials(u.username)}</div>`}
          <div>
            <div class="username">${u.username}</div>
            <div class="name">${u.name}</div>
          </div>
        </div>
      `).join('');
      userSearchResults.classList.remove('hidden');
    } catch (err) {
      userSearchResults.classList.add('hidden');
    }
  }, 300);
});

const urlParams = new URLSearchParams(window.location.search);
const withUsername = urlParams.get('withUser');
const sharePostId = urlParams.get('sharePost');

async function autoShareIfNeeded() {
  if (!sharePostId || !activeConversationId) return;
  try {
    await fetch(`${API_BASE}/messages/${activeConversationId}/share-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ postId: sharePostId }),
    });
    loadMessages();
  } catch (err) {
    console.error(err);
  }
}

async function autoOpenFromNotification() {
  if (!withUsername) return;
  try {
    const userRes = await fetch(`${API_BASE}/users/${withUsername}`);
    if (!userRes.ok) return;
    const user = await userRes.json();
    await startConversationWith(user);
  } catch (err) {
    console.error(err);
  }
}

loadConversations().then(() => {
  if (withUsername) autoOpenFromNotification();
});

if (sharePostId) {
  chatMessages.innerHTML = '<p style="text-align:center; color:var(--muted); padding:20px;">Select a conversation to share this post.</p>';
  const originalOpen = openConversation;
  window.openConversation = async function (id) {
    await originalOpen(id);
    await autoShareIfNeeded();
  };
}
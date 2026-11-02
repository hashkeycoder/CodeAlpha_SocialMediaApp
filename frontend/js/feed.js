const feedList = document.getElementById('feedList');
const composerForm = document.getElementById('composerForm');
const composerMessage = document.getElementById('composerMessage');

document.getElementById('myProfileLink').href = `profile.html?username=${currentUser.username}`;

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function avatarHtml(user, cls = 'post-avatar') {
  return user.profilePicUrl
    ? `<img src="${API_BASE.replace('/api', '')}${user.profilePicUrl}" class="${cls}" alt="${user.username}">`
    : `<div class="${cls}-placeholder">${initials(user.username)}</div>`;
}

// ---------- Stories tray ----------
async function loadStories() {
  const tray = document.getElementById('storyTray');
  try {
    const res = await fetch(`${API_BASE}/stories/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const groups = await res.json();

    const myGroup = groups.find(g => g.user.id === currentUser.id);
    const otherGroups = groups.filter(g => g.user.id !== currentUser.id);

    const addStoryHtml = `
      <div class="story-item" onclick="document.getElementById('storyFileInput').click()">
        <div class="story-ring ${myGroup ? 'has-story' : 'no-story'}">
          ${avatarHtml(currentUser, 'story-avatar')}
          ${!myGroup ? '<span class="story-plus">+</span>' : ''}
        </div>
        <span class="story-label">Your Story</span>
      </div>
    `;

    const othersHtml = otherGroups.map(g => `
      <div class="story-item" onclick="viewStory('${g.user.id}')">
        <div class="story-ring has-story">${avatarHtml(g.user, 'story-avatar')}</div>
        <span class="story-label">${g.user.username}</span>
      </div>
    `).join('');

    tray.innerHTML = addStoryHtml + othersHtml;
  } catch (err) {
    tray.innerHTML = '';
  }
}

document.getElementById('storyFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('media', file);

  try {
    const res = await fetch(`${API_BASE}/stories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      loadStories();
    } else {
      alert('Failed to upload story');
    }
  } catch (err) {
    alert('Server error');
  }
  e.target.value = '';
});

async function viewStory(userId) {
  try {
    const res = await fetch(`${API_BASE}/stories/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const stories = await res.json();
    if (stories.length === 0) return;

    // Simple viewer: open the first active story in a new tab
    window.open(`${API_BASE.replace('/api', '')}${stories[0].mediaUrl}`, '_blank');
  } catch (err) {
    alert('Failed to load story');
  }
}

// ---------- Feed ----------
function renderPost(post) {
  const isRepost = !!post.repostOf;
  const displayPost = isRepost ? post.repostOf : post;
  const isMine = post.user.id === currentUser.id;

  return `
    <div class="post-card" data-id="${post.id}">
      ${isRepost ? `<p class="repost-tag">🔁 ${post.user.username} reposted</p>` : ''}
      <div class="post-header">
        <a href="profile.html?username=${displayPost.user.username}">${avatarHtml(displayPost.user)}</a>
        <div>
          <a href="profile.html?username=${displayPost.user.username}" class="username">${displayPost.user.username}</a>
          ${displayPost.location ? `<div class="location">${displayPost.location}</div>` : ''}
        </div>
        ${isMine ? `
          <button class="post-menu-btn" onclick="togglePostMenu(event, '${post.id}')">⋮</button>
          <div class="post-menu hidden" id="post-menu-${post.id}">
            ${!isRepost ? `<button onclick="startEditPost('${post.id}')">Edit caption</button>` : ''}
            <button onclick="deletePost('${post.id}')" class="danger-option">Delete</button>
          </div>
        ` : ''}
      </div>
      <a href="post-view.html?id=${post.id}">
        ${displayPost.mediaUrl ? (
          displayPost.mediaType === 'video'
            ? `<video src="${API_BASE.replace('/api', '')}${displayPost.mediaUrl}" class="post-media" muted></video>`
            : `<img src="${API_BASE.replace('/api', '')}${displayPost.mediaUrl}" class="post-media" alt="post media">`
        ) : ''}
      </a>
      <div id="caption-${post.id}" data-caption="${(post.caption || '').replace(/"/g, '&quot;')}">
        ${post.caption ? `<p class="post-caption"><strong>${post.user.username}</strong>${post.caption}</p>` : ''}
      </div>
      <div class="post-actions">
        <button onclick="toggleLike('${post.id}', this)" data-liked="false">🤍</button>
        <button onclick="toggleComment('${post.id}')">💬</button>
        <button onclick="toggleSave('${post.id}', this)" data-saved="false">🔖</button>
        <button onclick="repost('${post.id}')">🔁</button>
        <button onclick="shareToMessage('${post.id}')">✈️</button>
      </div>
      <p class="post-meta" id="meta-${post.id}">${post._count?.likes || 0} likes · ${post._count?.comments || 0} comments</p>
      <div id="comments-${post.id}" class="hidden" style="padding:0 16px 14px;"></div>
    </div>
  `;
}

function togglePostMenu(e, postId) {
  e.stopPropagation();
  e.preventDefault();
  document.querySelectorAll('.post-menu').forEach(el => {
    if (el.id !== `post-menu-${postId}`) el.classList.add('hidden');
  });
  document.getElementById(`post-menu-${postId}`)?.classList.toggle('hidden');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.post-menu').forEach(el => el.classList.add('hidden'));
});

function startEditPost(postId) {
  const captionBox = document.getElementById(`caption-${postId}`);
  const currentCaption = captionBox.dataset.caption || '';

  captionBox.innerHTML = `
    <div style="padding:0 16px 10px;">
      <textarea id="edit-caption-${postId}" style="width:100%; font-size:.85rem;">${currentCaption}</textarea>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button onclick="saveEditPost('${postId}')" class="primary-btn" style="width:auto; padding:6px 14px; font-size:.8rem;">Save</button>
        <button onclick="cancelEditPost('${postId}')" style="width:auto; padding:6px 14px; font-size:.8rem; background:var(--surface-2); color:var(--ink);">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById(`post-menu-${postId}`)?.classList.add('hidden');
}

async function saveEditPost(postId) {
  const textarea = document.getElementById(`edit-caption-${postId}`);
  const newCaption = textarea.value;

  try {
    await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ caption: newCaption }),
    });
    loadFeed();
  } catch (err) {
    alert('Failed to save changes');
  }
}

function cancelEditPost(postId) {
  loadFeed();
}

async function deletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    document.querySelector(`.post-card[data-id="${postId}"]`)?.remove();
  } catch (err) {
    alert('Failed to delete post');
  }
}

async function loadFeed() {
  feedList.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading feed...</div>';
  try {
    const res = await fetch(`${API_BASE}/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.posts || data.posts.length === 0) {
      feedList.innerHTML = `<p style="text-align:center; color:var(--muted); padding:40px 0;">${data.message || 'No posts yet. Follow people to see their posts here.'}</p>`;
      return;
    }

    feedList.innerHTML = data.posts.map(renderPost).join('');
  } catch (err) {
    feedList.innerHTML = '<p>Failed to load feed.</p>';
  }
}

composerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  composerMessage.textContent = '';

  const formData = new FormData();
  formData.append('caption', document.getElementById('composerCaption').value);
  const file = document.getElementById('composerMedia').files[0];
  if (file) formData.append('media', file);

  const btn = composerForm.querySelector('button[type="submit"]');
  const original = btn.textContent;
  btn.innerHTML = '<span class="spinner spinner-light"></span>';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      composerMessage.textContent = data.error || 'Failed to post';
      return;
    }

    composerForm.reset();
    loadFeed();
  } catch (err) {
    composerMessage.textContent = 'Server error.';
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
});

// Optimistic like — flips the UI instantly, fires the request in the background,
// and only reverts if the request actually fails. Makes it feel instant regardless
// of network latency to the database.
async function toggleLike(postId, btn) {
  const wasLiked = btn.dataset.liked === 'true';
  const nowLiked = !wasLiked;

  btn.dataset.liked = String(nowLiked);
  btn.textContent = nowLiked ? '❤️' : '🤍';
  btn.classList.toggle('active', nowLiked);

  const metaEl = document.getElementById(`meta-${postId}`);
  const current = parseInt(metaEl.textContent) || 0;
  const optimisticCount = nowLiked ? current + 1 : Math.max(0, current - 1);
  metaEl.textContent = metaEl.textContent.replace(/^\d+/, optimisticCount);

  try {
    const res = await fetch(`${API_BASE}/engage/like/${postId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    // Reconcile in case server state differs from our optimistic guess
    if (data.liked !== nowLiked) {
      btn.dataset.liked = String(data.liked);
      btn.textContent = data.liked ? '❤️' : '🤍';
      btn.classList.toggle('active', data.liked);
    }
  } catch (err) {
    // Revert on failure
    btn.dataset.liked = String(wasLiked);
    btn.textContent = wasLiked ? '❤️' : '🤍';
    btn.classList.toggle('active', wasLiked);
    metaEl.textContent = metaEl.textContent.replace(/^\d+/, current);
  }
}

async function toggleSave(postId, btn) {
  const wasSaved = btn.dataset.saved === 'true';
  const nowSaved = !wasSaved;
  btn.dataset.saved = String(nowSaved);
  btn.textContent = nowSaved ? '📌' : '🔖';
  btn.classList.toggle('active', nowSaved);

  try {
    await fetch(`${API_BASE}/engage/save/${postId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    btn.dataset.saved = String(wasSaved);
    btn.textContent = wasSaved ? '📌' : '🔖';
    btn.classList.toggle('active', wasSaved);
  }
}

async function toggleComment(postId) {
  const box = document.getElementById(`comments-${postId}`);
  if (!box.classList.contains('hidden')) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
  await renderComments(postId, box);
}

async function renderComments(postId, box) {
  try {
    const res = await fetch(`${API_BASE}/engage/comment/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const comments = await res.json();

    box.innerHTML = `
      <div id="thread-${postId}" style="margin-bottom:10px;">${renderCommentThread(comments)}</div>
      <form onsubmit="return submitComment(event, '${postId}')" style="display:flex; gap:8px;">
        <input type="text" placeholder="Add a comment..." required style="flex:1;">
        <button type="submit" class="primary-btn" style="width:auto; padding:8px 14px;">Post</button>
      </form>
    `;
  } catch (err) {
    box.innerHTML = '<p>Failed to load comments.</p>';
  }
}

async function submitReply(parentId) {
  const input = document.getElementById(`reply-input-${parentId}`);
  const content = input.value.trim();
  if (!content) return;

  const postCard = input.closest('.post-card');
  const postId = postCard.dataset.id;

  try {
    await fetch(`${API_BASE}/engage/comment/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content, parentId }),
    });
    input.value = '';
    const box = document.getElementById(`comments-${postId}`);
    await renderComments(postId, box);
  } catch (err) {
    alert('Failed to post reply');
  }
}

// Appends the new comment to the DOM immediately instead of refetching the
// whole list from the server — the roundtrip is what made this feel slow.
async function submitComment(e, postId) {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const content = input.value;
  input.value = '';

  const listEl = document.getElementById(`thread-${postId}`);
  const tempLine = document.createElement('div');
  tempLine.className = 'comment-node';
  tempLine.style.marginBottom = '8px';
  tempLine.innerHTML = `<p style="font-size:.85rem;"><strong>${currentUser.username}</strong> ${content}</p>`;
  listEl.appendChild(tempLine);

  const metaEl = document.getElementById(`meta-${postId}`);
  const parts = metaEl.textContent.split('·');
  const commentCount = (parseInt(parts[1]) || 0) + 1;
  metaEl.textContent = `${parts[0].trim()} · ${commentCount} comments`;

  try {
    await fetch(`${API_BASE}/engage/comment/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    tempLine.remove();
    alert('Failed to post comment');
  }
  return false;
}

async function repost(postId) {
  const caption = prompt('Add a caption to your repost (optional):') || '';
  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/repost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ caption }),
    });
    if (res.ok) {
      alert('Reposted!');
      loadFeed();
    } else {
      alert('Failed to repost');
    }
  } catch (err) {
    alert('Server error');
  }
}

function shareToMessage(postId) {
  window.location.href = `messages.html?sharePost=${postId}`;
}

loadStories();
loadFeed();
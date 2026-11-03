const postContainer = document.getElementById('postContainer');
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function avatarHtml(user) {
  return user.profilePicUrl
    ? `<img src="${API_BASE.replace('/api', '')}${user.profilePicUrl}" class="post-avatar" alt="${user.username}">`
    : `<div class="post-avatar-placeholder">${initials(user.username)}</div>`;
}

async function loadPost() {
  if (!postId) {
    postContainer.innerHTML = '<p>No post specified.</p>';
    return;
  }

  postContainer.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading post...</div>';

  try {
    const [postRes, likesRes, commentsRes] = await Promise.all([
      fetch(`${API_BASE}/posts/${postId}`),
      fetch(`${API_BASE}/engage/like/${postId}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/engage/comment/${postId}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (!postRes.ok) {
      postContainer.innerHTML = '<p>Post not found.</p>';
      return;
    }

    const post = await postRes.json();
    const likes = await likesRes.json();
    const comments = await commentsRes.json();
    const iLiked = likes.some(l => l.user.id === currentUser.id);
    const isMine = post.user.id === currentUser.id;

    postContainer.innerHTML = `
      <div class="post-card" data-id="${post.id}">
        <div class="post-header">
          <a href="profile.html?username=${post.user.username}">${avatarHtml(post.user)}</a>
          <div>
            <a href="profile.html?username=${post.user.username}" class="username">${post.user.username}</a>
            ${post.location ? `<div class="location">${post.location}</div>` : ''}
          </div>
          ${isMine ? `
            <button class="post-menu-btn" onclick="togglePostMenu(event)">⋮</button>
            <div class="post-menu hidden" id="post-menu-${post.id}">
              ${!post.repostOfId ? `<button onclick="startEditPost()">Edit caption</button>` : ''}
              <button onclick="deleteThisPost()" class="danger-option">Delete</button>
            </div>
          ` : ''}
        </div>
        ${post.mediaUrl ? (
          post.mediaType === 'video'
            ? `<video src="${API_BASE.replace('/api', '')}${post.mediaUrl}" class="post-media" controls></video>`
            : `<img src="${API_BASE.replace('/api', '')}${post.mediaUrl}" class="post-media" alt="post media">`
        ) : ''}
        <div id="captionBox" data-caption="${(post.caption || '').replace(/"/g, '&quot;')}">
          ${post.caption ? `<p class="post-caption"><strong>${post.user.username}</strong>${linkifyHashtags(post.caption)}</p>` : ''}
        </div>
        <div class="post-actions">
          <button onclick="toggleLike(this)" data-liked="${iLiked}">${iLiked ? '❤️' : '🤍'}</button>
          <button onclick="repostThis()">🔁</button>
          <button onclick="shareThis()">✈️</button>
        </div>
        <p class="post-meta" id="likesCount">${likes.length} likes</p>

        <div style="padding:0 16px 16px;">
          <div id="commentsList" style="margin-bottom:12px;">
            ${renderCommentThread(comments)}
          </div>
          <form id="commentForm" style="display:flex; gap:8px;">
            <input type="text" id="commentInput" placeholder="Add a comment..." required style="flex:1;">
            <button type="submit" class="primary-btn" style="width:auto; padding:8px 14px;">Post</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('commentForm').addEventListener('submit', submitComment);
  } catch (err) {
    postContainer.innerHTML = '<p>Failed to load post.</p>';
  }
}

async function toggleLike(btn) {
  const wasLiked = btn.dataset.liked === 'true';
  const nowLiked = !wasLiked;
  btn.dataset.liked = String(nowLiked);
  btn.textContent = nowLiked ? '❤️' : '🤍';

  const countEl = document.getElementById('likesCount');
  const current = parseInt(countEl.textContent) || 0;
  countEl.textContent = `${nowLiked ? current + 1 : Math.max(0, current - 1)} likes`;

  try {
    await fetch(`${API_BASE}/engage/like/${postId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    btn.dataset.liked = String(wasLiked);
    btn.textContent = wasLiked ? '❤️' : '🤍';
    countEl.textContent = `${current} likes`;
  }
}

async function submitComment(e) {
  e.preventDefault();
  const input = document.getElementById('commentInput');
  const content = input.value;
  input.value = '';

  const list = document.getElementById('commentsList');
  const line = document.createElement('div');
  line.className = 'comment-node';
  line.style.marginBottom = '8px';
  line.innerHTML = `<p style="font-size:.85rem;"><strong>${currentUser.username}</strong> ${content}</p>`;
  list.appendChild(line);

  try {
    await fetch(`${API_BASE}/engage/comment/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    line.remove();
    alert('Failed to post comment');
  }
}

async function repostThis() {
  const caption = prompt('Add a caption to your repost (optional):') || '';
  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/repost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ caption }),
    });
    if (res.ok) {
      alert('Reposted!');
    } else {
      alert('Failed to repost');
    }
  } catch (err) {
    alert('Server error');
  }
}

function shareThis() {
  window.location.href = `messages.html?sharePost=${postId}`;
}

loadPost();

function togglePostMenu(e) {
  e.stopPropagation();
  e.preventDefault();
  document.getElementById(`post-menu-${postId}`)?.classList.toggle('hidden');
}

document.addEventListener('click', () => {
  document.getElementById(`post-menu-${postId}`)?.classList.add('hidden');
});

function startEditPost() {
  const captionBox = document.getElementById('captionBox');
  const currentCaption = captionBox.dataset.caption || '';

  captionBox.innerHTML = `
    <div style="padding:0 16px 10px;">
      <textarea id="editCaptionInput" style="width:100%; font-size:.9rem;">${currentCaption}</textarea>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button onclick="saveEditPost()" class="primary-btn" style="width:auto; padding:6px 14px; font-size:.8rem;">Save</button>
        <button onclick="loadPost()" style="width:auto; padding:6px 14px; font-size:.8rem; background:var(--surface-2); color:var(--ink);">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById(`post-menu-${postId}`)?.classList.add('hidden');
}

async function saveEditPost() {
  const newCaption = document.getElementById('editCaptionInput').value;
  try {
    await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ caption: newCaption }),
    });
    loadPost();
  } catch (err) {
    alert('Failed to save changes');
  }
}

async function deleteThisPost() {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    window.location.href = 'feed.html';
  } catch (err) {
    alert('Failed to delete post');
  }
}
const savedGrid = document.getElementById('savedGrid');

async function loadSaved() {
  savedGrid.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading saved posts...</div>';
  try {
    const res = await fetch(`${API_BASE}/engage/saved`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const saved = await res.json();

    if (saved.length === 0) {
      savedGrid.innerHTML = '<p style="text-align:center; color:var(--muted); padding:40px 0;">No saved posts yet — tap the 🔖 icon on a post to save it here.</p>';
      return;
    }

    savedGrid.innerHTML = `
      <div class="saved-grid">
        ${saved.map(s => `
          <div class="saved-card" data-post-id="${s.post.id}">
            <button class="saved-unsave-btn" onclick="unsavePost(event, '${s.post.id}')" title="Remove from saved">✕</button>
            <a href="post-view.html?id=${s.post.id}">
              ${s.post.mediaUrl
                ? `<img src="${API_BASE.replace('/api', '')}${s.post.mediaUrl}" alt="post">`
                : `<div class="saved-card-noimage">${s.post.caption || 'No preview'}</div>`}
              <div class="saved-card-info">
                <span class="username">${s.post.user.username}</span>
              </div>
            </a>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    savedGrid.innerHTML = '<p>Failed to load saved posts.</p>';
  }
}

async function unsavePost(e, postId) {
  e.preventDefault();
  e.stopPropagation();
  try {
    await fetch(`${API_BASE}/engage/save/${postId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    document.querySelector(`.saved-card[data-post-id="${postId}"]`)?.remove();
  } catch (err) {
    alert('Failed to remove from saved');
  }
}

loadSaved();
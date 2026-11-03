const hashtagGrid = document.getElementById('hashtagGrid');
const tag = new URLSearchParams(window.location.search).get('tag');

document.getElementById('hashtagTitle').textContent = tag ? `#${tag}` : 'Hashtag';

async function loadHashtag() {
  if (!tag) {
    hashtagGrid.innerHTML = '<p>No hashtag specified.</p>';
    return;
  }
  hashtagGrid.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
  try {
    const res = await fetch(`${API_BASE}/search/hashtag/${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!data.posts || data.posts.length === 0) {
      hashtagGrid.innerHTML = '<p style="text-align:center; color:var(--muted); padding:40px 0;">No posts with this hashtag yet.</p>';
      return;
    }

    hashtagGrid.innerHTML = `
      <div class="saved-grid">
        ${data.posts.map(p => `
          <a href="post-view.html?id=${p.id}" class="saved-card">
            ${p.mediaUrl
              ? `<img src="${API_BASE.replace('/api', '')}${p.mediaUrl}" alt="post">`
              : `<div class="saved-card-noimage">${p.caption || ''}</div>`}
            <div class="saved-card-info"><span class="username">${p.user.username}</span></div>
          </a>
        `).join('')}
      </div>
    `;
  } catch (err) {
    hashtagGrid.innerHTML = '<p>Failed to load posts.</p>';
  }
}

loadHashtag();
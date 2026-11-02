const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const tabBtns = document.querySelectorAll('.tab-btn');

let activeType = 'all';

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeType = btn.dataset.type;
    if (searchInput.value.trim()) runSearch();
  });
});

async function runSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  searchResults.innerHTML = '<div class="loading-state"><span class="spinner"></span> Searching...</div>';

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&type=${activeType}`);
    const data = await res.json();

    let html = '';

    if (data.users && data.users.length > 0) {
      html += `
        <div class="result-section">
          <h3>People</h3>
          ${data.users.map(u => `
            <a href="profile.html?username=${u.username}" class="user-result">
              ${u.profilePicUrl
                ? `<img src="${API_BASE.replace('/api', '')}${u.profilePicUrl}" class="user-result-avatar">`
                : `<div class="user-result-avatar-placeholder">${initials(u.username)}</div>`}
              <div>
                <div class="username">${u.username}</div>
                <div class="name">${u.name}</div>
              </div>
            </a>
          `).join('')}
        </div>
      `;
    }

    if (data.posts && data.posts.length > 0) {
      html += `
        <div class="result-section">
          <h3>Posts</h3>
          ${data.posts.map(p => `
            <a href="feed.html" class="post-result">
              ${p.mediaUrl ? `<img src="${API_BASE.replace('/api', '')}${p.mediaUrl}">` : ''}
              <div><strong>${p.user.username}</strong>: ${p.caption || ''}</div>
            </a>
          `).join('')}
        </div>
      `;
    }

    if (data.hashtags && data.hashtags.length > 0) {
      html += `
        <div class="result-section">
          <h3>Hashtags</h3>
          ${data.hashtags.map(h => `
            <a href="#" class="hashtag-result">#${h.tag}<span>${h._count.posts} posts</span></a>
          `).join('')}
        </div>
      `;
    }

    if (!html) {
      html = '<p style="text-align:center; color:var(--muted); padding:30px 0;">No results found.</p>';
    }

    searchResults.innerHTML = html;
  } catch (err) {
    searchResults.innerHTML = '<p>Search failed.</p>';
  }
}

searchBtn.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runSearch();
  }
});
const profileHeader = document.getElementById('profileHeader');
const profilePosts = document.getElementById('profilePosts');

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username') || currentUser.username;

document.getElementById('myProfileLink').href = `profile.html?username=${currentUser.username}`;

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

async function loadProfile() {
  profileHeader.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading profile...</div>';
  try {
    const res = await fetch(`${API_BASE}/users/${username}`);
    if (!res.ok) {
      profileHeader.innerHTML = '<p>User not found.</p>';
      return;
    }
    const user = await res.json();
    const isOwnProfile = user.username === currentUser.username;

    let followBtnHtml = '';
    let isFollowing = false;

    if (!isOwnProfile) {
      const followersRes = await fetch(`${API_BASE}/follow/followers/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const followers = await followersRes.json();
      isFollowing = followers.some(f => f.follower.id === currentUser.id);
      followBtnHtml = `<button class="${isFollowing ? 'following-btn' : 'follow-btn'}" onclick="toggleFollow('${user.id}', this)">${isFollowing ? 'Following' : 'Follow'}</button>`;
    }

    // Check for an active story to decide what clicking the avatar does
    let hasActiveStory = false;
    try {
      const storiesRes = await fetch(`${API_BASE}/stories/user/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stories = await storiesRes.json();
      hasActiveStory = stories.length > 0;
    } catch (err) {}

    const avatarClickHandler = hasActiveStory
      ? `onclick="viewUserStory('${user.id}')"`
      : (user.profilePicUrl ? `onclick="viewFullPicture('${API_BASE.replace('/api', '')}${user.profilePicUrl}')"` : '');

    profileHeader.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar-wrap ${hasActiveStory ? 'has-story-ring' : ''}" ${avatarClickHandler} style="cursor:${hasActiveStory || user.profilePicUrl ? 'pointer' : 'default'};">
          ${user.profilePicUrl
            ? `<img src="${API_BASE.replace('/api', '')}${user.profilePicUrl}" class="profile-avatar">`
            : `<div class="profile-avatar-placeholder">${initials(user.username)}</div>`}
        </div>
        <div class="profile-info">
          <h1>${user.name} <span style="color:var(--muted); font-weight:400;">@${user.username}</span></h1>
          ${user.bio ? `<p class="bio">${user.bio}</p>` : ''}
          <div class="profile-stats">
            <div><strong>${user._count.posts}</strong> posts</div>
            <div><strong>${user._count.followers}</strong> followers</div>
            <div><strong>${user._count.following}</strong> following</div>
          </div>
          <div class="profile-actions">
            ${isOwnProfile
              ? `<a href="edit-profile.html" class="primary-btn" style="display:inline-block; padding:9px 18px; font-size:.82rem;">Edit Profile</a>
                 <a href="saved.html" style="display:inline-block; padding:9px 18px; font-size:.82rem; background:var(--surface-2); color:var(--ink); border-radius:var(--radius-sm);">🔖 Saved</a>`
              : followBtnHtml}
          </div>
        </div>
      </div>
    `;

    if (user.isPrivate && !isOwnProfile && !isFollowing) {
      profilePosts.innerHTML = '<p style="text-align:center; color:var(--muted); padding:40px 0;">This account is private. Follow to see their posts.</p>';
      return;
    }

    loadUserPosts(user.id);
  } catch (err) {
    profileHeader.innerHTML = '<p>Failed to load profile.</p>';
  }
}

async function loadUserPosts(userId) {
  profilePosts.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
  try {
    const res = await fetch(`${API_BASE}/posts/user/${userId}`);
    const posts = await res.json();

    if (posts.length === 0) {
      profilePosts.innerHTML = '<p style="text-align:center; color:var(--muted); padding:30px 0;">No posts yet.</p>';
      return;
    }

    profilePosts.innerHTML = `
      <div class="posts-grid">
        ${posts.map(p => `
          <a href="feed.html">
            ${p.mediaUrl
              ? `<img src="${API_BASE.replace('/api', '')}${p.mediaUrl}" alt="post">`
              : `<div style="aspect-ratio:1; background:var(--surface-2); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:.75rem; color:var(--muted); padding:8px; text-align:center;">${p.caption || 'Repost'}</div>`}
          </a>
        `).join('')}
      </div>
    `;
  } catch (err) {
    profilePosts.innerHTML = '<p>Failed to load posts.</p>';
  }
}

async function toggleFollow(userId, btn) {
  const isFollowing = btn.classList.contains('following-btn');
  btn.disabled = true;
  try {
    if (isFollowing) {
      await fetch(`${API_BASE}/follow/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      btn.textContent = 'Follow';
      btn.classList.remove('following-btn');
      btn.classList.add('follow-btn');
    } else {
      const res = await fetch(`${API_BASE}/follow/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      btn.textContent = data.status === 'pending' ? 'Requested' : 'Following';
      btn.classList.remove('follow-btn');
      btn.classList.add('following-btn');
    }
  } catch (err) {
    alert('Failed to update follow status');
  } finally {
    btn.disabled = false;
  }
}

loadProfile();

async function viewUserStory(userId) {
  try {
    const res = await fetch(`${API_BASE}/stories/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const stories = await res.json();
    if (stories.length === 0) return;

    let current = 0;
    showStoryOverlay(stories, current);
  } catch (err) {
    alert('Failed to load story');
  }
}

function showStoryOverlay(stories, index) {
  let overlay = document.getElementById('storyOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'storyOverlay';
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <img src="${API_BASE.replace('/api', '')}${stories[index].mediaUrl}" class="lightbox-story-img">
    <button class="lightbox-close" onclick="document.getElementById('storyOverlay').remove()">✕</button>
    ${stories.length > 1 ? `
      <div class="lightbox-story-dots">
        ${stories.map((_, i) => `<span class="${i === index ? 'active' : ''}"></span>`).join('')}
      </div>
    ` : ''}
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);

  if (stories.length > 1 && index < stories.length - 1) {
    setTimeout(() => showStoryOverlay(stories, index + 1), 4000);
  } else {
    setTimeout(() => document.getElementById('storyOverlay')?.remove(), 4000);
  }
}

function viewFullPicture(url) {
  let overlay = document.getElementById('storyOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'storyOverlay';
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <img src="${url}" class="lightbox-story-img">
    <button class="lightbox-close" onclick="document.getElementById('storyOverlay').remove()">✕</button>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}
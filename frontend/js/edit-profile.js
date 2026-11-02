const editForm = document.getElementById('editProfileForm');
const editMessage = document.getElementById('editMessage');
const passwordForm = document.getElementById('passwordForm');
const passwordMessage = document.getElementById('passwordMessage');
const avatarPreview = document.getElementById('avatarPreview');

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function renderAvatar(user) {
  avatarPreview.innerHTML = user.profilePicUrl
    ? `<img src="${API_BASE.replace('/api', '')}${user.profilePicUrl}" class="profile-avatar">`
    : `<div class="profile-avatar-placeholder">${initials(user.username)}</div>`;
}

async function loadCurrentProfile() {
  try {
    const res = await fetch(`${API_BASE}/users/${currentUser.username}`);
    const user = await res.json();

    document.getElementById('editName').value = user.name || '';
    document.getElementById('editUsername').value = user.username || '';
    document.getElementById('editBio').value = user.bio || '';
    document.getElementById('editIsPrivate').checked = !!user.isPrivate;
    renderAvatar(user);
  } catch (err) {
    console.error(err);
  }
}

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  editMessage.textContent = '';

  const formData = new FormData();
  formData.append('name', document.getElementById('editName').value);
  formData.append('username', document.getElementById('editUsername').value);
  formData.append('bio', document.getElementById('editBio').value);
  formData.append('isPrivate', document.getElementById('editIsPrivate').checked);

  const picFile = document.getElementById('editProfilePic').files[0];
  if (picFile) formData.append('profilePic', picFile);

  const btn = editForm.querySelector('button[type="submit"]');
  const original = btn.textContent;
  btn.innerHTML = '<span class="spinner spinner-light"></span> Saving...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/users/me/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      editMessage.textContent = data.error || 'Failed to update profile';
      editMessage.className = 'error';
      return;
    }

    localStorage.setItem('user', JSON.stringify({ ...currentUser, ...data }));
    editMessage.textContent = 'Profile updated successfully!';
    editMessage.className = 'success-text';
    renderAvatar(data);
  } catch (err) {
    editMessage.textContent = 'Server error.';
    editMessage.className = 'error';
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordMessage.textContent = '';

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;

  const btn = passwordForm.querySelector('button[type="submit"]');
  const original = btn.textContent;
  btn.innerHTML = '<span class="spinner spinner-light"></span> Updating...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/users/me/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      passwordMessage.textContent = data.error || 'Failed to update password';
      passwordMessage.className = 'error';
      return;
    }

    passwordMessage.textContent = 'Password updated successfully!';
    passwordMessage.className = 'success-text';
    passwordForm.reset();
  } catch (err) {
    passwordMessage.textContent = 'Server error.';
    passwordMessage.className = 'error';
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
});

loadCurrentProfile();
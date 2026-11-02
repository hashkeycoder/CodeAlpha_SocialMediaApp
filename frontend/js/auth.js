const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('registerBox').classList.remove('hidden');
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('registerBox').classList.add('hidden');
  document.getElementById('loginBox').classList.remove('hidden');
});

function setBtnLoading(btn, text) {
  btn.dataset.original = btn.textContent;
  btn.innerHTML = `<span class="spinner spinner-light"></span> ${text}`;
  btn.classList.add('btn-loading');
  btn.disabled = true;
}
function resetBtn(btn) {
  btn.textContent = btn.dataset.original;
  btn.classList.remove('btn-loading');
  btn.disabled = false;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const btn = loginForm.querySelector('button[type="submit"]');
  setBtnLoading(btn, 'Logging in...');

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || 'Login failed';
      resetBtn(btn);
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = 'feed.html';
  } catch (err) {
    loginError.textContent = 'Server error. Try again.';
    resetBtn(btn);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';
  const btn = registerForm.querySelector('button[type="submit"]');
  setBtnLoading(btn, 'Creating account...');

  const name = document.getElementById('registerName').value;
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      registerError.textContent = data.error || 'Registration failed';
      resetBtn(btn);
      return;
    }

    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();

    localStorage.setItem('token', loginData.token);
    localStorage.setItem('user', JSON.stringify(loginData.user));
    window.location.href = 'feed.html';
  } catch (err) {
    registerError.textContent = 'Server error. Try again.';
    resetBtn(btn);
  }
});
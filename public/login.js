const API_BASE = '/api';

// If someone is already logged in (user token or admin key still in this
// browser), skip the login page entirely.
function isLoggedIn(){
  return !!localStorage.getItem('lifedrop_token') || !!sessionStorage.getItem('lifedrop_admin_key');
}
if (isLoggedIn()) {
  window.location.href = 'index.html';
}

// ---- Toast helper ----
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ---- Card switching: User Login / Admin Login / Create New Login ----
function showCard(which){
  document.getElementById('userLoginCard').style.display = which === 'user' ? 'block' : 'none';
  document.getElementById('adminLoginCard').style.display = which === 'admin' ? 'block' : 'none';
  document.getElementById('signupCard').style.display = which === 'signup' ? 'block' : 'none';
  document.getElementById('tabUserBtn').classList.toggle('active', which === 'user');
  document.getElementById('tabAdminBtn').classList.toggle('active', which === 'admin');
}

function switchLoginTab(tab){
  showCard(tab); // tab is 'user' or 'admin'
}

document.getElementById('goSignupLink').addEventListener('click', e => {
  e.preventDefault();
  showCard('signup');
});
document.getElementById('backToLoginLink').addEventListener('click', e => {
  e.preventDefault();
  showCard('user');
});

// ---- User Login ----
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    identifier: document.getElementById('loginIdentifier').value.trim(),
    password: document.getElementById('loginPassword').value
  };

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if(!res.ok){
      showToast(data.error || 'Login failed. Check your details and try again.');
      return;
    }

    localStorage.setItem('lifedrop_token', data.token);
    localStorage.setItem('lifedrop_identifier', payload.identifier);
    window.location.href = 'index.html';
  } catch (err) {
    console.error(err);
    showToast('Network error — please try again.');
  }
});

// ---- Admin Login ----
document.getElementById('adminLoginForm').addEventListener('submit', async e => {
  e.preventDefault();

  const key = document.getElementById('adminLoginKeyInput').value.trim();
  if(!key){
    showToast('Please enter the admin key.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/verify`, {
      headers: { 'x-admin-key': key }
    });

    if(!res.ok){
      showToast('Incorrect admin key. Please try again.');
      return;
    }

    sessionStorage.setItem('lifedrop_admin_key', key);
    // Tell index.html to jump straight to the Admin dashboard on load.
    sessionStorage.setItem('lifedrop_land_on_admin', '1');
    window.location.href = 'index.html';
  } catch (err) {
    console.error(err);
    showToast('Could not verify admin key.');
  }
});

// ---- Create New Login (plain signup, no donor details required) ----
document.getElementById('signupForm').addEventListener('submit', async e => {
  e.preventDefault();

  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;

  if(password !== confirmPassword){
    showToast('Passwords do not match. Please re-check.');
    return;
  }
  if(password.length < 6){
    showToast('Password must be at least 6 characters.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password })
    });
    const data = await res.json();

    if(!res.ok){
      if(res.status === 409){
        showToast('An account with this email already exists — please log in instead.');
      } else {
        showToast(data.error || 'Could not create your account.');
      }
      return;
    }

    showToast(`Account created for ${name}! You can now log in.`);
    e.target.reset();
    showCard('user');
  } catch (err) {
    console.error(err);
    showToast('Network error — please try again.');
  }
});

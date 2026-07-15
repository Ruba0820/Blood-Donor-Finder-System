// ---- Auth guard: this whole app (index.html) requires being logged in.
// Login now lives on its own page (login.html) — bounce straight there if
// there's no active session in this browser.
function isLoggedIn(){
  return !!localStorage.getItem('lifedrop_token') || !!sessionStorage.getItem('lifedrop_admin_key');
}
if (!isLoggedIn()) {
  window.location.href = 'login.html';
}

// ---- Navigation ----
const navLinks = document.querySelectorAll('#navLinks a[data-page]');

function goTo(pageId){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  navLinks.forEach(a => a.classList.toggle('active', a.dataset.page === pageId));
  window.scrollTo({top:0, behavior:'smooth'});
  if(pageId === 'search') runSearch();
  if(pageId === 'admin' && sessionStorage.getItem('lifedrop_admin_key')) showAdminPanel();
}

navLinks.forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    goTo(a.dataset.page);
  });
});

// Only shows the Admin nav link for an active admin session — regular users
// log in via the Admin Login tab (on login.html) to reach it, they don't see
// it sitting in the nav otherwise.
function updateNavForAuth(){
  const isAdmin = !!sessionStorage.getItem('lifedrop_admin_key');
  document.getElementById('navAdminItem').style.display = isAdmin ? '' : 'none';
}

function logout(){
  localStorage.removeItem('lifedrop_token');
  localStorage.removeItem('lifedrop_identifier');
  sessionStorage.removeItem('lifedrop_admin_key');
  window.location.href = 'login.html';
}
document.getElementById('logoutLink').addEventListener('click', e => {
  e.preventDefault();
  logout();
});

// ---- Toast helper ----
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

const API_BASE = '/api';

// ---- Donor search ----
function renderDonors(list){
  const container = document.getElementById('donorResults');
  container.innerHTML = '';
  if(!list || list.length === 0){
    container.innerHTML = '<div class="empty-msg">No donors found for this filter. Try a different city or blood group.</div>';
    return;
  }
  list.forEach(d => {
    const div = document.createElement('div');
    div.className = 'donor-card';
    div.innerHTML = `
      <div><strong>${d.name}</strong><br><span style="color:var(--gray); font-size:0.85rem;">${d.city} &middot; ${d.mobile}</span></div>
      <span class="bg-tag">${d.blood_group}</span>
    `;
    container.appendChild(div);
  });
}

async function runSearch(){
  const city = document.getElementById('searchCity').value;
  const group = document.getElementById('searchGroup').value;
  const container = document.getElementById('donorResults');
  container.innerHTML = '<div class="empty-msg">Searching...</div>';

  try {
    const params = new URLSearchParams({ city, group, activeOnly: 'true' });
    const res = await fetch(`${API_BASE}/donors?${params.toString()}`);
    if(!res.ok) throw new Error('Request failed');
    const data = await res.json();
    renderDonors(data.donors);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="empty-msg">Could not load donors right now. Please try again later.</div>';
  }
}

// Load the full donor list once on page load
runSearch();

// ---- Donor registration ----
// Note: this only saves donor details. Account creation happens separately,
// on login.html's "Create New Login" form — you have to already be logged
// in to reach this page at all (see the auth guard at the top of this file).
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    name: document.getElementById('regName').value.trim(),
    gender: document.querySelector('input[name="gender"]:checked')?.value || 'Male',
    dob: document.getElementById('regDob').value,
    bloodGroup: document.getElementById('regGroup').value,
    weight: document.getElementById('regWeight').value,
    street: document.getElementById('regStreet').value.trim(),
    area: document.getElementById('regArea').value.trim(),
    city: document.getElementById('regCity').value,
    pincode: document.getElementById('regPincode').value.trim(),
    mobile: document.getElementById('regMobile').value.trim(),
    email: document.getElementById('regEmail').value.trim(),
    isActive: document.getElementById('regActive').value
  };

  try {
    const res = await fetch(`${API_BASE}/donors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if(!res.ok){
      showToast(data.error || 'Could not complete registration.');
      return;
    }

    showToast('Thank you! Your donor registration was received.');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Network error — please try again.');
  }
});

// ==================== ADMIN DASHBOARD ====================

// The admin key is kept only for this browser tab (sessionStorage), and sent
// as a header on every admin request. It's a simple gate, not full auth —
// good enough for an internal tool, not for a public-facing production app.
function adminHeaders(){
  return {
    'Content-Type': 'application/json',
    'x-admin-key': sessionStorage.getItem('lifedrop_admin_key') || ''
  };
}

async function unlockAdmin(){
  const key = document.getElementById('adminKeyInput').value.trim();
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
    updateNavForAuth();
    showAdminPanel();
    showToast('Admin unlocked.');
  } catch (err) {
    console.error(err);
    showToast('Could not unlock admin panel.');
  }
}

function showAdminPanel(){
  document.getElementById('adminGate').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadAdminCount();
  loadAdminDonors();
  loadAdminRequests();
}

async function loadAdminCount(){
  try {
    const res = await fetch(`${API_BASE}/donors/stats/count`);
    const data = await res.json();
    document.getElementById('adminTotalCount').textContent = data.total ?? 0;
  } catch (err) {
    console.error(err);
  }
}

function renderAdminTable(list){
  const tbody = document.getElementById('adminDonorTableBody');
  tbody.innerHTML = '';

  if(!list || list.length === 0){
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No donors found.</td></tr>';
    return;
  }

  list.forEach(d => {
    const isActive = d.is_active === 1 || d.is_active === true || d.is_active === '1';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.name}</td>
      <td>${d.city}</td>
      <td>${d.blood_group}</td>
      <td>${d.mobile}</td>
      <td>${d.email || '—'}</td>
      <td><span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="action-btn action-edit" onclick="openEditModal(${d.id})">✏ Edit</button>
        <button class="action-btn action-delete" onclick="deleteDonor(${d.id}, '${d.name.replace(/'/g, "\\'")}')">🗑 Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadAdminDonors(){
  const name = document.getElementById('adminSearchName').value.trim();
  const city = document.getElementById('adminSearchCity').value;
  const group = document.getElementById('adminSearchGroup').value;
  const tbody = document.getElementById('adminDonorTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">Loading...</td></tr>';

  try {
    const params = new URLSearchParams({ city, group, q: name });
    const res = await fetch(`${API_BASE}/donors?${params.toString()}`);
    if(!res.ok) throw new Error('Request failed');
    const data = await res.json();
    renderAdminTable(data.donors);
    document.getElementById('adminTotalCount').textContent = data.donors.length;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">Could not load donors right now.</td></tr>';
  }
}

// Live search as the admin types a name
document.getElementById('adminSearchName').addEventListener('input', () => {
  clearTimeout(window._adminSearchDebounce);
  window._adminSearchDebounce = setTimeout(loadAdminDonors, 300);
});

async function openEditModal(id){
  try {
    const res = await fetch(`${API_BASE}/donors/${id}`);
    if(!res.ok) throw new Error('Could not fetch donor');
    const data = await res.json();
    const d = data.donor;

    document.getElementById('editDonorId').value = d.id;
    document.getElementById('editName').value = d.name;
    document.querySelector(`input[name="editGender"][value="${d.gender}"]`).checked = true;
    document.getElementById('editDob').value = d.dob ? d.dob.split('T')[0] : '';
    document.getElementById('editGroup').value = d.blood_group;
    document.getElementById('editWeight').value = d.weight_kg;
    document.getElementById('editStreet').value = d.street || '';
    document.getElementById('editArea').value = d.area || '';
    document.getElementById('editCity').value = d.city;
    document.getElementById('editPincode').value = d.pincode || '';
    document.getElementById('editMobile').value = d.mobile;
    document.getElementById('editEmail').value = d.email || '';
    document.getElementById('editActive').value = (d.is_active === 1 || d.is_active === true || d.is_active === '1') ? 'true' : 'false';

    document.getElementById('editModalOverlay').classList.add('show');
  } catch (err) {
    console.error(err);
    showToast('Could not load donor details.');
  }
}

function closeEditModal(){
  document.getElementById('editModalOverlay').classList.remove('show');
}

document.getElementById('editDonorForm').addEventListener('submit', async e => {
  e.preventDefault();

  const id = document.getElementById('editDonorId').value;
  const payload = {
    name: document.getElementById('editName').value.trim(),
    gender: document.querySelector('input[name="editGender"]:checked')?.value || 'Male',
    dob: document.getElementById('editDob').value,
    bloodGroup: document.getElementById('editGroup').value,
    weight: document.getElementById('editWeight').value,
    street: document.getElementById('editStreet').value.trim(),
    area: document.getElementById('editArea').value.trim(),
    city: document.getElementById('editCity').value.trim(),
    pincode: document.getElementById('editPincode').value.trim(),
    mobile: document.getElementById('editMobile').value.trim(),
    email: document.getElementById('editEmail').value.trim(),
    isActive: document.getElementById('editActive').value
  };

  try {
    const res = await fetch(`${API_BASE}/donors/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if(!res.ok){
      if(res.status === 401){
        showToast('Admin key rejected. Please unlock again.');
        sessionStorage.removeItem('lifedrop_admin_key');
        document.getElementById('adminGate').style.display = 'block';
        document.getElementById('adminPanel').style.display = 'none';
      } else {
        showToast(data.error || 'Could not update donor.');
      }
      return;
    }

    showToast('Donor updated successfully.');
    closeEditModal();
    loadAdminDonors();
  } catch (err) {
    console.error(err);
    showToast('Network error — please try again.');
  }
});

async function deleteDonor(id, name){
  if(!confirm(`Delete donor "${name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`${API_BASE}/donors/${id}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });
    const data = await res.json();

    if(!res.ok){
      if(res.status === 401){
        showToast('Admin key rejected. Please unlock again.');
        sessionStorage.removeItem('lifedrop_admin_key');
        document.getElementById('adminGate').style.display = 'block';
        document.getElementById('adminPanel').style.display = 'none';
      } else {
        showToast(data.error || 'Could not delete donor.');
      }
      return;
    }

    showToast('Donor deleted.');
    loadAdminDonors();
  } catch (err) {
    console.error(err);
    showToast('Network error — please try again.');
  }
}

// ==================== REQUEST BLOOD ====================

document.getElementById('requestForm').addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    requesterName: document.getElementById('reqName').value.trim(),
    requesterMobile: document.getElementById('reqMobile').value.trim(),
    city: document.getElementById('reqCity').value,
    bloodGroup: document.getElementById('reqGroup').value,
    hospital: document.getElementById('reqHospital').value.trim(),
    message: document.getElementById('reqMessage').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/request-blood`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if(!res.ok){
      showToast(data.error || 'Could not save the request.');
      return;
    }

    showToast(data.message || 'Request saved!');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Network error — please try again.');
  }
});

// ==================== MY DONOR STATUS (self-service active/inactive) ====================

document.getElementById('statusForm').addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    mobile: document.getElementById('statusMobile').value.trim(),
    email: document.getElementById('statusEmail').value.trim(),
    isActive: document.getElementById('statusActive').value
  };

  try {
    const res = await fetch(`${API_BASE}/donors/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if(!res.ok){
      showToast(data.error || 'Could not update your status.');
      return;
    }

    showToast(data.message || 'Status updated.');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Network error — please try again.');
  }
});

// ==================== ADMIN: RECENT BLOOD REQUESTS (read-only) ====================

function renderAdminRequests(list){
  const tbody = document.getElementById('adminRequestsTableBody');
  tbody.innerHTML = '';

  if(!list || list.length === 0){
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No blood requests yet.</td></tr>';
    return;
  }

  list.forEach(r => {
    const tr = document.createElement('tr');
    const date = r.created_at ? new Date(r.created_at).toLocaleString() : '—';
    tr.innerHTML = `
      <td>${r.requester_name}</td>
      <td>${r.requester_mobile}</td>
      <td>${r.city}</td>
      <td>${r.blood_group}</td>
      <td>${r.hospital || '—'}</td>
      <td>${r.message || '—'}</td>
      <td>${date}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadAdminRequests(){
  const tbody = document.getElementById('adminRequestsTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">Loading...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/request-blood`, { headers: adminHeaders() });
    if(!res.ok) throw new Error('Request failed');
    const data = await res.json();
    renderAdminRequests(data.requests);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">Could not load blood requests right now.</td></tr>';
  }
}

// ==================== APP STARTUP ====================
// (The auth guard at the top of this file already sent anyone who isn't
// logged in back to login.html, so by this point we know there's a session.)
updateNavForAuth();

if (sessionStorage.getItem('lifedrop_land_on_admin')) {
  sessionStorage.removeItem('lifedrop_land_on_admin');
  goTo('admin');
} else {
  goTo('home');
}

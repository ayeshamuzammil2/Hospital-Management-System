const authOverlay = document.getElementById('authOverlay');
const adminOverlay = document.getElementById('adminOverlay');
let currentRole = 'patient';
let currentTab = 'signup';

const forms = {
  patient: { signup: 'patientSignupForm', signin: 'patientSigninForm', forgot: 'patientForgotForm' },
  doctor: { signup: 'doctorSignupForm', signin: 'doctorSigninForm', forgot: 'doctorForgotForm' }
};

function openAuth(role = 'patient', tab = 'signup') {
  currentRole = role;
  currentTab = tab;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderForm();
  authOverlay.classList.remove('hidden');
}

function closeAuth() {
  authOverlay.classList.add('hidden');
  clearMessages();
}

function clearMessages() {
  document.getElementById('formError').classList.remove('show');
  document.getElementById('formSuccess').classList.remove('show');
}

function renderForm() {
  clearMessages();
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  const formId = forms[currentRole][currentTab];
  document.getElementById(formId).classList.remove('hidden');

  const hint = document.getElementById('switchHint');
  if (currentTab === 'signup') {
    hint.innerHTML = `Already have an account? <button type="button" onclick="switchTab('signin')">Sign in</button>`;
  } else if (currentTab === 'signin') {
    hint.innerHTML = `New here? <button type="button" onclick="switchTab('signup')">Create an account</button> · <button type="button" onclick="switchTab('forgot')">Forgot password?</button>`;
  } else {
    hint.innerHTML = `Remembered it? <button type="button" onclick="switchTab('signin')">Back to sign in</button>`;
  }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderForm();
}

document.getElementById('roleToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.role-btn');
  if (!btn) return;
  currentRole = btn.dataset.role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b === btn));
  renderForm();
});

document.getElementById('authTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

document.getElementById('openSignup').addEventListener('click', () => openAuth('patient', 'signup'));
document.getElementById('openSignin').addEventListener('click', () => openAuth('patient', 'signin'));
document.getElementById('heroPatientBtn').addEventListener('click', () => openAuth('patient', 'signup'));
document.getElementById('heroDoctorBtn').addEventListener('click', () => openAuth('doctor', 'signup'));
document.getElementById('closeModal').addEventListener('click', closeAuth);
authOverlay.addEventListener('click', (e) => { if (e.target === authOverlay) closeAuth(); });

document.getElementById('adminLoginBtn').addEventListener('click', () => adminOverlay.classList.remove('hidden'));
document.getElementById('closeAdminModal').addEventListener('click', () => adminOverlay.classList.add('hidden'));
adminOverlay.addEventListener('click', (e) => { if (e.target === adminOverlay) adminOverlay.classList.add('hidden'); });

function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('formSuccess').classList.remove('show');
}
function showSuccess(msg) {
  const el = document.getElementById('formSuccess');
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('formError').classList.remove('show');
}

function formToObject(form) {
  const data = {};
  new FormData(form).forEach((v, k) => data[k] = v);
  return data;
}

// ---------------- Patient signup ----------------
document.getElementById('patientSignupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  const body = formToObject(e.target);
  try {
    await apiRequest('/api/auth/patient/signup', { method: 'POST', body: JSON.stringify(body) });
    showToast('Account created! Redirecting…');
    window.location.href = '/patient/dashboard.html';
  } catch (err) { showError(err.message); }
});

// ---------------- Doctor signup ----------------
document.getElementById('doctorSignupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  const body = formToObject(e.target);
  try {
    await apiRequest('/api/auth/doctor/signup', { method: 'POST', body: JSON.stringify(body) });
    showToast('Doctor account created! Redirecting…');
    window.location.href = '/doctor/dashboard.html';
  } catch (err) { showError(err.message); }
});

// ---------------- Patient signin ----------------
document.getElementById('patientSigninForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  const body = formToObject(e.target);
  try {
    await apiRequest('/api/auth/patient/login', { method: 'POST', body: JSON.stringify(body) });
    window.location.href = '/patient/dashboard.html';
  } catch (err) { showError(err.message); }
});

// ---------------- Doctor signin ----------------
document.getElementById('doctorSigninForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  const body = formToObject(e.target);
  try {
    await apiRequest('/api/auth/doctor/login', { method: 'POST', body: JSON.stringify(body) });
    window.location.href = '/doctor/dashboard.html';
  } catch (err) { showError(err.message); }
});

// ---------------- Patient forgot password ----------------
document.getElementById('patientForgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  const body = formToObject(e.target);
  try {
    const res = await apiRequest('/api/auth/patient/forgot-password', { method: 'POST', body: JSON.stringify(body) });
    showSuccess(res.message);
    e.target.reset();
  } catch (err) { showError(err.message); }
});

// ---------------- Doctor forgot password ----------------
document.getElementById('doctorForgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  const body = formToObject(e.target);
  try {
    const res = await apiRequest('/api/auth/doctor/forgot-password', { method: 'POST', body: JSON.stringify(body) });
    showSuccess(res.message);
    e.target.reset();
  } catch (err) { showError(err.message); }
});

// ---------------- Admin login ----------------
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('adminFormError');
  errEl.classList.remove('show');
  const body = formToObject(e.target);
  try {
    await apiRequest('/api/auth/admin/login', { method: 'POST', body: JSON.stringify(body) });
    window.location.href = '/admin/dashboard.html';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  }
});

// ---------------- Load specialities for landing grid + doctor signup dropdown ----------------
async function loadSpecialities() {
  try {
    const specs = await apiRequest('/api/catalog/specialities');
    const grid = document.getElementById('specialityGrid');
    grid.innerHTML = specs.map(s => `
      <div class="spec-card" onclick="openAuth('patient','signup')">
        <div class="icon">${s.icon}</div>
        <h4>${s.name}</h4>
        <p>Book a specialist</p>
      </div>
    `).join('');

    const select = document.getElementById('doctorSignupSpeciality');
    if (select) {
      select.innerHTML = specs.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// If already logged in, redirect straight to the right dashboard
async function checkExistingSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const { user } = await res.json();
      if (user.role === 'patient') window.location.href = '/patient/dashboard.html';
      else if (user.role === 'doctor') window.location.href = '/doctor/dashboard.html';
      else if (user.role === 'admin') window.location.href = '/admin/dashboard.html';
    }
  } catch (e) { /* not logged in, stay on landing */ }
}

loadSpecialities();
checkExistingSession();

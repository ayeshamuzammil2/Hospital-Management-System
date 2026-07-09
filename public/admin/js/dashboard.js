async function init() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const { user } = await res.json();
    if (user.role !== 'admin') { window.location.href = '/'; return; }
  } catch {
    window.location.href = '/';
    return;
  }
  await loadStats();
}

document.querySelectorAll('.side-link[data-section]').forEach(btn => {
  btn.addEventListener('click', () => goSection(btn.dataset.section));
});

function goSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
  document.getElementById(`section-${name}`).classList.remove('hidden-section');
  document.querySelectorAll('.side-link[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  if (name === 'doctors') loadDoctors();
  if (name === 'patients') loadPatients();
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

async function loadStats() {
  const { totals, dailyRevenue, bySpeciality } = await apiRequest('/api/admin/stats');
  document.getElementById('kpiRevenue').textContent = `Rs. ${Number(totals.total_revenue).toLocaleString()}`;
  document.getElementById('kpiPending').textContent = `Rs. ${Number(totals.pending_revenue).toLocaleString()}`;
  document.getElementById('kpiPatients').textContent = totals.total_patients;
  document.getElementById('kpiDoctors').textContent = totals.total_doctors;

  drawBarChart('revenueChart', dailyRevenue.map(d => ({ label: d.day.slice(5), value: Number(d.revenue) })));
  drawBarChart('specialityChart', bySpeciality.map(s => ({ label: s.speciality, value: Number(s.revenue) })));
}

function drawBarChart(containerId, data) {
  const el = document.getElementById(containerId);
  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">📉</span>No data yet.</div>`;
    return;
  }
  const max = Math.max(...data.map(d => d.value), 1);
  const bars = data.map((d, i) => {
    const heightPct = (d.value / max) * 100;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
        <div style="font-size:.72rem;color:var(--ink-soft);margin-bottom:6px;white-space:nowrap;">Rs.${d.value.toLocaleString()}</div>
        <div style="width:70%;height:160px;display:flex;align-items:flex-end;">
          <div style="width:100%;height:${Math.max(heightPct,3)}%;background:linear-gradient(180deg, var(--mint), var(--sage));border-radius:6px 6px 0 0;"></div>
        </div>
        <div style="font-size:.72rem;color:var(--ink-soft);margin-top:8px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px;">${d.label}</div>
      </div>`;
  }).join('');
  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;overflow-x:auto;padding-top:8px;">${bars}</div>`;
}

async function loadDoctors() {
  const doctors = await apiRequest('/api/admin/doctors');
  const wrap = document.getElementById('doctorsTableWrap');
  if (doctors.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="emoji">🩺</span>No doctors registered yet.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Speciality</th><th>Room</th><th>Fee</th><th>Balance</th></tr></thead>
      <tbody>
        ${doctors.map(d => `
          <tr>
            <td>Dr. ${d.name}</td><td>${d.email}</td><td>${d.speciality}</td>
            <td>${d.room_no}</td><td>Rs. ${Number(d.fee).toLocaleString()}</td>
            <td>Rs. ${Number(d.balance).toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function loadPatients() {
  const patients = await apiRequest('/api/admin/patients');
  const wrap = document.getElementById('patientsTableWrap');
  if (patients.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="emoji">🧑‍🦱</span>No patients registered yet.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Age</th><th>Wallet balance</th><th>Joined</th></tr></thead>
      <tbody>
        ${patients.map(p => `
          <tr>
            <td>${p.name}</td><td>${p.email}</td><td>${p.age}</td>
            <td>Rs. ${Number(p.balance).toLocaleString()}</td>
            <td>${p.created_at.slice(0,10)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

init();
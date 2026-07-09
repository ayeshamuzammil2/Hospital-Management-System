let me = null;
let mySlots = [];
let editingSlotId = null;

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `API Error: ${res.status}`);
  }
  return res.json();
}

function showToast(message, type = 'success') {
  alert(`${type.toUpperCase()}: ${message}`); 
}

function formatDrName(name) {
  if (!name) return '';
  return name.toLowerCase().startsWith('dr.') ? name : `Dr. ${name}`;
}

async function init() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const { user } = await res.json();
    if (user.role !== 'doctor') { window.location.href = '/'; return; }
  } catch {
    window.location.href = '/';
    return;
  }
  await loadProfile();
  await loadOverview();

  setupSlotModeToggle();
}

function setupSlotModeToggle() {
  const modeSelect = document.getElementById('slotMode');
  const singleDateGroup = document.getElementById('singleDateGroup');
  const bulkDateGroup = document.getElementById('bulkDateGroup');
  const weekDaysGroup = document.getElementById('weekDaysGroup');

  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'bulk') {
        if (singleDateGroup) singleDateGroup.style.display = 'none';
        if (bulkDateGroup) bulkDateGroup.style.display = 'flex';
        if (weekDaysGroup) weekDaysGroup.style.display = 'block';
      } else {
        if (singleDateGroup) singleDateGroup.style.display = 'block';
        if (bulkDateGroup) bulkDateGroup.style.display = 'none';
        if (weekDaysGroup) weekDaysGroup.style.display = 'none';
      }
    });
  }
}

document.querySelectorAll('.side-link[data-section]').forEach(btn => {
  btn.addEventListener('click', () => goSection(btn.dataset.section));
});

function goSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
  const section = document.getElementById(`section-${name}`);
  if (section) section.classList.remove('hidden-section');
  
  document.querySelectorAll('.side-link[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  if (name === 'queue') loadQueue();
  if (name === 'patients') loadPatientsTable();
  if (name === 'slots') loadSlotsTable();
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

async function loadProfile() {
  try {
    me = await apiRequest('/api/doctors/me');
    document.getElementById('sideName').textContent = formatDrName(me.name);
    document.getElementById('sideEmail').textContent = me.email;
    document.getElementById('sideAvatar').textContent = me.name.charAt(0).toUpperCase();
    document.getElementById('welcomeHeading').textContent = `Welcome, ${formatDrName(me.name)} 👋`;
    document.getElementById('kpiBalance').textContent = `Rs. ${Number(me.balance).toLocaleString()}`;
    document.getElementById('profileName').value = me.name;
    document.getElementById('profileEmail').value = me.email;
    document.getElementById('profileSpeciality').value = me.speciality;
    document.getElementById('profileRoom').value = me.room_no;
    document.getElementById('profileFee').value = me.fee;
    document.getElementById('profileBio').value = me.bio || '';
  } catch (err) { console.error(err); }
}

document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { if (v) data[k] = v; });
  try {
    await apiRequest('/api/doctors/me', { method: 'PUT', body: JSON.stringify(data) });
    showToast('Profile updated.');
    await loadProfile();
    if (e.target.password) e.target.password.value = '';
  } catch (err) { showToast(err.message, 'error'); }
});

async function loadOverview() {
  try {
    const [queue, all] = await Promise.all([
      apiRequest('/api/appointments/queue/today'),
      apiRequest('/api/appointments/doctor/all')
    ]);
    document.getElementById('kpiQueue').textContent = queue.length;
    document.getElementById('kpiTotal').textContent = all.length;
    const cashPending = all
      .filter(a => a.payment_method === 'cash' && a.payment_status_detail === 'pending')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
    document.getElementById('kpiCashPending').textContent = `Rs. ${cashPending.toLocaleString()}`;

    const box = document.getElementById('nextInQueueBox');
    if (!box) return;
    if (queue.length === 0) {
      box.innerHTML = `<div class="empty-state"><span class="emoji">☕</span>No one waiting right now.</div>`;
    } else {
      const q = queue[0];
      box.innerHTML = `
        <div class="queue-item">
          <div class="queue-num">#${q.queue_position}</div>
          <div class="info"><h4>${q.patient_name} (age ${q.age})</h4><span>${q.start_time.slice(0,5)}–${q.end_time.slice(0,5)}</span></div>
          <button class="btn btn-primary btn-sm" onclick="checkIn(${q.id})">Mark as checked ✔</button>
        </div>`;
    }
  } catch (err) { console.error(err); }
}

async function loadQueue() {
  try {
    const queue = await apiRequest('/api/appointments/queue/today');
    const box = document.getElementById('queueBox');
    if (!box) return;
    if (queue.length === 0) {
      box.innerHTML = `<div class="empty-state"><span class="emoji">☕</span>No patients waiting today.</div>`;
      return;
    }
    box.innerHTML = queue.map(q => `
      <div class="queue-item">
        <div class="queue-num">#${q.queue_position}</div>
        <div class="info">
          <h4>${q.patient_name} (age ${q.age})</h4>
          <span>${q.start_time.slice(0,5)}–${q.end_time.slice(0,5)} · ${q.payment_method === 'cash' ? (q.payment_status_detail === 'paid' ? 'Cash paid' : 'Cash due') : 'Paid by card'}</span>
        </div>
        ${q.payment_method === 'cash' && q.payment_status_detail === 'pending' ? `<button class="btn btn-outline btn-sm" onclick="confirmCash(${q.id})">Confirm cash</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="checkIn(${q.id})">Mark checked ✔</button>
      </div>
    `).join('');
  } catch (err) { showToast(err.message, 'error'); }
}

window.checkIn = async function(id) {
  try {
    await apiRequest(`/api/appointments/${id}/check-in`, { method: 'PUT' });
    showToast('Patient marked as checked. Removed from queue.');
    const activeSection = document.querySelector('.side-link.active')?.dataset.section;
    if (activeSection === 'queue') loadQueue();
    loadOverview();
  } catch (err) { showToast(err.message, 'error'); }
};

window.confirmCash = async function(id) {
  try {
    await apiRequest(`/api/appointments/${id}/confirm-cash`, { method: 'PUT' });
    showToast('Cash payment confirmed.');
    const activeSection = document.querySelector('.side-link.active')?.dataset.section;
    if (activeSection === 'queue') loadQueue();
    if (activeSection === 'patients') loadPatientsTable();
    loadProfile();
    loadOverview();
  } catch (err) { showToast(err.message, 'error'); }
};

async function loadPatientsTable() {
  try {
    const rows = await apiRequest('/api/appointments/doctor/all');
    const wrap = document.getElementById('patientsTableWrap');
    if (!wrap) return;
    if (rows.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><span class="emoji">🗂️</span>No appointments yet.</div>`;
      return;
    }
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Patient</th><th>Age</th><th>Date & time</th><th>Status</th><th>Payment</th><th>Amount</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.map(a => `
            <tr>
              <td>${a.patient_name}<br><span style="color:var(--ink-soft);font-size:.78rem;">${a.patient_email}</span></td>
              <td>${a.age}</td>
              <td>${a.appointment_date.slice(0,10)} · ${a.start_time.slice(0,5)}</td>
              <td><span class="badge badge-${a.status}">${a.status}</span></td>
              <td><span class="badge badge-${a.payment_status_detail === 'paid' ? 'paid' : 'pending'}">${a.payment_method || '-'} · ${a.payment_status_detail || '-'}</span></td>
              <td>Rs. ${Number(a.amount || 0).toLocaleString()}</td>
              <td>
                ${a.status === 'waiting' ? `<button class="btn btn-primary btn-sm" onclick="checkIn(${a.id})">Check ✔</button>` : ''}
                ${a.payment_method === 'cash' && a.payment_status_detail === 'pending' ? `<button class="btn btn-outline btn-sm" onclick="confirmCash(${a.id})">Confirm cash</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (err) { showToast(err.message, 'error'); }
}

document.getElementById('addSlotForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const mode = fd.get('slotMode'); // 'single' or 'bulk'
  const startTime = fd.get('startTime');
  const endTime = fd.get('endTime');
  
  let slotsArray = [];

  if (mode === 'single') {
    const singleDate = fd.get('date');
    if (!singleDate || !startTime || !endTime) {
      showToast('All fields are required.', 'error');
      return;
    }
    slotsArray.push({ date: singleDate, startTime, endTime });
  } else {
    const startDateStr = fd.get('startDate');
    const endDateStr = fd.get('endDate');
    const selectedDays = Array.from(e.target.querySelectorAll('input[name="days"]:checked')).map(cb => parseInt(cb.value));

    if (!startDateStr || !endDateStr || selectedDays.length === 0 || !startTime || !endTime) {
      showToast('Please select date range and at least one day.', 'error');
      return;
    }

    let current = new Date(startDateStr);
    const end = new Date(endDateStr);

    while (current <= end) {
      const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      if (selectedDays.includes(dayOfWeek)) {
        slotsArray.push({
          date: current.toISOString().slice(0, 10),
          startTime: startTime,
          endTime: endTime
        });
      }
      current.setDate(current.getDate() + 1);
    }
  }

  if (slotsArray.length === 0) {
    showToast('No valid slots created for selected dates.', 'error');
    return;
  }

  try {
    await apiRequest('/api/doctors/me/slots', { 
      method: 'POST', 
      body: JSON.stringify({ slots: slotsArray }) 
    });
    
    showToast(`${slotsArray.length} Slot(s) successfully generated.`);
    e.target.reset();
    setupSlotModeToggle(); // reset view elements style
    loadSlotsTable();
  } catch (err) { showToast(err.message, 'error'); }
});

async function loadSlotsTable() {
  try {
    mySlots = await apiRequest('/api/doctors/me/slots');
    editingSlotId = null;
    renderSlotsTable();
  } catch (err) { console.error(err); }
}

function renderSlotsTable() {
  const wrap = document.getElementById('slotsTableWrap');
  if (!wrap) return;
  if (mySlots.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="emoji">🕒</span>No slots added yet.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${mySlots.map(s => renderSlotRow(s)).join('')}
      </tbody>
    </table>`;
}

function renderSlotRow(s) {
  if (editingSlotId === s.id) {
    return `
      <tr>
        <td colspan="4">
          <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;">
            <div class="field" style="margin:0;"><label>Date</label><input type="date" id="editDate-${s.id}" value="${s.slot_date.slice(0,10)}"></div>
            <div class="field" style="margin:0;"><label>Start</label><input type="time" id="editStart-${s.id}" value="${s.start_time.slice(0,5)}"></div>
            <div class="field" style="margin:0;"><label>End</label><input type="time" id="editEnd-${s.id}" value="${s.end_time.slice(0,5)}"></div>
            <button class="btn btn-primary btn-sm" onclick="saveSlotEdit(${s.id})">Save</button>
            <button class="btn btn-ghost btn-sm" onclick="cancelSlotEdit()">Cancel</button>
          </div>
        </td>
      </tr>`;
  }
  return `
    <tr>
      <td>${s.slot_date.slice(0,10)}</td>
      <td>${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}</td>
      <td><span class="badge ${s.is_booked ? 'badge-waiting' : 'badge-paid'}">${s.is_booked ? 'Booked' : 'Open'}</span></td>
      <td>
        ${s.is_booked
          ? `<span style="color:var(--ink-soft);font-size:.8rem;">Locked</span>`
          : `<button class="btn btn-outline btn-sm" onclick="startSlotEdit(${s.id})">Edit</button>
             <button class="btn btn-danger btn-sm" onclick="deleteSlot(${s.id})">Delete</button>`}
      </td>
    </tr>`;
}

window.startSlotEdit = function(id) {
  editingSlotId = id;
  renderSlotsTable();
};

window.cancelSlotEdit = function() {
  editingSlotId = null;
  renderSlotsTable();
};

window.saveSlotEdit = async function(id) {
  const date = document.getElementById(`editDate-${id}`).value;
  const startTime = document.getElementById(`editStart-${id}`).value;
  const endTime = document.getElementById(`editEnd-${id}`).value;
  if (!date || !startTime || !endTime) {
    showToast('Please fill date, start time and end time.', 'error');
    return;
  }
  try {
    await apiRequest(`/api/doctors/me/slots/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ date, startTime, endTime })
    });
    showToast('Slot updated.');
    await loadSlotsTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteSlot = async function(id) {
  if (!confirm('Delete this slot? This cannot be undone.')) return;
  try {
    await apiRequest(`/api/doctors/me/slots/${id}`, { method: 'DELETE' });
    showToast('Slot deleted.');
    await loadSlotsTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

init();
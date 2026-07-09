let me = null;
let lastReceipt = null;
let booking = { specialityId: null, specialityName: '', doctor: null, slot: null, method: null };

async function init() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const { user } = await res.json();
    if (user.role !== 'patient') { window.location.href = '/'; return; }
  } catch {
    window.location.href = '/';
    return;
  }
  await loadProfile();
  await loadAppointmentsOverview();
  loadSpecialitiesForBooking();
}

document.querySelectorAll('.side-link[data-section]').forEach(btn => {
  btn.addEventListener('click', () => goSection(btn.dataset.section));
});

function goSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
  document.getElementById(`section-${name}`).classList.remove('hidden-section');
  document.querySelectorAll('.side-link[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  if (name === 'appointments') loadAppointmentsTable();
  if (name === 'book') resetBookingFlow();
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

async function loadProfile() {
  me = await apiRequest('/api/patients/me');
  document.getElementById('sideName').textContent = me.name;
  document.getElementById('sideEmail').textContent = me.email;
  document.getElementById('sideAvatar').textContent = me.name.charAt(0).toUpperCase();
  document.getElementById('kpiBalance').textContent = `Rs. ${Number(me.balance).toLocaleString()}`;
  document.getElementById('profileName').value = me.name;
  document.getElementById('profileEmail').value = me.email;
  document.getElementById('profileAge').value = me.age;
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { if (v) data[k] = v; });
  try {
    await apiRequest('/api/patients/me', { method: 'PUT', body: JSON.stringify(data) });
    showToast('Profile updated.');
    await loadProfile();
    e.target.password.value = '';
  } catch (err) { showToast(err.message, 'error'); }
});

async function loadAppointmentsOverview() {
  const appts = await apiRequest('/api/appointments/mine');
  const upcoming = appts.filter(a => a.status === 'waiting');
  document.getElementById('kpiUpcoming').textContent = upcoming.length;
  document.getElementById('kpiTotal').textContent = appts.length;

  const box = document.getElementById('nextAppointmentBox');
  if (upcoming.length === 0) {
    box.innerHTML = `<div class="empty-state"><span class="emoji">🗓️</span>No upcoming appointments yet.</div>`;
  } else {
    const a = upcoming[0];
    box.innerHTML = `
      <div class="doctor-card" style="cursor:default;">
        <div class="avatar">${a.doctor_name.charAt(0)}</div>
        <div class="info">
          <h4>${formatDrName(a.doctor_name)} — ${a.speciality}</h4>
          <p>${a.appointment_date.slice(0,10)} at ${a.start_time.slice(0,5)} · Room ${a.room_no}</p>
        </div>
        <span class="badge badge-${a.payment_status_detail === 'paid' ? 'paid' : 'pending'}">${a.payment_status_detail === 'paid' ? 'Paid' : 'Payment pending'}</span>
      </div>`;
  }
}

async function loadAppointmentsTable() {
  const appts = await apiRequest('/api/appointments/mine');
  const wrap = document.getElementById('appointmentsTableWrap');
  if (appts.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="emoji">📭</span>No appointments yet. Book your first one!</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Doctor</th><th>Speciality</th><th>Date & time</th><th>Room</th><th>Status</th><th>Payment</th><th></th></tr></thead>
      <tbody>
        ${appts.map(a => `
          <tr>
            <td>${formatDrName(a.doctor_name)}</td>
            <td>${a.speciality}</td>
            <td>${a.appointment_date.slice(0,10)} · ${a.start_time.slice(0,5)}</td>
            <td>${a.room_no}</td>
            <td><span class="badge badge-${a.status}">${a.status}</span></td>
            <td><span class="badge badge-${a.payment_status_detail === 'paid' ? 'paid' : 'pending'}">${a.payment_status_detail === 'paid' ? 'Paid' : (a.payment_method === 'cash' ? 'Cash due' : 'Pending')}</span></td>
            <td>${a.status === 'waiting' ? `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${a.id})">Cancel</button>` : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

async function cancelAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await apiRequest(`/api/appointments/${id}/cancel`, { method: 'PUT' });
    showToast('Appointment cancelled.');
    loadAppointmentsTable();
    loadAppointmentsOverview();
  } catch (err) { showToast(err.message, 'error'); }
}

function resetBookingFlow() {
  booking = { specialityId: null, specialityName: '', doctor: null, slot: null, method: null };
  goStep(1);
  document.getElementById('cardForm').classList.add('hidden-section');
  document.getElementById('confirmPaymentBtn').disabled = true;
  document.querySelectorAll('.pay-method').forEach(p => p.classList.remove('selected'));
}

function goStep(n) {
  document.querySelectorAll('.booking-step').forEach(s => s.classList.add('hidden-section'));
  document.getElementById(`step-${n}`).classList.remove('hidden-section');
  document.querySelectorAll('.step-pill').forEach(p => {
    const step = Number(p.dataset.step);
    p.classList.toggle('active', step === n);
    p.classList.toggle('done', step < n);
  });

  if (!window.history.state || window.history.state.step !== n) {
    window.history.pushState({ step: n }, `Step ${n}`);
  }
}

window.addEventListener('popstate', (event) => {
  const activeSection = document.querySelector('section:not(.hidden-section)');
  if (activeSection && activeSection.id === 'section-book') {
    if (event.state && event.state.step) {
      const n = event.state.step;
      document.querySelectorAll('.booking-step').forEach(s => s.classList.add('hidden-section'));
      const stepEl = document.getElementById(`step-${n}`);
      if (stepEl) {
        stepEl.classList.remove('hidden-section');
        document.querySelectorAll('.step-pill').forEach(p => {
          const step = Number(p.dataset.step);
          p.classList.toggle('active', step === n);
          p.classList.toggle('done', step < n);
        });
      }
    } else {
      document.querySelectorAll('.booking-step').forEach(s => s.classList.add('hidden-section'));
      document.getElementById('step-1').classList.remove('hidden-section');
      document.querySelectorAll('.step-pill').forEach((p, i) => {
        p.classList.toggle('active', i === 0);
        p.classList.remove('done');
      });
    }
  }
});

async function loadSpecialitiesForBooking() {
  const specs = await apiRequest('/api/catalog/specialities');
  document.getElementById('bookSpecialityGrid').innerHTML = specs.map(s => `
    <div class="spec-card" onclick="selectSpeciality(${s.id}, '${s.name.replace(/'/g,"")}')">
      <div class="icon">${s.icon}</div>
      <h4>${s.name}</h4>
      <p>View doctors →</p>
    </div>
  `).join('');
}

async function selectSpeciality(id, name) {
  booking.specialityId = id;
  booking.specialityName = name;
  const doctors = await apiRequest(`/api/catalog/doctors?specialityId=${id}`);
  const list = document.getElementById('doctorList');
  if (doctors.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span>No doctors in ${name} yet.</div>`;
  } else {
    list.innerHTML = doctors.map(d => `
      <div class="doctor-card" onclick='selectDoctor(${JSON.stringify(d)})'>
        <div class="avatar">${d.name.charAt(0)}</div>
        <div class="info">
          <h4>${formatDrName(d.name)}</h4>
          <p>${d.speciality_icon} ${d.speciality} · Room ${d.room_no}${d.bio ? ' · ' + d.bio : ''}</p>
        </div>
        <div class="fee">Rs. ${Number(d.fee).toLocaleString()}</div>
      </div>
    `).join('');
  }
  goStep(2);
}

async function selectDoctor(doctor) {
  booking.doctor = doctor;
  const slots = await apiRequest(`/api/catalog/doctors/${doctor.id}/slots`);
  const grid = document.getElementById('slotGrid');
  if (slots.length === 0) {
    grid.innerHTML = `<div class="empty-state"><span class="emoji">😔</span>No open slots right now for ${formatDrName(doctor.name)}.</div>`;
  } else {
    grid.innerHTML = slots.map(s => `
      <button type="button" class="slot-btn" onclick='selectSlot(${JSON.stringify(s)}, this)'>
        ${s.slot_date.slice(0,10)}<br>${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}
      </button>
    `).join('');
  }
  goStep(3);
}

function selectSlot(slot, el) {
  booking.slot = slot;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('paySummaryDoctor').textContent = `${formatDrName(booking.doctor.name)} (${booking.specialityName})`;
  document.getElementById('paySummarySlot').textContent = `${slot.slot_date.slice(0,10)} · ${slot.start_time.slice(0,5)}–${slot.end_time.slice(0,5)}`;
  document.getElementById('paySummaryFee').textContent = `Rs. ${Number(booking.doctor.fee).toLocaleString()}`;
  goStep(4);
}

document.querySelectorAll('.pay-method').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.pay-method').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    booking.method = el.dataset.method;
    document.getElementById('cardForm').classList.toggle('hidden-section', booking.method !== 'card');
    document.getElementById('confirmPaymentBtn').disabled = false;
  });
});

document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
  const payload = { doctorId: booking.doctor.id, slotId: booking.slot.id, paymentMethod: booking.method };
  if (booking.method === 'card') {
    const cardForm = document.getElementById('cardForm');
    if (!cardForm.checkValidity()) { cardForm.reportValidity(); return; }
    const fd = new FormData(cardForm);
    payload.card = { name: fd.get('name'), number: fd.get('number'), expiry: fd.get('expiry'), cvv: fd.get('cvv') };
  }
  try {
    const res = await apiRequest('/api/appointments/book', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('confirmationMessage').textContent = res.message;
    document.getElementById('receiptBox').innerHTML = `
      <h4>🧾 Payment receipt</h4>
      <p class="muted">${res.payment.receipt_no}</p>
      <div class="receipt-row"><span>Doctor</span><span>${formatDrName(res.doctor.name)}</span></div>
      <div class="receipt-row"><span>Room</span><span>${res.doctor.room_no}</span></div>
      <div class="receipt-row"><span>Method</span><span>${res.payment.method.toUpperCase()}</span></div>
      <div class="receipt-row"><span>Status</span><span>${res.payment.status === 'paid' ? 'Paid ✅' : 'Pay at hospital 💵'}</span></div>
      <div class="receipt-row total"><span>Amount</span><span>Rs. ${Number(res.payment.amount).toLocaleString()}</span></div>
    `;
    lastReceipt = { receipt: res.payment, doctor: res.doctor, patientName: me.name };
    goStep(5);
    loadProfile();
    loadAppointmentsOverview();
    showToast('Appointment booked!');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function printReceipt(data) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = `
    <div style="font-family:'Manrope',sans-serif;max-width:420px;">
      <h2 style="font-family:'Fraunces',serif;margin-bottom:4px;">MediCare+ Payment Receipt</h2>
      <p style="color:#5a6157;margin-top:0;">${data.receipt.receipt_no}</p>
      <hr>
      <p><strong>Patient:</strong> ${data.patientName}</p>
      <p><strong>Doctor:</strong> ${formatDrName(data.doctor.name)}</p>
      <p><strong>Room:</strong> ${data.doctor.room_no}</p>
      <p><strong>Method:</strong> ${data.receipt.method.toUpperCase()}</p>
      <p><strong>Status:</strong> ${data.receipt.status === 'paid' ? 'Paid' : 'Pending (pay at hospital)'}</p>
      <p style="font-size:1.2rem;"><strong>Amount:</strong> Rs. ${Number(data.receipt.amount).toLocaleString()}</p>
      <hr>
      <p style="font-size:.8rem;color:#5a6157;">Printed on ${new Date().toLocaleString()}</p>
    </div>
  `;
  window.print();
}

document.getElementById('printReceiptBtn').addEventListener('click', () => {
  if (lastReceipt) printReceipt(lastReceipt);
});

init();
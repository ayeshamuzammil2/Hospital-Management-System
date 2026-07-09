function showToast(message, type = 'success') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return alert(message);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function formatDrName(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });

  let rawText = '';
  let data = {};
  try {
    rawText = await res.text();
    data = rawText ? JSON.parse(rawText) : {};
  } catch {}

  if (!res.ok) {
    const detail = data.error || (rawText ? rawText.slice(0, 160) : `HTTP ${res.status} ${res.statusText}`);
    throw new Error(detail);
  }
  return data;
}
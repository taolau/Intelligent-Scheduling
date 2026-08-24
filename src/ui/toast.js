const ICONS = { error: '✕', success: '✓', info: 'ℹ' };

export function showToast(msg, type = 'info') {
  let el = document.querySelector('.toast-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icon = document.createElement('span');
  icon.textContent = ICONS[type] ?? 'ℹ';
  const text = document.createElement('span');
  text.textContent = msg;
  t.append(icon, text);
  el.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

export function showToast(msg, type = 'info') {
  let el = document.querySelector('#toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(el);
  }
  const t = document.createElement('div');
  const color = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb';
  t.style.cssText = `background:#fff;border:1px solid ${color};color:${color};padding:10px 14px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.1);`;
  t.textContent = msg;
  el.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

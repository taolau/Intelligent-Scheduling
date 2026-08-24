export function openModal({ title, body, footer }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:10px;max-width:640px;width:92%;max-height:85vh;display:flex;flex-direction:column;';
  const header = document.createElement('div');
  header.style.cssText = 'padding:14px 18px;font-weight:600;border-bottom:1px solid #eee;';
  header.textContent = title;
  const bodyEl = document.createElement('div');
  bodyEl.style.cssText = 'padding:16px 18px;overflow-y:auto;';
  bodyEl.append(body);
  const footerEl = document.createElement('div');
  footerEl.style.cssText = 'padding:12px 18px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px;';
  if (footer) footerEl.append(footer);
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.cssText = 'padding:8px 14px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;';
  closeBtn.onclick = close;
  footerEl.appendChild(closeBtn);
  box.append(header, bodyEl, footerEl);
  overlay.appendChild(box);
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.body.appendChild(overlay);
  function close() { overlay.remove(); }
  return { close };
}

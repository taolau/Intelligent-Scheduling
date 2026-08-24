export function openModal({ title, body, footer }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const box = document.createElement('div');
  box.className = 'modal-box';
  const header = document.createElement('div');
  header.className = 'modal-header';
  header.textContent = title;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  bodyEl.append(body);
  const footerEl = document.createElement('div');
  footerEl.className = 'modal-footer';
  if (footer) footerEl.append(footer);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-default';
  closeBtn.textContent = '关闭';
  closeBtn.onclick = close;
  footerEl.appendChild(closeBtn);
  box.append(header, bodyEl, footerEl);
  overlay.appendChild(box);
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKeydown);
  closeBtn.focus();

  function onKeydown(e) { if (e.key === 'Escape') close(); }
  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  }
  return { close };
}

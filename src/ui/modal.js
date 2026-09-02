import { ICON_X } from './icons.js';

// 弹窗栈：嵌套弹窗时 ESC 只关闭顶层
const stack = [];

export function openModal({ title, body, footer, boxClass = '', closeText = '关闭' }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const box = document.createElement('div');
  box.className = `modal-box${boxClass ? ` ${boxClass}` : ''}`;
  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleEl = document.createElement('div');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;
  const xBtn = document.createElement('button');
  xBtn.type = 'button';
  xBtn.className = 'modal-x';
  xBtn.title = '关闭';
  xBtn.innerHTML = ICON_X;
  xBtn.onclick = close;
  header.append(titleEl, xBtn);
  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  bodyEl.append(body);
  const footerEl = document.createElement('div');
  footerEl.className = 'modal-footer';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-default';
  closeBtn.textContent = closeText;
  closeBtn.onclick = close;
  // 惯例：次要钮（关闭/取消）在左，调用方主按钮（保存/确认）右置
  footerEl.appendChild(closeBtn);
  if (footer) footerEl.append(footer);
  box.append(header, bodyEl, footerEl);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKeydown);
  // 焦点进弹窗容器而非「关闭」钮：程序化 focus 按钮 + 键盘启发式会点亮 .btn:focus-visible
  // 光晕并常驻（点弹窗内容不转移焦点）。容器 tabindex=-1 保键盘可达（Tab 进入），按钮不亮环
  box.tabIndex = -1;
  box.focus();
  stack.push(close);

  function onKeydown(e) {
    if (e.key === 'Escape' && stack[stack.length - 1] === close) close();
  }
  function close() {
    const i = stack.indexOf(close);
    if (i >= 0) stack.splice(i, 1);
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  }
  return { close };
}

// 破坏性操作二次确认弹窗：左取消 + 右红色确认钮，确认后执行 onConfirm
export function confirmDialog({ title = '确认删除', message, confirmText = '确认', onConfirm }) {
  const body = document.createElement('div');
  body.className = 'modal-msg';
  body.textContent = message;
  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-danger';
  okBtn.textContent = confirmText;
  const modal = openModal({ title, body, footer: okBtn, boxClass: 'box-confirm', closeText: '取消' });
  okBtn.onclick = async () => { modal.close(); await onConfirm(); };
  return modal;
}

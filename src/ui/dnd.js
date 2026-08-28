export function enableDrag(sourceEl, { onDragStart }) {
  sourceEl.draggable = true;
  sourceEl.addEventListener('dragstart', (e) => {
    onDragStart(e, sourceEl);
  });
}

export function enableDrop(targetEl, { onDrop, highlightClass = 'drop-target' }) {
  let leaveTimer = null;
  targetEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    clearTimeout(leaveTimer);
    targetEl.classList.add(highlightClass);
  });
  targetEl.addEventListener('dragleave', () => {
    // 延迟移除：鼠标在格子边缘时 dragover/dragleave 会快速交替，立即移除导致高亮闪烁
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => targetEl.classList.remove(highlightClass), 100);
  });
  targetEl.addEventListener('drop', (e) => {
    e.preventDefault();
    clearTimeout(leaveTimer);
    targetEl.classList.remove(highlightClass);
    onDrop(e, targetEl);
  });
}

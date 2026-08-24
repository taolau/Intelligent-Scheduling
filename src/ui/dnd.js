export function enableDrag(sourceEl, { onDragStart }) {
  sourceEl.draggable = true;
  sourceEl.addEventListener('dragstart', (e) => {
    onDragStart(e, sourceEl);
  });
}

export function enableDrop(targetEl, { onDrop, highlightClass = 'drop-target' }) {
  targetEl.addEventListener('dragover', (e) => { e.preventDefault(); targetEl.classList.add(highlightClass); });
  targetEl.addEventListener('dragleave', () => targetEl.classList.remove(highlightClass));
  targetEl.addEventListener('drop', (e) => {
    e.preventDefault();
    targetEl.classList.remove(highlightClass);
    onDrop(e, targetEl);
  });
}

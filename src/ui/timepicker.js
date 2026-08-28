import { ICON_CLOCK } from './icons.js';

let openEl = null;

function closeOpen() {
  if (openEl) { openEl.classList.remove('open'); openEl = null; }
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export function createTimePicker({ value = '', placeholder = '请选择' } = {}) {
  const el = document.createElement('div');
  el.className = 'tr';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'tr-trigger';
  const valueBox = document.createElement('span');
  valueBox.className = 'tr-value';
  const icon = document.createElement('span');
  icon.className = 'tr-chevron';
  icon.innerHTML = ICON_CLOCK;
  trigger.append(valueBox, icon);

  const panel = document.createElement('div');
  panel.className = 'tr-panel';
  const cols = document.createElement('div');
  cols.className = 'tp-cols';
  const hCol = document.createElement('div');
  hCol.className = 'tp-col';
  const mCol = document.createElement('div');
  mCol.className = 'tp-col';
  cols.append(hCol, mCol);
  panel.append(cols);
  el.append(trigger, panel);

  let h = '';
  let m = '';

  function setValue(v) {
    const [hh, mm] = String(v ?? '').split(':');
    h = hh ?? '';
    m = mm ?? '';
    renderValue();
  }

  function renderValue() {
    const val = h && m ? `${h}:${m}` : '';
    valueBox.textContent = val || placeholder;
    valueBox.classList.toggle('placeholder', !val);
  }

  function buildCol(colEl, items, current) {
    colEl.innerHTML = '';
    for (const it of items) {
      const opt = document.createElement('div');
      opt.className = 'sel-opt';
      const check = document.createElement('span');
      check.className = 'sel-check';
      const lab = document.createElement('span');
      lab.className = 'sel-opt-label';
      lab.textContent = it;
      opt.append(check, lab);
      opt.classList.toggle('selected', it === current);
      opt.onclick = (e) => {
        e.stopPropagation();
        if (colEl === hCol) h = it; else m = it;
        renderValue();
        const hScroll = hCol.scrollTop;
        const mScroll = mCol.scrollTop;
        renderPanel();
        hCol.scrollTop = hScroll;
        mCol.scrollTop = mScroll;
        emit();
        if (colEl === mCol) close();
      };
      colEl.appendChild(opt);
    }
  }

  function renderPanel() {
    buildCol(hCol, HOURS, h);
    buildCol(mCol, MINUTES, m);
  }

  function positionPanel() {
    const r = trigger.getBoundingClientRect();
    const panelH = panel.offsetHeight || 280;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    let top = r.bottom + 4;
    if (spaceBelow < panelH + 8 && spaceAbove > spaceBelow) {
      top = Math.max(8, r.top - panelH - 4);
    }
    panel.style.position = 'fixed';
    panel.style.top = `${top}px`;
    panel.style.left = `${r.left}px`;
    panel.style.width = `${r.width}px`;
  }

  function clearPanelPosition() {
    panel.style.position = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
  }

  function open() {
    closeOpen();
    openEl = el;
    el.classList.add('open');
    renderPanel();
    positionPanel();
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
  }

  function onScroll() {
    if (el.classList.contains('open')) positionPanel();
  }

  function close() {
    el.classList.remove('open');
    if (openEl === el) openEl = null;
    clearPanelPosition();
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    el.classList.contains('open') ? close() : open();
  });
  document.addEventListener('click', () => close());

  Object.defineProperty(el, 'value', {
    get() { return h && m ? `${h}:${m}` : ''; },
    set(v) { setValue(v); },
  });

  function emit() {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  setValue(value);
  return el;
}

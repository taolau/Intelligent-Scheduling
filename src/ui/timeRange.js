const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

export function createTimeRange({ value = {}, options = [], defaults = {} }) {
  const state = {
    label: value.label ?? '',
    startTime: value.startTime ?? '',
    endTime: value.endTime ?? '',
  };

  const el = document.createElement('div');
  el.className = 'tr';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'tr-trigger';
  const val = document.createElement('span');
  val.className = 'tr-value';
  const chevron = document.createElement('span');
  chevron.className = 'tr-chevron';
  chevron.innerHTML = CHEVRON;
  trigger.append(val, chevron);

  const panel = document.createElement('div');
  panel.className = 'tr-panel';

  const chipsRow = document.createElement('div');
  chipsRow.className = 'tr-chips';
  const chipEls = new Map();
  for (const lab of options) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'tr-chip';
    c.textContent = lab;
    c.onclick = () => pickLabel(lab);
    chipEls.set(lab, c);
    chipsRow.appendChild(c);
  }

  const startInput = document.createElement('input');
  startInput.className = 'input';
  startInput.type = 'time';
  startInput.value = state.startTime;
  startInput.onchange = () => {
    state.startTime = startInput.value;
    if (state.endTime && state.startTime > state.endTime) {
      state.endTime = state.startTime;
      endInput.value = state.endTime;
    }
    render();
    emit();
  };

  const endInput = document.createElement('input');
  endInput.className = 'input';
  endInput.type = 'time';
  endInput.value = state.endTime;
  endInput.onchange = () => {
    state.endTime = endInput.value;
    if (state.startTime && state.startTime > state.endTime) {
      state.startTime = state.endTime;
      startInput.value = state.startTime;
    }
    render();
    emit();
  };

  const sep = document.createElement('span');
  sep.textContent = '~';
  const timesRow = document.createElement('div');
  timesRow.className = 'tr-times';
  timesRow.append(startInput, sep, endInput);

  panel.append(chipsRow, timesRow);
  el.append(trigger, panel);
  panel.addEventListener('click', (e) => e.stopPropagation());

  function render() {
    val.textContent = state.label
      ? `${state.label} ${state.startTime} ~ ${state.endTime}`
      : '选择时段';
    val.classList.toggle('placeholder', !state.label);
    for (const [lab, c] of chipEls) c.classList.toggle('on', lab === state.label);
    startInput.value = state.startTime;
    endInput.value = state.endTime;
  }

  function pickLabel(lab) {
    state.label = lab;
    const d = defaults[lab];
    if (d) {
      state.startTime = d.start;
      state.endTime = d.end;
    }
    render();
    emit();
  }

  function positionPanel() {
    const r = trigger.getBoundingClientRect();
    const panelH = panel.offsetHeight || 200;
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

  function clearPanel() {
    panel.style.position = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
  }

  function open() {
    el.classList.add('open');
    positionPanel();
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
  }

  function close() {
    el.classList.remove('open');
    clearPanel();
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
  }

  function onScroll() {
    if (el.classList.contains('open')) positionPanel();
  }

  function emit() {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    el.classList.contains('open') ? close() : open();
  });
  document.addEventListener('click', () => close());

  Object.defineProperty(el, 'value', {
    get() { return { ...state }; },
    set(v) {
      state.label = v?.label ?? '';
      state.startTime = v?.startTime ?? '';
      state.endTime = v?.endTime ?? '';
      render();
    },
  });

  render();
  return el;
}

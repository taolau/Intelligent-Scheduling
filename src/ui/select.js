let openEl = null;

function closeOpen() {
  if (openEl) { openEl.classList.remove('open'); openEl = null; }
}

function toStr(v) {
  return v == null ? null : Array.isArray(v) ? v.map(String) : String(v);
}

function normalize(options) {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: String(o.value), label: o.label, desc: o.desc }));
}

export function createSelect({ options = [], value, multiple = false, placeholder = '请选择' }) {
  const opts = normalize(options);
  const el = document.createElement('div');
  el.className = 'sel';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'sel-trigger';
  const valueBox = document.createElement('span');
  valueBox.className = 'sel-value';
  const chevron = document.createElement('span');
  chevron.className = 'sel-chevron';
  chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  trigger.append(valueBox, chevron);

  const panel = document.createElement('div');
  panel.className = 'sel-panel';
  el.append(trigger, panel);

  let sel = multiple ? new Set() : '';
  const initVal = toStr(value);
  if (multiple) {
    (initVal ?? []).forEach((v) => sel.add(v));
  } else if (initVal != null) {
    sel = initVal;
  }

  const items = [];
  let activeIndex = -1;
  let countEl = null;

  function labelOf(v) {
    const o = opts.find((x) => x.value === v);
    return o ? o.label : v;
  }

  function renderValue() {
    valueBox.classList.remove('placeholder');
    if (multiple) {
      valueBox.innerHTML = '';
      if (sel.size === 0) {
        valueBox.textContent = placeholder;
        valueBox.classList.add('placeholder');
        return;
      }
      for (const v of sel) {
        const tag = document.createElement('span');
        tag.className = 'sel-tag';
        const txt = document.createElement('span');
        txt.textContent = labelOf(v);
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.title = '移除';
        rm.onclick = (e) => {
          e.stopPropagation();
          sel.delete(v);
          renderValue();
          syncPanel();
          emit();
        };
        tag.append(txt, rm);
        valueBox.appendChild(tag);
      }
    } else {
      const o = opts.find((x) => x.value === sel);
      valueBox.textContent = o ? o.label : sel || placeholder;
      if (!o) valueBox.classList.add('placeholder');
    }
  }

  function syncPanel() {
    items.forEach((it, i) => {
      const o = opts[i];
      if (!o) return;
      const isSel = multiple ? sel.has(o.value) : sel === o.value;
      it.classList.toggle('selected', isSel);
      it.classList.toggle('active', i === activeIndex);
    });
    if (countEl) countEl.textContent = `已选 ${sel.size} 项`;
  }

  function renderPanel() {
    panel.innerHTML = '';
    items.length = 0;
    countEl = null;
    if (multiple) {
      countEl = document.createElement('div');
      countEl.className = 'sel-count';
      panel.appendChild(countEl);
    }
    if (opts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sel-empty';
      empty.textContent = '无可用选项';
      panel.appendChild(empty);
      return;
    }
    opts.forEach((o, i) => {
      const opt = document.createElement('div');
      opt.className = 'sel-opt';
      const check = document.createElement('span');
      check.className = 'sel-check';
      const lab = document.createElement('span');
      lab.className = 'sel-opt-label';
      lab.textContent = o.label;
      opt.append(check, lab);
      if (o.desc) {
        const d = document.createElement('span');
        d.className = 'sel-opt-desc';
        d.textContent = o.desc;
        opt.appendChild(d);
      }
      opt.onclick = (e) => {
        e.stopPropagation();
        choose(i);
      };
      panel.appendChild(opt);
      items.push(opt);
    });
    syncPanel();
  }

  function choose(i) {
    const o = opts[i];
    if (!o) return;
    if (multiple) {
      if (sel.has(o.value)) sel.delete(o.value);
      else sel.add(o.value);
      renderValue();
      syncPanel();
    } else {
      sel = o.value;
      renderValue();
      close();
      trigger.focus();
    }
    emit();
  }

  function move(delta) {
    if (opts.length === 0) return;
    if (activeIndex === -1) activeIndex = delta > 0 ? 0 : opts.length - 1;
    else activeIndex = Math.min(opts.length - 1, Math.max(0, activeIndex + delta));
    syncPanel();
    const it = items[activeIndex];
    if (it) it.scrollIntoView({ block: 'nearest' });
  }

  function positionPanel() {
    const r = trigger.getBoundingClientRect();
    const panelH = panel.offsetHeight || 224;
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
    activeIndex = multiple ? -1 : opts.findIndex((o) => o.value === sel);
    renderPanel();
    if (activeIndex < 0) activeIndex = multiple ? -1 : 0;
    syncPanel();
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

  function onKey(e) {
    const opened = el.classList.contains('open');
    if (!opened) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'Escape') {
      close();
      trigger.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) choose(activeIndex);
    }
  }

  function emit() {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    el.classList.contains('open') ? close() : open();
  });
  trigger.addEventListener('keydown', onKey);
  document.addEventListener('click', () => close());

  Object.defineProperty(el, 'value', {
    get() {
      return multiple ? [...sel] : sel;
    },
    set(v) {
      const nv = toStr(v);
      if (multiple) {
        sel.clear();
        (nv ?? []).forEach((x) => sel.add(x));
      } else {
        sel = nv != null ? nv : '';
      }
      renderValue();
    },
  });

  renderValue();
  return el;
}

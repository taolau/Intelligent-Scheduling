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

export function createSelect({ options = [], value, multiple = false, placeholder = '请选择', searchable = false }) {
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
  // 面板内任何点击（搜索框、空态、间隙）都不冒泡到 document，避免误关闭
  panel.addEventListener('click', (e) => e.stopPropagation());
  el.append(trigger, panel);

  // searchable：面板顶部搜索框，输入即过滤；view = 过滤后的当前可见选项
  let query = '';
  let view = opts;
  let searchInput = null;
  let listEl = null;

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
      const o = view[i];
      if (!o) return;
      const isSel = multiple ? sel.has(o.value) : sel === o.value;
      it.classList.toggle('selected', isSel);
      it.classList.toggle('active', i === activeIndex);
    });
    if (countEl) countEl.textContent = `已选 ${sel.size} 项`;
  }

  function filteredView() {
    if (!query) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(query));
  }

  function renderOptions() {
    view = filteredView();
    items.length = 0;
    countEl = null;
    listEl.innerHTML = '';
    if (opts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sel-empty';
      empty.textContent = '无可用选项';
      listEl.appendChild(empty);
      return;
    }
    if (multiple) {
      countEl = document.createElement('div');
      countEl.className = 'sel-count';
      listEl.appendChild(countEl);
    }
    if (view.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sel-empty';
      empty.textContent = '无匹配结果';
      listEl.appendChild(empty);
      return;
    }
    view.forEach((o) => {
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
        choose(o);
      };
      listEl.appendChild(opt);
      items.push(opt);
    });
    syncPanel();
  }

  function renderPanel() {
    panel.innerHTML = '';
    if (searchable) {
      searchInput = document.createElement('input');
      searchInput.className = 'sel-search';
      searchInput.type = 'text';
      searchInput.placeholder = '搜索…';
      searchInput.addEventListener('input', () => {
        query = searchInput.value.trim().toLowerCase();
        renderOptions();
      });
      searchInput.addEventListener('keydown', onKey);
      panel.appendChild(searchInput);
    }
    listEl = document.createElement('div');
    listEl.className = 'sel-list';
    panel.appendChild(listEl);
    renderOptions();
  }

  function choose(o) {
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
    if (view.length === 0) return;
    if (activeIndex === -1) activeIndex = delta > 0 ? 0 : view.length - 1;
    else activeIndex = Math.min(view.length - 1, Math.max(0, activeIndex + delta));
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
    query = '';
    renderPanel();
    if (searchable && searchInput) searchInput.focus({ preventScroll: true });
    activeIndex = multiple ? -1 : view.findIndex((o) => o.value === sel);
    if (activeIndex < 0) activeIndex = multiple ? -1 : (view.length ? 0 : -1);
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

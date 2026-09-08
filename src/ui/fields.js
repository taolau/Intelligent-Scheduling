import { createSelect } from './select.js';
import { parseTags } from '../data/model.js';
import { ICON_INFO } from './icons.js';

export function field({ label, required = false, hint, help, control }) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const lab = document.createElement('label');
  if (required) lab.classList.add('required');
  lab.textContent = label;
  if (help) {
    lab.classList.add('with-help');
    lab.appendChild(attachHelp(help));
  }
  wrap.appendChild(lab);
  wrap.appendChild(control);
  if (hint) {
    const h = document.createElement('div');
    h.className = 'hint';
    h.textContent = hint;
    wrap.appendChild(h);
  }
  const err = document.createElement('div');
  err.className = 'field-error';
  wrap.appendChild(err);
  return { wrap, err };
}

// label 右侧「信息 icon + 悬浮说明」：hover/聚焦显示、移出/失焦延时关闭（150ms 留给移入气泡的路径），
// fixed 视口定位 + 下溢上翻 + 滚动跟随（同 tagsInput 候选面板先例）；气泡挂在 icon 内随表单整棵回收
function attachHelp(text) {
  const icon = document.createElement('span');
  icon.className = 'help-ico';
  icon.tabIndex = 0;
  icon.setAttribute('aria-label', '字段说明');
  icon.innerHTML = ICON_INFO;
  const bub = document.createElement('div');
  bub.className = 'help-bub';
  bub.textContent = text;
  icon.appendChild(bub);
  let open = false;
  let timer = 0;
  const onScroll = () => { if (open) pos(); };
  function pos() {
    const r = icon.getBoundingClientRect();
    const w = bub.offsetWidth;
    const h = bub.offsetHeight;
    const gap = 6;
    let top;
    if (window.innerHeight - r.bottom >= h + gap) top = r.bottom + gap;
    else if (r.top >= h + gap) top = r.top - h - gap;
    else top = Math.max(6, r.top - h - gap);
    bub.style.top = `${top}px`;
    bub.style.left = `${Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8))}px`;
  }
  function openBub() {
    if (open) return;
    open = true;
    bub.style.display = 'block';
    pos();
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', closeNow);
  }
  function closeNow() {
    clearTimeout(timer);
    if (!open) return;
    open = false;
    bub.style.display = 'none';
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', closeNow);
  }
  const scheduleClose = () => { clearTimeout(timer); timer = setTimeout(closeNow, 150); };
  const keepOpen = () => { clearTimeout(timer); };
  icon.addEventListener('mouseenter', () => { keepOpen(); openBub(); });
  icon.addEventListener('mouseleave', scheduleClose);
  bub.addEventListener('mouseenter', keepOpen);
  bub.addEventListener('mouseleave', scheduleClose);
  icon.addEventListener('focus', () => { keepOpen(); openBub(); });
  icon.addEventListener('blur', scheduleClose);
  icon.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeNow(); }
  });
  return icon;
}

export function setError(entry, msg) {
  if (msg) {
    entry.wrap.classList.add('is-error');
    entry.err.textContent = msg;
  } else {
    entry.wrap.classList.remove('is-error');
    entry.err.textContent = '';
  }
}

// 标签 chip 输入（可输可选同框）：聚焦/输入时浮出「已有标签」候选面板（排除已选），点击或键盘选择即添加；
// 输入文本无匹配时回车 = 自创该文本为新标签；同一标签自动去重不会重复出现。
// options = 全库已有标签池（可选，为空则纯输入模式）。读取 el.value → String[]
export function tagsInput({ initial = [], options = [], allowCreate = true, placeholder = '输入后回车添加' } = {}) {
  const box = document.createElement('div');
  box.className = 'tag-in';
  const input = document.createElement('input');
  input.className = 'tag-in-input';
  input.type = 'text';
  input.placeholder = placeholder;
  const chips = new Map();
  const pool = [...new Set(options)];

  const addText = (raw) => {
    for (const t of parseTags(raw)) {
      const clean = t.trim();
      if (!clean || chips.has(clean)) continue;
      const chip = document.createElement('span');
      chip.className = 'tag tag-in-chip';
      const name = document.createElement('span');
      name.textContent = clean;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'tag-in-x';
      x.textContent = '×';
      x.title = '移除标签';
      x.onclick = (e) => { e.stopPropagation(); chip.remove(); chips.delete(clean); if (open) renderPanel(); };
      chip.append(name, x);
      box.insertBefore(chip, input);
      chips.set(clean, chip);
    }
  };

  // —— 已有标签候选面板（fixed 视口定位，防弹窗滚动容器裁剪）——
  const panel = document.createElement('div');
  panel.className = 'tag-pick-panel';
  box.appendChild(panel);
  let open = false;
  let query = '';
  let view = [];
  let activeIndex = -1;
  const onScroll = () => { if (open) positionPanel(); };

  function closePanel() {
    if (!open) return;
    open = false;
    panel.style.display = 'none';
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', closePanel);
  }
  function positionPanel() {
    // 水平锚定整个标签容器：面板恒等于容器宽度（chips 增减不改变面板宽窄，与 .sel-panel 撑满 trigger 同语义）；
    // 垂直锚定容器底缘 +4px（同 .sel-panel 相对触发器外框间距）：从控件边框外展开，不贴输入框边
    const br = box.getBoundingClientRect();
    const h = panel.offsetHeight || 200;
    const below = window.innerHeight - br.bottom;
    panel.style.position = 'fixed';
    if (below < h + 6 && br.top > below) panel.style.top = `${Math.max(6, br.top - h - 4)}px`;
    else panel.style.top = `${br.bottom + 4}px`;
    panel.style.left = `${br.left}px`;
    panel.style.width = `${br.width}px`;
  }
  function chooseOpt(t) {
    addText(t);
    query = '';
    input.value = '';
    activeIndex = -1;
    renderPanel();
    input.focus();
  }
  function renderPanel() {
    const q = query.toLowerCase();
    view = pool.filter(t => !chips.has(t) && (!q || t.toLowerCase().includes(q)));
    panel.innerHTML = '';
    activeIndex = view.length ? 0 : -1;
    if (view.length) {
      view.forEach((t, i) => {
        const opt = document.createElement('div');
        opt.className = 'tag-pick-opt' + (i === 0 ? ' active' : '');
        opt.textContent = t;
        opt.addEventListener('mousedown', (e) => e.preventDefault()); // 防失焦打断输入（#25 竞态）
        opt.addEventListener('mouseenter', () => { // 悬停即同步键盘高亮：回车所见即所选
          if (activeIndex !== i) {
            activeIndex = i;
            [...panel.children].forEach((el, idx) => el.classList.toggle('active', idx === i));
          }
        });
        opt.addEventListener('click', (e) => { e.stopPropagation(); chooseOpt(t); });
        panel.appendChild(opt);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'tag-pick-empty';
      empty.textContent = q ? '无匹配标签' : '暂无可选标签';
      panel.appendChild(empty);
    }
    if (q && allowCreate && !pool.some(t => !chips.has(t) && t.toLowerCase().includes(q))) {
      const hint = document.createElement('div');
      hint.className = 'tag-pick-hint';
      hint.textContent = `回车创建新标签「${query}」`;
      panel.appendChild(hint);
    }
    positionPanel();
  }
  function openPanel() {
    if (!pool.length || open) return;
    open = true;
    // 先脱离文档流再显示：若先 display:block（仍为 box 的 flex 项）会挤动输入框，
    // 随后才量出的坐标基于被挤动的布局，面板与输入框错位
    panel.style.position = 'fixed';
    panel.style.display = 'block';
    renderPanel();
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', closePanel);
  }
  document.addEventListener('click', (e) => {
    if (open && !e.target.closest('.tag-in')) closePanel();
  });

  input.addEventListener('focus', () => { query = input.value.trim(); openPanel(); });
  input.addEventListener('blur', () => closePanel());
  input.addEventListener('input', () => {
    query = input.value.trim();
    if (!open) openPanel();
    else if (pool.length) renderPanel();
  });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // IME 选词回车只确认拼音，不当作添加
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open || !view.length) return;
      e.preventDefault();
      const max = view.length - 1;
      activeIndex = e.key === 'ArrowDown'
        ? (activeIndex >= max ? 0 : activeIndex + 1)
        : (activeIndex <= 0 ? max : activeIndex - 1);
      [...panel.children].forEach((el, i) => el.classList.toggle('active', i === activeIndex));
      const it = panel.children[activeIndex];
      if (it) it.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === ';' || e.key === '；') {
      e.preventDefault();
      const q = input.value.trim();
      if (open && view.length && activeIndex >= 0) { // 有候选高亮行：回车确认选中（空输入也可键盘/悬停选择）
        chooseOpt(view[activeIndex]);
        return;
      }
      if (q) {
        if (!allowCreate) return; // 只选模式：无可选候选时回车不创建新标签
        addText(q); // 无匹配候选时回车 = 自创新标签
        input.value = '';
        query = '';
        if (open) renderPanel();
        return;
      }
      closePanel();
      return;
    }
    if (e.key === 'Escape') { closePanel(); return; }
    if (e.key === 'Backspace' && !input.value && chips.size) {
      const last = [...chips.keys()].pop();
      chips.get(last).remove();
      chips.delete(last);
      if (open) renderPanel();
    }
  });
  box.addEventListener('click', (e) => {
    if (e.target === box || e.target === input || e.target.closest('.tag-in-chip')) {
      input.focus();
      if (!open) { query = input.value.trim(); openPanel(); }
    }
  });
  box.append(input);
  // 初始标签须在 input 入树后添加（insertBefore 参考节点须是已挂载子节点，否则抛 NotFoundError）
  initial.forEach(addText);
  Object.defineProperty(box, 'value', { get: () => [...chips.keys()] });
  return box;
}

export function rowsEditor({ label, help, addLabel, cols, initial = [], onCell }) {
  const box = document.createElement('div');
  box.className = 'field';
  const lab = document.createElement('label');
  lab.textContent = label;
  if (help) {
    lab.classList.add('with-help');
    lab.appendChild(attachHelp(help));
  }
  const rows = document.createElement('div');
  rows.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'btn btn-default btn-sm';
  add.textContent = addLabel;
  add.onclick = () => rows.appendChild(buildRow({}));
  box.append(lab, rows, add);

  function buildRow(data) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';
    for (const col of cols) {
      let el;
      if (col.type === 'select') {
        el = createSelect({ options: col.options, value: data[col.key] });
      } else {
        el = document.createElement('input');
        el.className = 'input';
        el.type = col.type ?? 'text';
        el.placeholder = col.placeholder ?? '';
        el.value = data[col.key] ?? '';
      }
      el.style.flex = '1';
      row.appendChild(el);
      if (onCell) onCell(col.key, el, row);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-ghost btn-sm row-del';
    del.title = '删除此行';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;display:block"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    del.onclick = () => row.remove();
    row.appendChild(del);
    return row;
  }

  initial.forEach(d => rows.appendChild(buildRow(d)));

  return {
    el: box,
    add(data) {
      rows.appendChild(buildRow(data));
    },
    collect() {
      const out = [];
      for (const row of rows.children) {
        if (row.tagName !== 'DIV') continue;
        const item = {};
        cols.forEach((col, i) => {
          const v = row.children[i].value;
          if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(item, v);
          else item[col.key] = v;
        });
        out.push(item);
      }
      return out;
    },
  };
}

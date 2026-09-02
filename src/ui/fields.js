import { createSelect } from './select.js';

export function field({ label, required = false, hint, control }) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const lab = document.createElement('label');
  if (required) lab.classList.add('required');
  lab.textContent = label;
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

export function setError(entry, msg) {
  if (msg) {
    entry.wrap.classList.add('is-error');
    entry.err.textContent = msg;
  } else {
    entry.wrap.classList.remove('is-error');
    entry.err.textContent = '';
  }
}

export function rowsEditor({ label, addLabel, cols, initial = [], onCell }) {
  const box = document.createElement('div');
  box.className = 'field';
  const lab = document.createElement('label');
  lab.textContent = label;
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

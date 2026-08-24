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

export function rowsEditor({ label, addLabel, cols, initial = [] }) {
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
        el = document.createElement('select');
        el.className = 'select';
        for (const opt of col.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (String(data[col.key]) === String(opt.value)) o.selected = true;
          el.appendChild(o);
        }
      } else {
        el = document.createElement('input');
        el.className = 'input';
        el.type = col.type ?? 'text';
        el.placeholder = col.placeholder ?? '';
        el.value = data[col.key] ?? '';
      }
      el.style.flex = '1';
      row.appendChild(el);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-ghost btn-sm';
    del.textContent = '×';
    del.onclick = () => row.remove();
    row.appendChild(del);
    return row;
  }

  initial.forEach(d => rows.appendChild(buildRow(d)));

  return {
    el: box,
    collect() {
      const out = [];
      for (const row of rows.children) {
        if (row.tagName !== 'DIV') continue;
        const item = {};
        cols.forEach((col, i) => { item[col.key] = row.children[i].value; });
        out.push(item);
      }
      return out;
    },
  };
}

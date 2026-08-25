export const tokens = {
  color: {
    primary: '#2563eb', primaryHover: '#1d4ed8', primaryActive: '#1e40af',
    success: '#16a34a', successHover: '#15803d', successActive: '#166534',
    danger: '#dc2626', dangerHover: '#b91c1c', dangerActive: '#991b1b',
    warning: '#d97706',
    text: '#222', textSecondary: '#6b7280', textMuted: '#9ca3af',
    border: '#d1d5db', borderLight: '#e5e7eb',
    bg: '#f5f6f8', surface: '#fff', surfaceMuted: '#fafafa',
    focusRing: 'rgba(37,99,235,.18)',
  },
  radius: { sm: '4px', md: '6px', lg: '8px' },
  space: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  shadow: { sm: '0 1px 3px rgba(0,0,0,.08)', md: '0 4px 12px rgba(0,0,0,.12)' },
};

const css = `
/* ===== 按钮 ===== */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px;
  border:1px solid transparent; border-radius:8px; padding:8px 14px; font-size:14px;
  font-weight:500; line-height:1.2; cursor:pointer; user-select:none;
  transition:background-color .15s,border-color .15s,box-shadow .15s,color .15s,transform .15s; }
.btn:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; transform:none; }
.btn:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(37,99,235,.18); }
.btn:active:not(:disabled) { transform:scale(.97); }
.btn-primary { background:#2563eb; color:#fff; }
.btn-primary:hover:not(:disabled) { background:#1d4ed8; box-shadow:0 2px 6px rgba(37,99,235,.28); }
.btn-primary:active:not(:disabled) { background:#1e40af; box-shadow:inset 0 1px 3px rgba(0,0,0,.18); }
.btn-default { background:#fff; border-color:#d1d5db; color:#222; }
.btn-default:hover:not(:disabled) { background:#f3f4f6; border-color:#c4c9d0; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.btn-default:active:not(:disabled) { background:#e5e7eb; box-shadow:inset 0 1px 2px rgba(0,0,0,.08); }
.btn-danger { background:#dc2626; color:#fff; }
.btn-danger:hover:not(:disabled) { background:#b91c1c; box-shadow:0 2px 6px rgba(220,38,38,.28); }
.btn-danger:active:not(:disabled) { background:#991b1b; box-shadow:inset 0 1px 3px rgba(0,0,0,.18); }
.btn-success { background:#16a34a; color:#fff; }
.btn-success:hover:not(:disabled) { background:#15803d; box-shadow:0 2px 6px rgba(22,163,74,.28); }
.btn-success:active:not(:disabled) { background:#166534; box-shadow:inset 0 1px 3px rgba(0,0,0,.18); }
.btn-ghost { background:transparent; color:#2563eb; }
.btn-ghost:hover:not(:disabled) { background:#eff6ff; }
.btn-ghost:active:not(:disabled) { background:#dbeafe; }
.btn-sm { padding:6px 10px; font-size:13px; border-radius:7px; }
.week-label { font-weight:600; padding:6px 8px; display:inline-block; }

/* ===== 表单 ===== */
.field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.field label { font-size:13px; color:#6b7280; font-weight:500; }
.field .required::after { content:' *'; color:#dc2626; }
.field .hint { font-size:12px; color:#9ca3af; }
.field .field-error { font-size:12px; color:#dc2626; display:none; }
.field.is-error .field-error { display:block; }
.field.is-error .input, .field.is-error .select { border-color:#dc2626; }
.input, .select { width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:7px;
  font-size:14px; color:#222; background:#fff; font-family:inherit;
  transition:border-color .15s,box-shadow .15s; }
.input::placeholder { color:#9ca3af; }
.input:hover, .select:hover { border-color:#9ca3af; }
.input:focus, .select:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.18); }
.input:disabled, .select:disabled { background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }

/* ===== 自定义下拉 ===== */
.sel { position:relative; width:100%; }
.sel-trigger { display:flex; align-items:center; gap:8px; width:100%; min-height:38px; padding:8px 10px;
  border:1px solid #d1d5db; border-radius:6px; background:#fff; font-size:14px; color:#222;
  font-family:inherit; text-align:left; cursor:pointer; transition:border-color .15s,box-shadow .15s; }
.sel-trigger:hover { border-color:#9ca3af; }
.sel-trigger:focus-visible { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.18); }
.sel.open .sel-trigger { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.18); }
.sel-value { flex:1; min-width:0; display:flex; align-items:center; flex-wrap:wrap; gap:4px;
  overflow:hidden; }
.sel-value.placeholder { color:#9ca3af; }
.sel-chevron { flex-shrink:0; display:inline-flex; color:#6b7280; transition:transform .15s; }
.sel-chevron svg { width:16px; height:16px; }
.sel.open .sel-chevron { transform:rotate(180deg); }
.sel-tag { display:inline-flex; align-items:center; gap:2px; background:#eff6ff; color:#2563eb;
  border-radius:10px; padding:1px 6px; font-size:12px; line-height:1.5; }
.sel-tag button { border:none; background:none; padding:0 2px; cursor:pointer; color:#2563eb;
  font-size:13px; line-height:1; }
.sel-panel { display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:50;
  background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,.12);
  max-height:224px; overflow-y:auto; padding:4px; }
.sel.open .sel-panel { display:block; animation:selIn .12s ease; }
.sel-count { padding:4px 8px; font-size:12px; color:#9ca3af; border-bottom:1px solid #f0f0f0;
  margin-bottom:4px; }
.sel-opt { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:6px; cursor:pointer;
  font-size:14px; color:#374151; transition:background-color .1s; }
.sel-opt:hover { background:#f3f4f6; }
.sel-opt.active { background:#e8effc; }
.sel-opt.selected { color:#2563eb; font-weight:500; }
.sel-check { flex-shrink:0; width:14px; text-align:center; color:#2563eb; font-size:12px;
  visibility:hidden; }
.sel-opt.selected .sel-check { visibility:visible; }
.sel-empty { padding:10px; color:#9ca3af; font-size:13px; text-align:center; }
@keyframes selIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }

/* ===== 周几选择胶囊 ===== */
.day-chip { display:inline-flex; align-items:center; cursor:pointer; padding:6px 14px;
  border:1px solid #d1d5db; border-radius:999px; font-size:13px; color:#374151; background:#fff;
  user-select:none; transition:border-color .15s,background-color .15s,color .15s,box-shadow .15s; }
.day-chip input { position:absolute; opacity:0; pointer-events:none; }
.day-chip:hover { border-color:#2563eb; color:#2563eb; }
.day-chip.on { background:#2563eb; border-color:#2563eb; color:#fff; }
.day-chip.on:hover { box-shadow:0 2px 6px rgba(37,99,235,.28); }

/* ===== 表格 ===== */
.table { width:100%; border-collapse:collapse; font-size:14px; }
.table th { text-align:left; padding:9px 10px; border-bottom:2px solid #e5e7eb; white-space:nowrap;
  color:#6b7280; font-weight:600; background:#fafafa; }
.table td { padding:9px 10px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
.table tbody tr { transition:background-color .12s; }
.table tbody tr:nth-child(even) { background:#fcfcfd; }
.table tbody tr:hover { background:#f1f5f9; }
.table tbody tr:last-child td { border-bottom:none; }

/* ===== 弹窗 ===== */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); display:flex; align-items:center;
  justify-content:center; z-index:1000; animation:fadeIn .15s ease; }
.modal-box { background:#fff; border-radius:10px; max-width:640px; width:92%; max-height:85vh;
  display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,.12); animation:modalIn .18s ease; }
.modal-header { padding:14px 18px; font-weight:600; border-bottom:1px solid #eee; }
.modal-body { padding:16px 18px; overflow-y:auto; }
.modal-footer { padding:12px 18px; border-top:1px solid #eee; display:flex; justify-content:flex-end; gap:8px; }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes modalIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }

/* ===== toast ===== */
.toast-container { position:fixed; top:16px; right:16px; z-index:9999; display:flex; flex-direction:column; gap:8px; }
.toast { background:#fff; border:1px solid #e5e7eb; color:#222; padding:10px 14px; border-radius:6px;
  box-shadow:0 2px 6px rgba(0,0,0,.1); font-size:14px; display:flex; align-items:center; gap:8px;
  animation:toastIn .2s ease; }
.toast-error { border-color:#dc2626; color:#dc2626; }
.toast-success { border-color:#16a34a; color:#16a34a; }
.toast-info { border-color:#2563eb; color:#2563eb; }
@keyframes toastIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }

/* ===== 布局 ===== */
body { display:flex; min-height:100vh; }
#view { flex:1; min-width:0; padding:20px; overflow-x:auto; }

/* ===== 侧边栏 ===== */
.sidebar { width:208px; flex-shrink:0; height:100vh; position:sticky; top:0; background:#fff;
  border-right:1px solid #e5e7eb; display:flex; flex-direction:column; overflow:hidden;
  transition:width .2s ease; }
.sidebar.collapsed { width:56px; }
.side-brand { display:flex; align-items:center; gap:10px; padding:16px 14px; font-weight:600;
  font-size:15px; color:#111827; border-bottom:1px solid #f0f0f0; white-space:nowrap; }
.side-brand-icon { width:20px; height:20px; flex-shrink:0; }
.side-brand-text { overflow:hidden; text-overflow:ellipsis; }
.side-nav { flex:1; padding:12px 8px; display:flex; flex-direction:column; gap:4px; overflow-y:auto; }
.side-item { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border:none;
  background:transparent; border-radius:6px; font-size:14px; color:#374151; cursor:pointer;
  white-space:nowrap; text-align:left; transition:background-color .15s,color .15s; }
.side-item:hover { background:#f3f4f6; color:#111827; }
.side-item.active { background:#e8effc; color:#2563eb; font-weight:500; }
.side-icon { flex-shrink:0; width:20px; height:20px; display:inline-flex; align-items:center;
  justify-content:center; }
.side-icon svg { width:18px; height:18px; }
.side-label { overflow:hidden; text-overflow:ellipsis; }
.side-toggle { margin:12px 8px; padding:9px 0; border:1px solid #e5e7eb; background:#fff; border-radius:6px;
  cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6b7280;
  transition:background-color .15s,color .15s; }
.side-toggle:hover { background:#f3f4f6; color:#111827; }
.side-toggle svg { width:16px; height:16px; }
.chev-left { display:inline; }
.chev-right { display:none; }

/* ===== 侧边栏收起态 ===== */
.sidebar.collapsed .chev-left { display:none; }
.sidebar.collapsed .chev-right { display:inline; }
.sidebar.collapsed .side-label { display:none; }
.sidebar.collapsed .side-brand { justify-content:center; padding:16px 0; }
.sidebar.collapsed .side-item { justify-content:center; padding:10px 0; }

/* ===== 周历 ===== */
.cal-grid { display:grid; grid-template-columns:70px repeat(7,1fr); gap:6px; font-size:13px; }
.cal-corner { font-weight:600; text-align:center; padding:4px; }
.cal-cell { min-height:90px; border:1px solid #eef0f3; border-radius:8px; padding:6px; background:#fbfbfc; }
.cal-cell.empty { color:#9ca3af; text-align:center; cursor:pointer; display:flex; align-items:center;
  justify-content:center; font-size:12px; border-style:dashed;
  transition:background-color .15s,border-color .15s,color .15s; }
.cal-cell.empty:hover { background:#f3f4f6; color:#2563eb; border-color:#93c5fd; }
.drop-target { outline:2px solid #2563eb; outline-offset:-2px; background:#eff6ff !important; }
.sch-card { border:1px solid #dbeafe; background:#eff6ff; border-radius:8px; padding:6px; margin-bottom:6px;
  transition:box-shadow .15s,transform .15s; }
.sch-card:hover { box-shadow:0 2px 6px rgba(37,99,235,.12); transform:translateY(-1px); }
.sch-title { font-weight:600; font-size:12px; }
.staff-chip { display:inline-block; background:#fff; border:1px solid #bfdbfe; border-radius:999px;
  padding:1px 8px; margin:2px; cursor:grab; font-size:12px;
  transition:background-color .15s,border-color .15s; }
.staff-chip:hover { background:#eff6ff; border-color:#93c5fd; }
`;

export function injectGlobalStyles() {
  if (document.getElementById('app-theme')) return;
  const style = document.createElement('style');
  style.id = 'app-theme';
  style.textContent = css;
  document.head.appendChild(style);
}

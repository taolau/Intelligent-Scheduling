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
  border:1px solid transparent; border-radius:6px; padding:8px 14px; font-size:14px;
  cursor:pointer; line-height:1.2; user-select:none;
  transition:background-color .15s,border-color .15s,box-shadow .15s,color .15s; }
.btn:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
.btn:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(37,99,235,.18); }
.btn-primary { background:#2563eb; color:#fff; }
.btn-primary:hover:not(:disabled) { background:#1d4ed8; }
.btn-primary:active:not(:disabled) { background:#1e40af; }
.btn-default { background:#fff; border-color:#d1d5db; color:#222; }
.btn-default:hover:not(:disabled) { background:#f3f4f6; }
.btn-default:active:not(:disabled) { background:#e5e7eb; }
.btn-danger { background:#dc2626; color:#fff; }
.btn-danger:hover:not(:disabled) { background:#b91c1c; }
.btn-danger:active:not(:disabled) { background:#991b1b; }
.btn-success { background:#16a34a; color:#fff; }
.btn-success:hover:not(:disabled) { background:#15803d; }
.btn-success:active:not(:disabled) { background:#166534; }
.btn-ghost { background:transparent; color:#2563eb; }
.btn-ghost:hover:not(:disabled) { background:#eff6ff; }
.btn-ghost:active:not(:disabled) { background:#dbeafe; }
.btn-sm { padding:6px 10px; font-size:13px; }
.week-label { font-weight:600; padding:6px 8px; display:inline-block; }

/* ===== 表单 ===== */
.field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.field label { font-size:13px; color:#6b7280; font-weight:500; }
.field .required::after { content:' *'; color:#dc2626; }
.field .hint { font-size:12px; color:#9ca3af; }
.field .field-error { font-size:12px; color:#dc2626; display:none; }
.field.is-error .field-error { display:block; }
.field.is-error .input, .field.is-error .select { border-color:#dc2626; }
.input, .select { width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:6px;
  font-size:14px; color:#222; background:#fff; font-family:inherit; }
.input::placeholder { color:#9ca3af; }
.input:focus, .select:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.18); }
.input:disabled, .select:disabled { background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }

/* ===== 表格 ===== */
.table { width:100%; border-collapse:collapse; font-size:14px; }
.table th { text-align:left; padding:8px 10px; border-bottom:2px solid #e5e7eb; white-space:nowrap;
  color:#6b7280; font-weight:600; background:#fafafa; }
.table td { padding:8px 10px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
.table tbody tr:hover { background:#f8fafc; }

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

/* ===== 导航 ===== */
.nav-tabs { display:flex; gap:8px; margin-bottom:16px; }

/* ===== 周历 ===== */
.cal-grid { display:grid; grid-template-columns:70px repeat(7,1fr); gap:6px; font-size:13px; }
.cal-corner { font-weight:600; text-align:center; padding:4px; }
.cal-cell { min-height:90px; border:1px solid #e5e7eb; border-radius:6px; padding:6px; background:#fafafa; }
.cal-cell.empty { color:#9ca3af; text-align:center; cursor:pointer; display:flex; align-items:center;
  justify-content:center; font-size:12px; }
.cal-cell.empty:hover { background:#f3f4f6; color:#6b7280; }
.drop-target { outline:2px solid #2563eb; outline-offset:-2px; background:#eff6ff !important; }
.sch-card { border:1px solid #dbeafe; background:#eff6ff; border-radius:6px; padding:6px; margin-bottom:6px;
  transition:box-shadow .15s; }
.sch-card:hover { box-shadow:0 1px 3px rgba(0,0,0,.1); }
.sch-title { font-weight:600; }
.staff-chip { display:inline-block; background:#fff; border:1px solid #bfdbfe; border-radius:10px;
  padding:1px 8px; margin:2px; cursor:grab; transition:background-color .15s; }
.staff-chip:hover { background:#eff6ff; }
`;

export function injectGlobalStyles() {
  if (document.getElementById('app-theme')) return;
  const style = document.createElement('style');
  style.id = 'app-theme';
  style.textContent = css;
  document.head.appendChild(style);
}

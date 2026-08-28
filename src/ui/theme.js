export const tokens = {
  color: {
    primary: '#5a1d78', primaryHover: '#48115f', primaryActive: '#380c4a',
    success: '#16a34a', successHover: '#15803d', successActive: '#166534',
    danger: '#dc2626', dangerHover: '#b91c1c', dangerActive: '#991b1b',
    warning: '#d97706',
    text: '#2a2430', textSecondary: '#6a6178', textMuted: '#9b91a7',
    border: '#d0c8d9', borderLight: '#e6e1ec',
    bg: '#f7f4f8', surface: '#fff', surfaceMuted: '#fbfafc',
    focusRing: 'rgba(90,29,120,.14)',
  },
  radius: { sm: '4px', md: '6px', lg: '8px' },
  space: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  shadow: { sm: '0 1px 2px rgba(90,29,120,.05), 0 8px 20px rgba(60,12,74,.06)',
    md: '0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10)' },
};

const css = `
/* ===== 按钮 ===== */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px;
  border:1px solid transparent; border-radius:8px; padding:8px 14px; font-size:14px;
  font-weight:500; line-height:1.2; cursor:pointer; user-select:none;
  transition:background-color .15s,border-color .15s,box-shadow .15s,color .15s,transform .15s; }
.btn:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; transform:none; }
.btn:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(90,29,120,.14); }
.btn:active:not(:disabled) { transform:scale(.97); }
.btn-primary { background:#5a1d78; color:#fff; }
.btn-primary:hover:not(:disabled) { background:#48115f; box-shadow:0 2px 6px rgba(90,29,120,.28); }
.btn-primary:active:not(:disabled) { background:#380c4a; box-shadow:inset 0 1px 3px rgba(90,29,120,.14); }
.btn-default { background:#fff; border-color:#e0d2ef; color:#2a2430; }
.btn-default:hover:not(:disabled) { background:#f7f1fa; border-color:#c9b0e0; color:#5a1d78; box-shadow:0 1px 3px rgba(90,29,120,.1); }
.btn-default:active:not(:disabled) { background:#efe3f6; box-shadow:inset 0 1px 2px rgba(90,29,120,.08); }
.btn-danger { background:#dc2626; color:#fff; }
.btn-danger:hover:not(:disabled) { background:#b91c1c; box-shadow:0 2px 6px rgba(220,38,38,.28); }
.btn-danger:active:not(:disabled) { background:#991b1b; box-shadow:inset 0 1px 3px rgba(90,29,120,.14); }
.btn-danger.confirming { background:#991b1b; box-shadow:0 0 0 3px rgba(220,38,38,.25); }
.btn-success { background:#16a34a; color:#fff; }
.btn-success:hover:not(:disabled) { background:#15803d; box-shadow:0 2px 6px rgba(22,163,74,.28); }
.btn-success:active:not(:disabled) { background:#166534; box-shadow:inset 0 1px 3px rgba(90,29,120,.14); }
.btn-ghost { background:transparent; color:#5a1d78; }
.btn-ghost:hover:not(:disabled) { background:#f7f1fa; }
.btn-ghost:active:not(:disabled) { background:#efe3f6; }
.btn-sm { padding:6px 10px; font-size:13px; border-radius:7px; }
.row-del { padding:5px 7px; color:#9b91a7; }
.row-del:hover:not(:disabled) { background:#fdf0ef; color:#dc2626; }
.asg-head { margin-bottom:12px; }
.asg-title { display:flex; align-items:center; gap:8px; font-size:17px; font-weight:700; color:#2a2430; }
.asg-sub { font-size:12px; color:#6a6178; margin-top:4px; }
.asg-progress { display:flex; align-items:center; gap:10px; margin:12px 0 4px; }
.asg-bar { flex:1; height:6px; border-radius:999px; background:#f1edf5; overflow:hidden; }
.asg-fill { height:100%; background:#5a1d78; border-radius:999px; transition:width .2s; }
.asg-bar.full .asg-fill { background:#16a34a; }
.asg-progress-label { font-size:12px; color:#6a6178; white-space:nowrap; }
.asg-section { font-size:12px; color:#9b91a7; margin:14px 0 8px; font-weight:500; letter-spacing:.02em; }
.asg-chips { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.asg-chip { display:inline-flex; align-items:center; gap:6px; background:#f7f1fa; border:1px solid #e0d2ef;
  color:#3d3747; border-radius:999px; padding:4px 8px 4px 12px; font-size:14px; }
.asg-chip-x { border:none; background:none; padding:2px; cursor:pointer; color:#9b91a7; display:inline-flex;
  border-radius:50%; }
.asg-chip-x:hover { color:#dc2626; background:#fdf0ef; }
.asg-empty { font-size:13px; color:#9b91a7; }
.asg-full { display:flex; align-items:center; gap:6px; color:#16a34a; font-size:13px; padding:6px 0; }
.assign-row { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:7px; font-size:14px; }
.assign-row.pickable { cursor:pointer; transition:background-color .1s; }
.assign-row.pickable:hover { background:#f7f1fa; }
.assign-row.blocked { color:#9b91a7; }
.assign-name { font-weight:500; display:inline-flex; align-items:center; gap:5px; color:#2a2430; }
.assign-row.blocked .assign-name { color:#9b91a7; }
.assign-tag { font-size:11px; color:#5a1d78; background:#efe3f6; border-radius:8px; padding:0 5px; }
.assign-info { margin-left:auto; font-size:12px; color:#9b91a7; }
.assign-why { font-size:12px; color:#dc2626; }
.assign-add { font-size:12px; color:#5a1d78; background:#efe3f6; border-radius:999px; padding:2px 10px;
  opacity:0; transform:translateX(4px); transition:opacity .12s, transform .12s; }
.assign-row.pickable:hover .assign-add { opacity:1; transform:none; }
.week-label { font-weight:600; padding:6px 8px; display:inline-block; }

/* ===== 表单 ===== */
.field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.field label { font-size:13px; color:#6a6178; font-weight:500; }
.field .required::after { content:' *'; color:#dc2626; }
.field .hint { font-size:12px; color:#9b91a7; }
.field .field-error { font-size:12px; color:#dc2626; display:none; }
.field.is-error .field-error { display:block; }
.field.is-error .input, .field.is-error .select { border-color:#dc2626; }
.input, .select { width:100%; padding:8px 10px; border:1px solid #d0c8d9; border-radius:7px;
  font-size:14px; color:#2a2430; background:#fff; font-family:inherit;
  transition:border-color .15s,box-shadow .15s; }
.input::placeholder { color:#9b91a7; }
.input:hover, .select:hover { border-color:#9b91a7; }
.input:focus, .select:focus { outline:none; border-color:#5a1d78; box-shadow:0 0 0 3px rgba(90,29,120,.14); }
.input:disabled, .select:disabled { background:#f4f1f7; color:#9b91a7; cursor:not-allowed; }

/* ===== 自定义下拉 ===== */
.sel { position:relative; width:100%; }
.sel-trigger { display:flex; align-items:center; gap:8px; width:100%; min-height:38px; padding:8px 10px;
  border:1px solid #d0c8d9; border-radius:6px; background:#fff; font-size:14px; color:#2a2430;
  font-family:inherit; text-align:left; cursor:pointer; transition:border-color .15s,box-shadow .15s; }
.sel-trigger:hover { border-color:#9b91a7; }
.sel-trigger:focus-visible { outline:none; border-color:#5a1d78; box-shadow:0 0 0 3px rgba(90,29,120,.14); }
.sel.open .sel-trigger { border-color:#5a1d78; box-shadow:0 0 0 3px rgba(90,29,120,.14); }
.sel-value { flex:1; min-width:0; display:flex; align-items:center; flex-wrap:wrap; gap:4px;
  overflow:hidden; }
.sel-value.placeholder { color:#9b91a7; }
.sel-chevron { flex-shrink:0; display:inline-flex; color:#6a6178; transition:transform .15s; }
.sel-chevron svg { width:16px; height:16px; }
.sel.open .sel-chevron { transform:rotate(180deg); }
.sel-tag { display:inline-flex; align-items:center; gap:2px; background:#f7f1fa; color:#5a1d78;
  border-radius:10px; padding:1px 6px; font-size:12px; line-height:1.5; }
.sel-tag button { border:none; background:none; padding:0 2px; cursor:pointer; color:#5a1d78;
  font-size:13px; line-height:1; }
.sel-panel { display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1050;
  background:#fff; border:1px solid #e6e1ec; border-radius:8px; box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10);
  max-height:224px; overflow-y:auto; padding:4px; }
.sel.open .sel-panel { display:block; animation:selIn .12s ease; }
.sel-count { padding:4px 8px; font-size:12px; color:#9b91a7; border-bottom:1px solid #f1edf5;
  margin-bottom:4px; }
.sel-opt { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:6px; cursor:pointer;
  font-size:14px; color:#3d3747; transition:background-color .1s; }
.sel-opt:hover { background:#f4f1f7; }
.sel-opt.active { background:#efe3f6; }
.sel-opt.selected { color:#5a1d78; font-weight:500; }
.sel-check { flex-shrink:0; width:14px; text-align:center; color:#5a1d78; font-size:12px;
  visibility:hidden; }
.sel-opt.selected .sel-check { visibility:visible; }
.sel-opt-desc { margin-left:auto; font-size:12px; color:#9b91a7; }
.sel-empty { padding:10px; color:#9b91a7; font-size:13px; text-align:center; }
@keyframes selIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }

/* ===== 时间范围 ===== */
.tr { position:relative; }
.tr-trigger { display:flex; align-items:center; gap:8px; width:100%; min-height:38px; padding:8px 10px;
  border:1px solid #d0c8d9; border-radius:6px; background:#fff; font-size:14px; color:#2a2430;
  font-family:inherit; text-align:left; cursor:pointer; transition:border-color .15s,box-shadow .15s; }
.tr-trigger:hover { border-color:#9b91a7; }
.tr.open .tr-trigger { border-color:#5a1d78; box-shadow:0 0 0 3px rgba(90,29,120,.14); }
.tr-value { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tr-value.placeholder { color:#9b91a7; }
.tr-chevron { flex-shrink:0; display:inline-flex; color:#6a6178; transition:transform .15s; }
.tr-chevron svg { width:16px; height:16px; }
.tr.open .tr-chevron { transform:rotate(180deg); }
.tr-panel { display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1050;
  background:#fff; border:1px solid #e6e1ec; border-radius:8px; box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10);
  padding:10px; flex-direction:column; gap:10px; }
.tr.open .tr-panel { display:flex; }
.tr-chips { display:flex; flex-wrap:wrap; gap:6px; }
.tr-chip { border:1px solid #d0c8d9; background:#fff; border-radius:999px; padding:4px 12px; font-size:13px;
  color:#3d3747; cursor:pointer; transition:border-color .15s,background-color .15s,color .15s; }
.tr-chip:hover { border-color:#5a1d78; color:#5a1d78; }
.tr-chip.on { background:#5a1d78; border-color:#5a1d78; color:#fff; }
.tr-times { display:flex; align-items:center; gap:8px; }
.tr-times .input { flex:1; min-width:0; }
.tr-times span { color:#9b91a7; flex-shrink:0; }
.tp-cols { display:flex; gap:6px; }
.tp-col { flex:1; max-height:200px; overflow-y:auto; }
.tp-col .sel-opt.selected { background:#efe3f6; }

/* ===== 周几选择胶囊 ===== */
.day-chip { display:inline-flex; align-items:center; cursor:pointer; padding:6px 14px;
  border:1px solid #d0c8d9; border-radius:999px; font-size:13px; color:#3d3747; background:#fff;
  user-select:none; transition:border-color .15s,background-color .15s,color .15s,box-shadow .15s; }
.day-chip input { position:absolute; opacity:0; pointer-events:none; }
.day-chip:hover { border-color:#5a1d78; color:#5a1d78; }
.day-chip.on { background:#5a1d78; border-color:#5a1d78; color:#fff; }
.day-chip.on:hover { box-shadow:0 2px 6px rgba(90,29,120,.28); }

/* ===== 表格 ===== */
.table { width:100%; border-collapse:collapse; font-size:14px; }
.table th { text-align:left; padding:9px 10px; border-bottom:2px solid #e6e1ec; white-space:nowrap;
  color:#6a6178; font-weight:600; background:#fbfafc; }
.table td { padding:9px 10px; border-bottom:1px solid #f1edf5; vertical-align:top; }
.table tbody tr { transition:background-color .12s; }
.table tbody tr:nth-child(even) { background:#fdfbfe; }
.table tbody tr:hover { background:#f2eef7; }
.table tbody tr:last-child td { border-bottom:none; }

/* ===== 项目 tag ===== */
.tag { display:inline-flex; align-items:center; background:#f7f1fa; color:#5a1d78;
  border:1px solid #efe3f6; border-radius:10px; padding:1px 8px; margin:2px 2px 2px 0;
  font-size:12px; line-height:1.6; cursor:default; }
.tag.tag-danger { background:#fef2f2; color:#b91c1c; border-color:#fee2e2; }

/* ===== 弹窗 ===== */
.modal-overlay { position:fixed; inset:0; background:rgba(24,14,32,.45); display:flex; align-items:center;
  justify-content:center; z-index:1000; animation:fadeIn .15s ease; }
.modal-box { background:#fff; border-radius:10px; max-width:720px; width:92%; max-height:85vh;
  display:flex; flex-direction:column; box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10); animation:modalIn .18s ease; }
.modal-header { padding:14px 18px; font-weight:600; border-bottom:1px solid #efe9f4; }
.modal-body { padding:16px 18px; overflow-y:auto; }
.modal-footer { padding:12px 18px; border-top:1px solid #efe9f4; display:flex; justify-content:flex-end; gap:8px; }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes modalIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }

/* ===== toast ===== */
.toast-container { position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:9999;
  display:flex; flex-direction:column; gap:8px; align-items:center; }
.toast { background:#fff; border:1px solid #efe9f4; color:#3d3747; padding:10px 16px; border-radius:10px;
  box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.12); font-size:14px; display:flex; align-items:center; gap:10px;
  animation:toastIn .28s cubic-bezier(.21,1.02,.73,1); }
.toast-icon { width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center;
  justify-content:center; font-size:12px; flex-shrink:0; line-height:1; }
.toast-text { line-height:1.4; }
.toast-success { border-color:#dcfce7; }
.toast-error { border-color:#fee2e2; }
.toast-info { border-color:#efe3f6; }
.toast-success .toast-icon { background:#dcfce7; color:#16a34a; }
.toast-error .toast-icon { background:#fee2e2; color:#dc2626; }
.toast-info .toast-icon { background:#efe3f6; color:#5a1d78; }
@keyframes toastIn { from { opacity:0; transform:translateY(-12px) scale(.96); } to { opacity:1; transform:none; } }

/* ===== 布局 ===== */
body { display:flex; height:100vh; overflow:hidden; }
#view { flex:1; min-width:0; padding:20px; overflow-x:auto; display:flex; flex-direction:column; }

/* ===== 侧边栏 ===== */
.sidebar { width:208px; flex-shrink:0; height:100vh; position:sticky; top:0; background:#fff;
  border-right:1px solid #e6e1ec; display:flex; flex-direction:column; overflow:hidden;
  transition:width .2s ease; }
.sidebar.collapsed { width:56px; }
.side-brand { display:flex; align-items:center; gap:11px; padding:13px 12px;
  border-bottom:1px solid #f1edf5; white-space:nowrap; }
.side-brand-icon { width:38px; height:38px; flex-shrink:0; padding:4px;
  background:linear-gradient(135deg,#f7f1fa 0%,#efe3f6 100%); border-radius:11px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.85), 0 2px 6px rgba(90,29,120,.14);
  display:flex; align-items:center; justify-content:center;
  transition:transform .18s ease, box-shadow .18s ease; }
.side-brand:hover .side-brand-icon { transform:translateY(-1px) scale(1.05);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.85), 0 4px 12px rgba(90,29,120,.2); }
.side-brand-icon svg { width:28px; height:28px; display:block; }
.side-brand-text { display:flex; flex-direction:column; line-height:1.2; overflow:hidden; }
.side-brand-text b { font-size:16px; font-weight:700; color:#241f2e; letter-spacing:.02em; }
.side-brand-text em { font-style:normal; font-size:10px; font-weight:600; color:#5a1d78;
  letter-spacing:.16em; text-transform:uppercase; margin-top:1px; }
.side-nav { flex:1; padding:12px 8px; display:flex; flex-direction:column; gap:4px; overflow-y:auto; }
.side-item { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border:none;
  background:transparent; border-radius:6px; font-size:14px; color:#3d3747; cursor:pointer;
  white-space:nowrap; text-align:left; transition:background-color .15s,color .15s; }
.side-item:hover { background:#f4f1f7; color:#241f2e; }
.side-item.active { background:#efe3f6; color:#5a1d78; font-weight:500; }
.side-icon { flex-shrink:0; width:20px; height:20px; display:inline-flex; align-items:center;
  justify-content:center; }
.side-icon svg { width:18px; height:18px; }
.side-label { overflow:hidden; text-overflow:ellipsis; }
.side-toggle { margin:12px 8px; padding:9px 0; border:1px solid #e6e1ec; background:#fff; border-radius:6px;
  cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6a6178;
  transition:background-color .15s,color .15s; }
.side-toggle:hover { background:#f4f1f7; color:#241f2e; }
.side-toggle svg { width:16px; height:16px; }
.chev-left { display:inline; }
.chev-right { display:none; }

/* ===== 侧边栏收起态 ===== */
.sidebar.collapsed .chev-left { display:none; }
.sidebar.collapsed .chev-right { display:inline; }
.sidebar.collapsed .side-label { display:none; }
.sidebar.collapsed .side-brand { justify-content:center; padding:13px 0; }
.sidebar.collapsed .side-item { justify-content:center; padding:10px 0; }

/* ===== 周历 ===== */
.cal-grid { display:grid; grid-template-columns:70px repeat(7,1fr);
  grid-template-rows:auto minmax(0,0.55fr) repeat(3,minmax(0,1fr)); gap:6px; font-size:13px;
  flex:1; min-height:480px; }
.cal-corner { font-weight:600; text-align:center; padding:4px; }
.cal-date { background:#f7f1fa; color:#380c4a; border-radius:8px; padding:6px 4px; font-size:13px; }
.cal-date b { display:block; font-size:11px; font-weight:500; color:#6a6178; margin-top:2px; }
.cal-date.cal-today { background:#efe3f6; color:#5a1d78; }
.cal-date.cal-today b { color:#5a1d78; font-weight:600; }
.cal-slot { background:#f7f1fa; color:#5a1d78; border-left:3px solid #5a1d78; border-radius:8px;
  padding:6px 4px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; }
.cal-cell { min-height:0; border:1px solid #eae5f0; border-radius:8px; padding:6px; background:#fcfafd;
  display:flex; flex-direction:column; gap:6px; overflow-y:auto; }
.cal-cell.empty { color:#9b91a7; text-align:center; cursor:pointer; display:flex; align-items:center;
  justify-content:center; font-size:12px; border-style:dashed;
  transition:background-color .15s,border-color .15s,color .15s; }
.cal-cell.empty:hover { background:#f4f1f7; color:#5a1d78; border-color:#c9b0e0; }
.drop-target { outline:2px solid #5a1d78; outline-offset:-2px; background:#f7f1fa !important; }
.cal-add { align-self:center; border:1px dashed #d0c8d9; background:#fff; color:#9b91a7;
  border-radius:999px; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;
  cursor:pointer; opacity:.45; transition:opacity .12s, border-color .12s, color .12s; margin:2px 0; }
.cal-add:hover { opacity:1; border-color:#5a1d78; color:#5a1d78; background:#f7f1fa; }
.sch-card { border:1px solid #efe3f6; background:#f7f1fa; border-radius:8px; padding:6px; margin-bottom:6px;
  transition:box-shadow .15s,transform .15s; }
.sch-card:hover { box-shadow:0 2px 6px rgba(90,29,120,.12); transform:translateY(-1px); }
.sch-title { font-weight:600; font-size:12px; }
.staff-chip { display:inline-block; background:#fff; border:1px solid #e0d2ef; border-radius:999px;
  padding:1px 8px; margin:2px; cursor:grab; font-size:12px;
  transition:background-color .15s,border-color .15s; }
.staff-chip:hover { background:#f7f1fa; border-color:#c9b0e0; }

/* ===== 周历工具栏分组 ===== */
.cal-bar { display:flex; gap:8px; align-items:center; justify-content:space-between; margin-bottom:12px;
  flex-wrap:wrap; }
.cal-bar-group { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

/* ===== 今天列高亮 ===== */
.cal-cell.cal-col-today { background:#f7f1fa; border-color:#e0d2ef; }

/* ===== 空单元格空态 ===== */
.cal-cell.empty { border-style:dashed; border-color:#d0c8d9; background:#fcfafd; border-radius:8px;
  flex:1; min-height:70px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px;
  color:#9b91a7; font-size:12px;
  transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s; }
.cal-cell.empty .plus { font-size:16px; color:#c1c8d0; line-height:1; transition:color .15s; }
.cal-cell.empty:hover { background:#f4f1f7; color:#5a1d78; border-color:#c9b0e0;
  box-shadow:0 1px 3px rgba(90,29,120,.12); }
.cal-cell.empty:hover .plus { color:#5a1d78; }

/* ===== 班次卡片状态 ===== */
.sch-card { border:1px solid #efe3f6; background:#f7f1fa; border-radius:8px; padding:6px; margin-bottom:6px;
  display:flex; flex-direction:column; gap:4px;
  transition:box-shadow .15s,transform .15s; }
.sch-card:hover { box-shadow:0 2px 6px rgba(90,29,120,.12); transform:translateY(-1px); }
.sch-card.short { border-color:#fed7aa; background:#fff7ed; }
.sch-card.full { border-color:#bbf7d0; background:#f0fdf4; }
.sch-title { font-weight:600; font-size:12px; }
.sch-meta { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#6a6178; }
.sch-time { color:#9b91a7; font-size:10px; }
.sch-badge { display:inline-flex; align-items:center; gap:1px; }
.sch-staff { display:flex; flex-wrap:wrap; }
.sch-capacity { font-size:11px; color:#d97706; font-weight:500; }
.sch-capacity.ok { color:#16a34a; }

/* ===== 人员 chip 疲劳状态 ===== */
.staff-chip.warn { border-color:#fbbf24; background:#fffbeb; color:#b45309; }
.staff-chip.over { border-color:#f87171; background:#fef2f2; color:#b91c1c; font-weight:500; }

/* ===== 卡片容器 ===== */
.card { background:#fff; border:1px solid #eae5f0; border-radius:12px; padding:16px;
  box-shadow:0 1px 2px rgba(90,29,120,.05), 0 8px 20px rgba(60,12,74,.06);
  transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.card:hover { transform:translateY(-2px);
  box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10); }

/* ===== 配置页卡片网格 ===== */
.card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(248px,1fr)); gap:12px; align-items:stretch; }
.cfg-card { display:flex; flex-direction:column; gap:10px; }
.cfg-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.cfg-card-title { font-size:15px; font-weight:600; color:#241f2e; word-break:break-all; }
.cfg-card-rows { display:flex; flex-direction:column; gap:7px; font-size:13px; }
.cfg-row { display:flex; align-items:flex-start; gap:8px; }
.cfg-row .k { flex-shrink:0; min-width:5.5em; color:#6a6178; }
.cfg-row .v { display:flex; flex-wrap:wrap; gap:4px; min-width:0; }
.cfg-card-ops { margin-top:auto; display:flex; justify-content:space-between; align-items:center; gap:8px; padding-top:2px; }
.grid-empty { padding:28px; text-align:center; color:#9b91a7; font-size:14px; }

/* ===== 开关 ===== */
.switch-wrap { display:inline-flex; align-items:center; gap:7px; font-size:13px; color:#6a6178; cursor:pointer; user-select:none; }
.switch-wrap:hover .switch-label { color:#5a1d78; }
.switch { position:relative; display:inline-flex; width:34px; height:20px; flex-shrink:0; }
.switch input { position:absolute; inset:0; margin:0; opacity:0; cursor:pointer; z-index:1; }
.switch .track { position:absolute; inset:0; background:#e0d2ef; border-radius:999px; transition:background-color .18s, box-shadow .18s; }
.switch .thumb { position:absolute; top:2px; left:2px; width:16px; height:16px; background:#fff; border-radius:50%;
  box-shadow:0 1px 2px rgba(60,12,74,.25); transition:transform .18s; }
.switch input:checked + .track { background:#5a1d78; }
.switch input:checked + .track .thumb { transform:translateX(14px); }
.switch input:focus-visible + .track { box-shadow:0 0 0 3px rgba(90,29,120,.14); }
.switch input:disabled { cursor:not-allowed; }
.switch input:disabled + .track { opacity:.5; }

/* ===== 分段 Tab ===== */
.seg { display:inline-flex; background:#f4f1f7; border-radius:10px; padding:3px; gap:2px; }
.seg button { border:none; background:transparent; padding:7px 18px; border-radius:8px; font-size:14px;
  font-weight:500; color:#6a6178; cursor:pointer; transition:all .15s; }
.seg button:hover { color:#241f2e; }
.seg button.active { background:#fff; color:#5a1d78; box-shadow:0 1px 3px rgba(90,29,120,.1); font-weight:600; }

/* ===== 状态徽标 ===== */
.badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; font-size:12px; }
.badge-dot { width:6px; height:6px; border-radius:50%; }
.badge-success { background:#dcfce7; color:#16a34a; }
.badge-success .badge-dot { background:#16a34a; }
.badge-primary { background:#efe3f6; color:#5a1d78; }
.badge-primary .badge-dot { background:#5a1d78; }
.badge-warn { background:#fef3c7; color:#d97706; }
.badge-warn .badge-dot { background:#d97706; }
.badge-danger { background:#fee2e2; color:#dc2626; }
.badge-danger .badge-dot { background:#dc2626; }
.badge-muted { background:#f4f1f7; color:#6a6178; }
.badge-muted .badge-dot { background:#9b91a7; }

/* ===== 统计卡 ===== */
.stat-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:16px; }
.stat { background:#fff; border:1px solid #eae5f0; border-radius:12px; padding:14px 16px;
  box-shadow:0 1px 2px rgba(90,29,120,.05), 0 8px 20px rgba(60,12,74,.06);
  transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.stat:hover { transform:translateY(-2px);
  box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10); }
.stat-value { font-size:24px; font-weight:700; color:#241f2e; line-height:1.2; }
.stat-label { font-size:12px; color:#6a6178; margin-top:2px; }

/* ===== 分析图表 ===== */
.chart-wrap { position:relative; flex:1; min-height:0; }
.chart-wrap canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.chart-empty { height:100%; display:flex; align-items:center; justify-content:center;
  color:#9b91a7; font-size:14px; }
`;

export function injectGlobalStyles() {
  if (document.getElementById('app-theme')) return;
  const style = document.createElement('style');
  style.id = 'app-theme';
  style.textContent = css;
  document.head.appendChild(style);
}

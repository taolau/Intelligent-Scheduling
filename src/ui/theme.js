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
.btn-danger { background:#fee2e2; color:#dc2626; } /* 浅红底红字，与 btn-soft 淡紫款同构，实心大红过艳 */
.btn-danger:hover:not(:disabled) { background:#fecaca; color:#b91c1c; }
.btn-danger:active:not(:disabled) { background:#fca5a5; color:#991b1b; }
.btn-success { background:#16a34a; color:#fff; }
.btn-success:hover:not(:disabled) { background:#15803d; box-shadow:0 2px 6px rgba(22,163,74,.28); }
.btn-success:active:not(:disabled) { background:#166534; box-shadow:inset 0 1px 3px rgba(90,29,120,.14); }
.btn-ghost { background:transparent; color:#5a1d78; }
.btn-ghost:hover:not(:disabled) { background:#f7f1fa; }
.btn-ghost:active:not(:disabled) { background:#efe3f6; }
.btn-del { background:transparent; color:#dc2626; }
.btn-del:hover:not(:disabled) { background:#fdf0ef; color:#b91c1c; }
.btn-del:active:not(:disabled) { background:#fee2e2; }
.btn-soft { background:#efe3f6; color:#5a1d78; }
.btn-soft:hover:not(:disabled) { background:#e6d8f1; color:#48115f; }
.btn-soft:active:not(:disabled) { background:#dcc9ef; }
.btn-soft:disabled { opacity:.5; }
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
.sel.asg-tag-sel { width:200px; } /* 标签筛框放宽：窄 126 下多标签折行撑高（Tao 反馈） */
.asg-tag-sel .sel-trigger { min-height:28px; padding:3px 9px; font-size:12px; }
/* 已选标签单行不换行：valueBox flex:1 收窄 + nowrap，超宽整体裁切（flex 默认 inline 盒到界换行会撑高成两行） */
.asg-tag-sel .sel-value { flex:1; min-width:0; flex-wrap:nowrap; overflow:hidden; } /* 基础 .sel-value 是 flex-wrap:wrap——改 nowrap 才真单行不折，超宽裁切 */
.asg-tag-sel .sel-tag > span { display:block; max-width:72px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } /* 单标签文字超长省略，× 保留可移除 */
.input.asg-name-input { width:110px; flex-shrink:0; min-height:28px; padding:3px 9px;
  border-radius:7px; font-size:12px; }
.assign-row { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; font-size:14px; flex-wrap:wrap; }
.assign-row.pickable { cursor:pointer; transition:background-color .1s; }
.assign-row.pickable:hover { background:#f3e9fa; } /* hover 对齐替换候选卡（rpl-cand）观感 */
.assign-row.blocked { color:#9b91a7; }
.assign-name { font-weight:500; display:inline-flex; align-items:center; gap:5px; color:#2a2430; }
.assign-row.blocked .assign-name { color:#9b91a7; }
.assign-tag { font-size:11px; color:#5a1d78; background:#efe3f6; border-radius:8px; padding:0 5px; }
.assign-info { margin-left:auto; font-size:12px; color:#9b91a7; }
.assign-score { font-size:11px; color:#8a8099; background:#f1edf5; border-radius:999px; padding:1px 8px; flex-shrink:0; } /* 分徽章（学替换候选卡） */
.assign-score.top { color:#5a1d78; background:#efe3f6; font-weight:700; } /* 最高推荐分紫高亮（同替换 Top1） */
.assign-why { font-size:12px; color:#dc2626; }
.assign-reco { flex:1 0 100%; font-size:12px; color:#6a6178; line-height:1.5; margin-top:2px; } /* 可添加行「优选理由」副行（同替换弹窗人话规则） */
.assign-add { font-size:12px; color:#5a1d78; background:#efe3f6; border-radius:999px; padding:2px 10px;
  opacity:0; transform:translateX(4px); transition:opacity .12s, transform .12s; }
.assign-row.pickable:hover .assign-add { opacity:1; transform:none; }
.asg-cand-sec { margin-top:2px; }
.asg-subhead { font-size:12px; color:#6a6178; font-weight:600; margin:10px 0 3px; letter-spacing:.02em; }
.asg-limited .assign-row { flex-wrap:nowrap; }
.asg-limited .assign-row .assign-why { flex:1 1 auto; min-width:0; margin-top:0; white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis; } /* 暂不可添加原因单行不换行（原 wrap 折两行），超长省略、hover title 看全文 */
.asg-limited .assign-row .assign-name { flex:none; }
.asg-subhead.collap { cursor:pointer; user-select:none; }
.asg-subhead.collap:hover { color:#5a1d78; }
.asg-exempt-note { font-size:12px; color:#7f1d1d; background:#fef2f2; border:1px solid #fecaca; border-radius:6px;
  padding:6px 10px; margin-bottom:4px; } /* 连任豁免破例提示条（无其他可排人选） */
/* 点行即加：保留「已选」高亮（不整窗重绘清除）；再点一次 = 取消选中 → pointer + hover 加深 */
.assign-row.pickable.picked { background:#efe3f6; cursor:pointer; }
.assign-row.pickable.picked:hover { background:#e6d8f1; }
.assign-row.picked .assign-info { color:#5a1d78; font-weight:600; }
.assign-row.pickable.no-slot { opacity:.45; cursor:default; }
.assign-row.pickable.no-slot:hover { background:none; }
.rpl-head { margin-bottom:14px; }
.rpl-filter { display:flex; align-items:center; gap:8px; margin:-6px 0 10px; }
.rpl-filter-label { font-size:12px; color:#6a6178; }
.rpl-filter .asg-tag-sel { margin-left:0; }
.rpl-who { display:flex; align-items:center; gap:8px; font-size:17px; font-weight:700; color:#2a2430; }
.rpl-meta { font-size:12px; color:#6a6178; margin-top:3px; }
.rpl-fatigue.over { color:#dc2626; font-weight:700; }
.rpl-group { border:1px solid #e0d2ef; border-radius:10px; padding:10px 12px; margin-bottom:10px; background:#faf7fc; }
.rpl-group.done { border-color:#bbe3c5; background:#f0fbf3; }
.rpl-group-title { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#2a2430; margin-bottom:8px; }
.rpl-date { color:#6a6178; font-weight:500; }
.rpl-slot { font-size:11px; color:#5a1d78; background:#efe3f6; border-radius:6px; padding:1px 7px; flex-shrink:0; }
.rpl-task { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rpl-list { display:flex; flex-direction:column; gap:4px; }
.rpl-cand { padding:7px 10px; border-radius:8px; cursor:default; transition:background-color .1s; }
.rpl-cand:hover { background:#f3e9fa; } /* 行保留 hover 高亮便于区分/阅读；点击确认仅由「选此替补」按钮触发，行不绑点击（cursor 默认，无 pointer 误导） */
.rpl-cand-main { display:flex; align-items:center; gap:8px; }
.rpl-cand-name { font-weight:500; color:#2a2430; }
.rpl-cand-score { font-size:11px; color:#8a8099; background:#f1edf5; border-radius:999px; padding:1px 8px; }
.rpl-cand-score.top { color:#5a1d78; background:#efe3f6; font-weight:700; }
.rpl-cand-btn { margin-left:auto; flex-shrink:0; font-size:12px; color:#5a1d78; background:#fff;
  border:1px solid #c9b2dc; border-radius:999px; padding:2px 12px; cursor:pointer;
  transition:background-color .12s, color .12s, border-color .12s; }
.rpl-cand-btn:hover { background:#efe3f6; border-color:#d5bde8; color:#5a1d78; } /* hover 淡紫底紫字（原深紫实心底过艳被否） */
.rpl-cand-why { font-size:12px; color:#6a6178; line-height:1.55; margin-top:3px; }
.rpl-more-bar { width:100%; margin-top:2px; padding:5px 10px; font-size:12px; color:#5a1d78; background:transparent;
  border:1px dashed #dcc9ef; border-radius:8px; cursor:pointer; text-align:left; }
.rpl-more-bar:hover { background:#f3e9fa; }
.rpl-more-body { display:flex; flex-direction:column; gap:4px; margin-top:2px; }
.rpl-more-body[hidden] { display:none; }
.rpl-done-bar { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:24px; }
.rpl-done-info { font-size:12px; color:#2a2430; font-weight:600; min-width:0; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.rpl-done-ok { display:inline-flex; align-items:center; gap:5px; color:#16a34a; font-size:13px; font-weight:600; flex-shrink:0; }
.week-label { font-weight:600; padding:6px 8px; display:inline-block; }

/* ===== 表单 ===== */
.field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.field-pair { display:flex; gap:10px; }
.field-pair > .field { flex:1; min-width:0; }
.field label { font-size:13px; color:#6a6178; font-weight:500; }
.lbl-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px;
  margin-left:6px; padding:0; border:1px solid #e0d2ef; border-radius:6px; background:#f7f1fa; color:#5a1d78;
  cursor:pointer; transition:color .15s,background-color .15s,border-color .15s; }
.lbl-icon-btn:hover { background:#efe3f6; border-color:#c9b2dc; }
.lbl-icon-btn:active { background:#e6d9f2; }
.lbl-icon-btn:disabled { opacity:.35; cursor:not-allowed; }
.lbl-icon-btn:disabled:hover { background:#f7f1fa; border-color:#e0d2ef; }
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

/* ===== 标签 chip 输入（同框可输可选：聚焦浮出已有标签候选） ===== */
.tag-in { display:flex; flex-wrap:wrap; align-items:center; gap:4px;
  background:#fff; border:1px solid #d0c8d9; border-radius:6px; padding:4px 8px; cursor:text;
  transition:border-color .15s, box-shadow .15s; }
.tag-in:focus-within { border-color:#5a1d78; box-shadow:0 0 0 3px rgba(90,29,120,.14); }
.tag-in-chip { margin:1px 0; }
.tag-in-x { border:none; background:none; padding:0 0 0 3px; margin-left:1px; font-size:14px; line-height:1;
  color:#a79bb8; cursor:pointer; }
.tag-in-x:hover { color:#c62828; }
.tag-in-input { flex:1; min-width:110px; border:none; outline:none; background:transparent;
  font-family:inherit; font-size:14px; color:#2a2430; padding:3px 0; }
.tag-in-input::placeholder { color:#a79bb8; }

/* 已有标签候选浮层：fixed 视口定位（防弹窗滚动容器裁剪），样式与 .sel-panel 同构（含弹入动画） */
.tag-pick-panel { display:none; z-index:1050; background:#fff; border:1px solid #e6e1ec; border-radius:8px;
  box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10); padding:4px;
  max-height:220px; overflow-y:auto; animation:selIn .12s ease; }
.tag-pick-opt { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:6px; cursor:pointer;
  font-size:14px; color:#3d3747; transition:background-color .1s; }
.tag-pick-opt:hover { background:#f4f1f7; }
.tag-pick-opt.active { background:#efe3f6; }
.tag-pick-empty { padding:8px; color:#9b91a7; font-size:12px; text-align:center; }
.tag-pick-hint { padding:5px 8px 6px; color:#5a1d78; font-size:12px; border-top:1px solid #f1edf5; margin-top:3px; }

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
/* 可搜索下拉：顶部搜索框 + 选项列表容器 */
.sel-search { box-sizing:border-box; width:calc(100% - 12px); margin:6px 6px 2px; padding:6px 8px;
  border:1px solid #e0d2ef; border-radius:7px; font-size:12px; color:#241f2e; outline:none;
  transition:border-color .12s, box-shadow .12s; }
.sel-search::placeholder { color:#9b91a7; }
.sel-search:focus { border-color:#5a1d78; box-shadow:0 0 0 3px rgba(90,29,120,.14); }
/* 滚动只留 .sel-list 一层：搜索框固定在 panel 顶部不参与滚动 */
.sel-list { max-height:224px; overflow-y:auto; padding:0 6px 6px; }
.sel-chevron { flex-shrink:0; display:inline-flex; color:#6a6178; transition:transform .15s; }
.sel-chevron svg { width:16px; height:16px; }
.sel.open .sel-chevron { transform:rotate(180deg); }
.sel-tag { display:inline-flex; align-items:center; gap:2px; background:#f7f1fa; color:#5a1d78;
  border-radius:10px; padding:1px 6px; font-size:12px; line-height:1.5; }
.sel-tag button { border:none; background:none; padding:0 2px; cursor:pointer; color:#5a1d78;
  font-size:13px; line-height:1; }
.sel-panel { display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1050;
  background:#fff; border:1px solid #e6e1ec; border-radius:8px; box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10);
  padding:4px; }
.sel.open .sel-panel { display:block; animation:selIn .12s ease; }
.sel-count { padding:4px 8px; font-size:12px; color:#9b91a7; border-bottom:1px solid #f1edf5;
  margin-bottom:4px; }
.sel-opt { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:6px; cursor:pointer;
  font-size:14px; color:#3d3747; transition:background-color .1s; position:relative; }
.sel-opt:hover { background:#f4f1f7; }
.sel-opt.active { background:#efe3f6; }
.sel-opt.selected { color:#5a1d78; font-weight:500; }
.sel-check { position:absolute; right:8px; top:50%; transform:translateY(-50%); width:14px; text-align:center;
  color:#5a1d78; font-size:12px; visibility:hidden; }
.sel-opt.selected .sel-check { visibility:visible; }
.sel-opt-desc { margin-left:auto; margin-right:22px; font-size:12px; color:#9b91a7; }
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
.day-chip.on { background:#efe3f6; border-color:#5a1d78; color:#5a1d78; font-weight:600; }
.day-chip.on:hover { box-shadow:0 2px 6px rgba(90,29,120,.18); }

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
.tag.tag-more { background:#fff; color:#8b5fa8; border:1px dashed #d9c7ea; cursor:pointer;
  transition:color .12s, background .12s, border-color .12s; }
.tag.tag-more:hover { color:#5a1d78; background:#f7f1fa; border-color:#c9b0e0; }
.cfg-row .empty { color:#b8abc9; }

/* ===== 弹窗 ===== */
.modal-overlay { position:fixed; inset:0; background:rgba(24,14,32,.45); display:flex; align-items:center;
  justify-content:center; z-index:1000; animation:fadeIn .15s ease; }
.modal-box { background:#fff; border-radius:10px; max-width:720px; width:92%; max-height:85vh;
  display:flex; flex-direction:column; box-shadow:0 2px 4px rgba(90,29,120,.06), 0 16px 40px rgba(60,12,74,.10); animation:modalIn .18s ease; }
.box-confirm { max-width:400px; }
.box-confirm-wide { max-width:600px; } /* 确认弹窗宽款：批量删除预览等需更宽排版 */
.modal-box:focus { outline:none; } /* openModal 焦点落容器（tabindex=-1），不画默认焦点环 */
.modal-header { display:flex; align-items:center; gap:12px; padding:12px 14px 12px 18px; font-weight:600; border-bottom:1px solid #efe9f4; }
.modal-title { flex:1; min-width:0; }
.modal-x { flex-shrink:0; display:flex; align-items:center; justify-content:center; width:26px; height:26px;
  border:none; border-radius:6px; background:transparent; color:#8a7f99; cursor:pointer;
  transition:background .12s, color .12s; }
.modal-x:hover { background:#f7f1fa; color:#5a1d78; }
.modal-x:active { background:#efe3f6; }
.modal-body { padding:16px 18px; overflow-y:auto; }
.modal-msg { white-space:pre-line; line-height:1.6; } /* confirmDialog 消息：保留 \n 换行（删除/替换确认多行文案） */
.modal-footer { padding:12px 18px; border-top:1px solid #efe9f4; display:flex; justify-content:flex-end; gap:8px; }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes modalIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }

/* ===== 数据备份弹窗 ===== */
.bk-box { max-width:760px; }
.bk-tip { display:flex; align-items:flex-start; gap:8px; background:#f7f1fa; border:1px solid #e0d2ef;
  border-radius:8px; padding:10px 12px; font-size:12px; color:#5a4a6b; line-height:1.6; margin-bottom:16px; }
.bk-tip > svg { flex-shrink:0; margin-top:2px; color:#5a1d78; width:15px; height:15px; }
.bk-tip strong { font-weight:600; color:#3d3747; }
.bk-cards { display:flex; gap:12px; }
.bk-card { flex:1; min-width:0; border:1px solid #e6e1ec; border-radius:10px; padding:14px; background:#fff;
  display:flex; flex-direction:column; gap:10px; transition:transform .15s, box-shadow .15s, border-color .15s;
  animation:bkUp .2s ease both; }
.bk-card:nth-child(2) { animation-delay:.05s; }
.bk-card:hover { transform:translateY(-2px); border-color:#c9b0e0;
  box-shadow:0 2px 4px rgba(90,29,120,.06), 0 8px 20px rgba(60,12,74,.08); }
.bk-icon { width:34px; height:34px; border-radius:9px; flex-shrink:0; display:flex; align-items:center;
  justify-content:center; color:#5a1d78; background:linear-gradient(135deg,#f7f1fa 0%,#efe3f6 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.85); }
.bk-icon svg { width:17px; height:17px; }
.bk-card h4 { font-size:14px; font-weight:600; color:#2a2430; margin:0; }
.bk-card p { font-size:12px; color:#6a6178; line-height:1.6; margin:0; flex:1; }
.bk-card .btn { margin-top:2px; width:100%; }
.bk-warn { display:flex; align-items:center; gap:6px; font-size:12px; color:#b45309; margin-top:14px; }
.bk-warn > svg { flex-shrink:0; width:14px; height:14px; }
@keyframes bkUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }

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
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:12px;
  flex:1; min-height:0; overflow-y:auto; font-size:13px; }
.cal-col { display:flex; flex-direction:column; gap:8px; min-width:0;
  background:#fcfafd; border:1px solid #eae5f0; border-radius:10px; padding:8px; }

/* ===== 月视图：周面板纵向堆叠 + 非本月灰显 + chip 月积分小字 ===== */
.cal-month-stack { flex:1; min-height:0; overflow-y:auto; display:flex;
  flex-direction:column; gap:8px; padding-bottom:6px; }
.cal-month-sep { display:flex; align-items:baseline; gap:8px; padding:4px 2px 0;
  font-size:12px; color:#6a6178; }
.cal-month-sep b { color:#5a1d78; font-weight:600; }
.cal-month-panel .cal-grid { flex:none; overflow:visible; }
/* 非本月灰显但照常可操作：内容仅轻淡化（非禁用式降透明），进入列即恢复全亮 + 底色回温，传达可交互 */
.cal-out-month { background:#f4f0f8; transition:background-color .12s; }
.cal-out-month .cal-date { background:#ece6f1; color:#9b8fa7; }
.cal-out-month .cal-date b { color:#a99db4; }
.cal-out-month .cal-slot-card { opacity:.75; transition:opacity .15s; }
.cal-out-month:hover { background:#f7f4fb; }
.cal-out-month:hover .cal-slot-card { opacity:1; }
.cal-out-month .cal-add-day { background:#faf8fc; }

.cal-date { position:relative; background:#f7f1fa; color:#380c4a; border-radius:8px;
  padding:7px 6px; text-align:center; font-weight:600; font-size:13px; }
.cal-date b { display:block; font-size:11px; font-weight:500; color:#6a6178; margin-top:2px; }
.cal-date.cal-today { background:#efe3f6; color:#5a1d78; }
.cal-date.cal-today b { color:#5a1d78; font-weight:600; }
.cal-add-day { position:absolute; top:50%; right:6px; transform:translateY(-50%);
  width:22px; height:22px; border:none; border-radius:7px;
  background:#fff; color:#8b5fa8; cursor:pointer; padding:0;
  display:flex; align-items:center; justify-content:center; opacity:0;
  box-shadow:0 1px 3px rgba(90,29,120,.14);
  transition:opacity .15s, transform .15s, box-shadow .15s, color .15s; }
.cal-add-day:hover { color:#5a1d78; transform:translateY(-50%) scale(1.06);
  box-shadow:0 2px 6px rgba(90,29,120,.22); }
.cal-date:hover .cal-add-day { opacity:1; }
.cal-today-flag { position:absolute; top:4px; left:4px; color:#5a1d78; }

.cal-slot-card { position:relative; border-radius:10px; padding:6px;
  display:flex; flex-direction:column; gap:4px; }
.cal-slot-card.cal-slot-0 { background:#f2e5ee; --sb:#c9a8bd; }
.cal-slot-card.cal-slot-1 { background:#fde8ef; --sb:#eeb7ca; }
.cal-slot-card.cal-slot-2 { background:#e3edf8; --sb:#adc4dd; }
.cal-slot-card.cal-slot-3 { background:#e4d6f4; --sb:#a78cc8; }
.cal-slot-chip { position:absolute; top:1px; right:4px; z-index:1; font-size:9px; font-weight:600;
  color:#380c4a; background:rgba(255,255,255,.85); border-radius:999px; padding:0 6px; line-height:14px; }
.drop-target { outline:2px solid #5a1d78; outline-offset:-2px; }

/* ===== 周历工具栏分组 ===== */
.cal-bar { display:flex; gap:8px; align-items:center; justify-content:space-between; margin-bottom:12px;
  flex-wrap:wrap; }
.cal-bar-group { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

/* ===== 视图维度切换（总览/项目/人员）+ 过滤视图 ===== */
.seg.seg-sm button { padding:4px 12px; font-size:12px; border-radius:7px; }
.cal-dim-select { width:auto; min-width:140px; }
.cal-dim-select .sel-trigger { min-height:30px; padding:4px 10px; font-size:12px; }
.cal-dim-tag { width:auto; min-width:120px; }
.cal-dim-tag .sel-trigger { min-height:30px; padding:4px 10px; font-size:12px; }
.cal-dim-summary { display:flex; align-items:center; gap:10px; font-size:12px; color:#6a6178; margin:0 0 10px; }
.cal-dim-summary b { color:#5a1d78; font-weight:600; }
.cal-dim-summary .s-ok { color:#16a34a; font-weight:500; }
.cal-dim-summary .s-warn { color:#d97706; font-weight:500; }
.cal-dim-summary .s-tag { background:#efe3f6; color:#5a1d78; border-radius:999px; padding:0 8px; line-height:18px; font-size:11px; }
.cal-day-off { border:1px dashed #e0d2ef; border-radius:10px; padding:16px 6px;
  text-align:center; font-size:12px; color:#9b91a7; }
.cal-empty { flex:1; min-height:220px; display:flex; align-items:center; justify-content:center;
  border:1px dashed #e0d2ef; border-radius:12px; background:#fcfafd; color:#9b91a7; font-size:13px; }
.cal-grid.readonly .staff-chip { cursor:default; }

/* ===== 班次卡片状态 ===== */
.cal-slot-card .sch-card { border:1px solid var(--sb, #c9b0e0); background:#fff;
  border-radius:8px; padding:6px; margin-bottom:0;
  display:flex; flex-direction:column; gap:4px;
  transition:box-shadow .15s,transform .15s; }
.cal-slot-card .sch-card:hover { box-shadow:0 2px 6px rgba(90,29,120,.12); transform:translateY(-1px); }
.cal-slot-card .sch-card.short { border-color:#fed7aa; background:#fff7ed; }
.cal-slot-card .sch-card.full { border-color:#bbf7d0; background:#f0fdf4; }
.sch-title { font-weight:600; font-size:12px; color:#5a1d78;
  letter-spacing:.2px; line-height:1.35;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sch-meta { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#6a6178; }
.sch-time { color:#9b91a7; font-size:10px; }
.sch-badge { display:inline-flex; align-items:center; gap:1px; }
.sch-staff { display:flex; flex-wrap:wrap; }
.sch-capacity { font-size:11px; color:#d97706; font-weight:500; }
.sch-capacity.ok { color:#16a34a; }
.sch-smart { flex:none; width:20px; height:20px; border:none; border-radius:6px;
  background:#f7f1fa; color:#8b5fa8; cursor:pointer; padding:0;
  display:flex; align-items:center; justify-content:center;
  transition:background-color .12s,color .12s,transform .12s; }
.sch-smart:hover { background:#efe3f6; color:#5a1d78; transform:scale(1.1); }
.sch-cap-row { display:flex; align-items:center; justify-content:space-between; gap:6px; }

/* ===== 人员 chip 疲劳状态 ===== */
.staff-chip { display:inline-block; background:#fff; border:1px solid #e0d2ef; border-radius:999px;
  padding:1px 8px; margin:2px; cursor:grab; font-size:12px;
  transition:background-color .15s,border-color .15s; }
.staff-chip:hover { background:#f7f1fa; border-color:#c9b0e0; }
.staff-chip.warn { border-color:#fbbf24; background:#fffbeb; color:#b45309; }
.staff-chip.over { border-color:#f87171; background:#fef2f2; color:#b91c1c; font-weight:500; }

/* ===== 卡片容器 ===== */
.card { background:#fff; border:1px solid #eae5f0; border-radius:12px; padding:16px;
  box-shadow:0 1px 2px rgba(90,29,120,.05), 0 8px 20px rgba(60,12,74,.06);
  transition:box-shadow .18s ease, border-color .18s ease; }

/* ===== 数据配置页框架（tab 与按钮固定，内容区容器内滚动） ===== */
.cfg-frame { flex:1; min-height:0; display:flex; flex-direction:column; gap:12px; }
.cfg-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cfg-actions { display:flex; gap:8px; flex-wrap:wrap; }
/* cfg-scroll 为定位层：滚动收在人员/任务的 .cfg-pane-body、系统设置的双 .set-pane-body 内 */
.cfg-scroll { flex:1; min-height:0; display:flex; flex-direction:column; }
/* 卡片面板：内容矮时贴内容高度，超高时被 max-height 限高、滚动在 .cfg-pane-body 内 */
.cfg-pane { min-height:0; max-height:100%; display:flex; flex-direction:column; overflow:hidden;
  background:#faf7fc; border:1px solid #eae5f0; border-radius:12px; }
.cfg-pane-body { flex:1; min-height:0; overflow-y:auto; padding:14px; }
.input.cfg-search { flex:none; width:200px; }
.cfg-tag-sel { flex:none; width:190px; }

/* ===== 配置页卡片网格 ===== */
.card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(288px,1fr)); gap:12px; align-items:stretch; }
.cfg-card { display:flex; flex-direction:column; gap:10px; }
.cfg-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.cfg-card-title { font-size:15px; font-weight:600; color:#241f2e; word-break:break-all; }
.cfg-card-rows { display:flex; flex-direction:column; gap:7px; font-size:13px; }
.cfg-row { display:flex; align-items:flex-start; gap:8px; }
.cfg-row .k { flex-shrink:0; min-width:5.5em; color:#6a6178; }
.cfg-row .v { display:flex; flex-wrap:wrap; gap:4px; min-width:0; align-items:center; }
.cfg-row.cfg-duo { flex-wrap:wrap; row-gap:2px; } /* 人员卡两上限并排一行（周+月） */
.cfg-row.cfg-duo .duo-pair { flex:1 1 0; display:flex; align-items:center; gap:6px; min-width:0; } /* 每半平分行宽 */
.cfg-row.cfg-duo .duo-pair .k { flex-shrink:0; color:#6a6178; }
.cfg-row.cfg-duo .duo-pair .v { flex:0 0 auto; }
/* 任务说明文本：明确 line-height 供 JS 行数测量，长文本强制换行 */
.cfg-row .v-text { display:inline-block; line-height:1.5; word-break:break-all; }
textarea.input { resize:vertical; min-height:64px; line-height:1.5; }
.cfg-card-ops { margin-top:auto; display:flex; justify-content:space-between; align-items:center; gap:8px; padding-top:2px; }
.cfg-op-btns { display:flex; align-items:center; gap:6px; }
.grid-empty { padding:28px; text-align:center; color:#9b91a7; font-size:14px; }

/* ===== 任务视图（任务说明清单：名称+说明为主，供导出图片）===== */
.cfg-view-meta { font-size:13px; color:#6a6178; }
.tview-list { display:flex; flex-direction:column; }
.tview-item { padding:15px 6px 16px; border-bottom:1px solid #f1ecf5; }
.tview-item:last-child { border-bottom:none; }
.tview-name { font-size:17px; font-weight:700; color:#1e1926; line-height:1.4; word-break:break-all; }
.tview-meta { display:flex; align-items:center; flex-wrap:wrap; gap:9px; margin-top:7px; font-size:13px; color:#6a6178; }
.tview-meta .tag { font-size:12px; }
.tview-desc { margin-top:8px; font-size:15px; color:#3d3547; line-height:1.8; white-space:pre-wrap; word-break:break-all; }
.tview-desc.empty { color:#b0a6bc; }

/* ===== 系统设置页 ===== */
.cfg-split { display:flex; gap:12px; height:100%; min-height:0; }
.set-pane { flex:1; min-width:0; height:100%; display:flex; flex-direction:column; overflow:hidden; }
.set-pane-head { padding-bottom:12px; border-bottom:1px solid #f1ecf5; }
.set-pane-top { display:flex; align-items:center; gap:9px; }
.set-pane-ico { flex:none; width:24px; height:24px; border-radius:7px; background:#efe3f6; color:#5a1d78;
  display:inline-flex; align-items:center; justify-content:center; }
.set-pane-ico svg { width:15px; height:15px; }
.set-pane-title { flex:1; min-width:0; font-size:16px; font-weight:700; color:#380c4a; }
.set-pane-ops { flex:none; display:flex; gap:6px; }
.set-pane-sub { margin-top:5px; font-size:12.5px; color:#6a6178; line-height:1.55; }
.set-pane-body { flex:1; min-height:0; overflow-y:auto; padding:2px 2px 4px 0; }
.set-groups { display:flex; flex-direction:column; gap:14px; padding:12px 0 26px; }
.set-group { flex:none; background:#fff; border:1px solid #eae5f0; border-radius:12px; overflow:hidden;
  box-shadow:0 1px 2px rgba(90,29,120,.04); }
.set-group-head { display:flex; flex-direction:column; gap:3px; padding:10px 14px 11px;
  background:linear-gradient(180deg,#faf6fc,#f6eefb); border-bottom:1px solid #efe6f6; }
.set-group-title { font-size:14.5px; font-weight:700; color:#5a1d78; }
.set-group-desc { font-size:12px; color:#8a8099; line-height:1.5; }
.set-params { padding:2px 14px 6px; }
.set-param { padding:12px 0; }
.set-param + .set-param { border-top:1px solid #f3eef7; }
.set-param-main { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.set-param-name { font-size:14px; font-weight:600; color:#2a2430; }
.set-num { flex:none; width:88px; }
.set-param-hint { margin-top:4px; font-size:12.5px; color:#6a6178; line-height:1.6; }
.set-rule-sec + .set-rule-sec { margin-top:16px; padding-top:16px; border-top:1px solid #f1ecf5; }
.set-rule-sec h4 { display:flex; align-items:center; gap:7px; margin:0; font-size:13.5px; font-weight:700; color:#380c4a; }
.set-rule-idx { flex:none; width:18px; height:18px; border-radius:50%; background:#5a1d78; color:#fff;
  font-size:10.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }
.set-rule-formula { margin-top:9px; background:#f7f1fa; border:1px solid #efe3f6; border-radius:8px;
  padding:8px 12px; font-size:13px; font-weight:600; color:#5a1d78; line-height:1.6; }
.set-rule-sec ul { margin:8px 0 0; padding:0; list-style:none; }
.set-rule-sec li { position:relative; padding-left:14px; font-size:13.5px; line-height:1.7; color:#2a2430; }
.set-rule-sec li::before { content:''; position:absolute; left:1px; top:.62em; width:5px; height:5px;
  border-radius:50%; background:#c9b0e0; }
.set-rule-sec li + li { margin-top:5px; }
.set-rule-note { margin-top:9px; font-size:12px; color:#8a8099; line-height:1.6; }
@media (max-width:900px) {
  .cfg-split { flex-direction:column; height:auto; }
  .set-pane { height:auto; min-height:340px; }
}

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
  box-shadow:0 1px 2px rgba(90,29,120,.05), 0 8px 20px rgba(60,12,74,.06); }
.stat-value { font-size:24px; font-weight:700; color:#241f2e; line-height:1.2; }
.stat-label { font-size:12px; color:#6a6178; margin-top:2px; }

/* ===== 分析图表 ===== */
.chart-card { flex:1; min-height:0; display:flex; flex-direction:column; background:#fff;
  border:1px solid #eae5f0; border-radius:12px; padding:10px 14px 4px;
  box-shadow:0 1px 2px rgba(90,29,120,.05), 0 8px 20px rgba(60,12,74,.06); }
.chart-legend { display:flex; justify-content:flex-end; align-items:center; gap:14px; flex-wrap:wrap;
  padding:2px 4px 6px; font-size:12px; color:#6a6178; }
.lg-item { display:inline-flex; align-items:center; gap:6px; }
.lg-swatch { width:11px; height:11px; border-radius:3px; }
.lg-fatigue { background:linear-gradient(180deg,#fbbf24,#d97706); }
.chart-wrap { position:relative; flex:1; min-height:0; }
.chart-wrap canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.chart-empty { height:100%; display:flex; align-items:center; justify-content:center;
  color:#9b91a7; font-size:14px; }

/* ===== 批量铺排预览 ===== */
.bulk-scope { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:12px; font-size:12px; }
.bulk-tag { background:#efe3f6; color:#5a1d78; border-radius:999px; padding:0 8px; line-height:18px; font-size:11px; font-weight:600; }
.bulk-range { color:#6a6178; }
.bulk-count { display:flex; align-items:center; gap:10px; font-size:13px; padding:8px 10px; background:#f7f1fa; border-radius:8px; margin-bottom:8px; }
.bulk-count b { color:#16a34a; font-size:14px; }
.bulk-count .skip { color:#6a6178; }
.bulk-count.none b { color:#d97706; }
.bulk-list { max-height:260px; overflow-y:auto; border:1px solid #efe8f5; border-radius:8px; margin-bottom:8px; }
.bulk-row { display:grid; grid-template-columns:1fr auto auto; gap:12px; align-items:center; padding:7px 10px; font-size:12px; border-top:1px solid #f5f0f9; }
.bulk-row:first-child { border-top:none; }
.bulk-row .name { font-weight:600; color:#241f2e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bulk-row .wd { color:#9b91a7; font-size:11px; white-space:nowrap; }
.bulk-row .cnt { color:#6a6178; white-space:nowrap; }
.bulk-row .cnt b { color:#16a34a; font-weight:600; }
.bulk-row .cnt .skip { color:#9b91a7; }
.bulk-row.head { font-weight:600; color:#9b91a7; font-size:11px; background:#fcfafd; }
.bulk-empty { border:1px dashed #e0d2ef; border-radius:8px; padding:18px 12px; text-align:center; font-size:12px; color:#9b91a7; margin-bottom:8px; }
.bulk-reason { font-size:12px; color:#d97706; margin:-2px 0 8px; }
.bulk-hint { font-size:11px; color:#9b91a7; line-height:1.5; }

/* ===== 智能排班预览 ===== */
.smart-scope { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:12px; font-size:12px; }
.smart-tag { background:#efe3f6; color:#5a1d78; border-radius:999px; padding:0 8px; line-height:18px; font-size:11px; font-weight:600; }
.smart-range { color:#6a6178; }
.smart-count { display:flex; align-items:center; gap:10px; font-size:13px; padding:8px 10px; background:#f7f1fa; border-radius:8px; margin-bottom:8px; }
.smart-count b { color:#16a34a; font-size:14px; }
.smart-count span { color:#6a6178; }
.smart-count .gap { color:#d97706; font-weight:600; }
.smart-count.none b { color:#d97706; }
.smart-list { max-height:240px; overflow-y:auto; border:1px solid #efe8f5; border-radius:8px; margin-bottom:8px; }
.smart-row { display:grid; grid-template-columns:1fr auto auto; gap:12px; align-items:center; padding:7px 10px; font-size:12px; border-top:1px solid #f5f0f9; }
.smart-row:first-child { border-top:none; }
.smart-row .name { font-weight:600; color:#241f2e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.smart-row .cnt { color:#6a6178; white-space:nowrap; }
.smart-row .cnt b { color:#16a34a; font-weight:600; }
.smart-row .cnt .sub { color:#9b91a7; }
.smart-row .gap { color:#d97706; font-weight:600; white-space:nowrap; text-align:right; }
.smart-row.head { font-weight:600; color:#9b91a7; font-size:11px; background:#fcfafd; }
.smart-row.head .gap { color:#9b91a7; }
.smart-gapbox { border:1px solid #f3dcc4; background:#fef8f1; border-radius:8px; padding:8px 10px; margin-bottom:8px; }
.smart-gap-title { font-size:11px; font-weight:600; color:#b45309; margin-bottom:6px; }
.smart-gap { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:12px; border-top:1px dashed #f5e3cd; }
.smart-gap-title + .smart-gap { border-top:none; padding-top:0; }
.smart-gap-date { color:#6a6178; font-weight:500; white-space:nowrap; }
.smart-slot { font-size:11px; color:#5a1d78; background:#efe3f6; border-radius:6px; padding:1px 7px; flex-shrink:0; }
.smart-gap-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; color:#241f2e; }
.smart-gap-miss { color:#b45309; font-weight:600; white-space:nowrap; }
.smart-empty { border:1px dashed #e0d2ef; border-radius:8px; padding:18px 12px; text-align:center; font-size:12px; color:#9b91a7; margin-bottom:8px; }
.smart-reason { font-size:12px; color:#d97706; margin:-2px 0 8px; }
.smart-hint { font-size:11px; color:#9b91a7; line-height:1.5; }

/* ===== 排班删除改造：批量删除多选态 ===== */
.cal-batch-bar { display:flex; align-items:center; justify-content:space-between; gap:10px;
  background:#fdf0ef; border:1px solid #fecaca; border-radius:8px;
  padding:7px 10px; margin:-4px 0 10px; font-size:12px; color:#7f1d1d; }
.cal-batch-tip { display:flex; align-items:center; gap:2px; }
.cal-batch-tip b { color:#dc2626; font-size:13px; }
.cal-batch-right { display:flex; gap:8px; }
.sch-card.selectable { position:relative; cursor:pointer; }
.sch-card.selectable:hover { box-shadow:0 2px 6px rgba(220,38,38,.18); outline:1px solid #fca5a5; }
.sch-card.selectable.selected { outline:2px solid #dc2626; outline-offset:-2px; background:#fff7f7; box-shadow:none; transform:none; }
.sch-sel-tick { position:absolute; top:3px; right:3px; width:16px; height:16px; border-radius:50%;
  border:1px solid #f9a8a8; background:#fff; color:transparent; font-size:10px; line-height:14px;
  text-align:center; pointer-events:none; }
.sch-card.selectable.selected .sch-sel-tick { background:#dc2626; border-color:#dc2626; color:#fff; }
`;

export function injectGlobalStyles() {
  if (document.getElementById('app-theme')) return;
  const style = document.createElement('style');
  style.id = 'app-theme';
  style.textContent = css;
  document.head.appendChild(style);
}

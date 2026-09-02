import { injectGlobalStyles } from './ui/theme.js';
injectGlobalStyles();

import { renderCalendar } from './views/calendar.js';
import { renderConfig } from './views/config.js';
import { renderAnalysis } from './views/analysis.js';
import { loadAll, exportJSON, importJSON } from './data/store.js';
import { KEYS } from './data/keys.js';
import { openModal } from './ui/modal.js';
import { showToast } from './ui/toast.js';

const ICON = {
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/><path d="M8 14h3M13 14h3"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
};

const ICON_BACKUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
const ICON_RESTORE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m0 0L7 8m5-5l5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
const ICON_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const ICON_WARN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`;

const views = {
  calendar: { label: '排班周历', icon: ICON.calendar, render: renderCalendar },
  config: { label: '数据配置', icon: ICON.gear, render: renderConfig },
  analysis: { label: '疲劳分析', icon: ICON.chart, render: renderAnalysis },
};

let current = null;

function buildNav() {
  const nav = document.querySelector('#nav');
  nav.innerHTML = '';
  for (const key of Object.keys(views)) {
    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.key = key;
    item.className = `side-item${key === current ? ' active' : ''}`;
    item.title = views[key].label;
    item.innerHTML = `<span class="side-icon">${views[key].icon}</span><span class="side-label">${views[key].label}</span>`;
    item.onclick = () => switchView(key);
    nav.appendChild(item);
  }
  const backup = document.createElement('button');
  backup.type = 'button';
  backup.id = 'backup-btn';
  backup.className = 'side-item';
  backup.title = '数据备份';
  backup.innerHTML = `<span class="side-icon">${ICON_BACKUP}</span><span class="side-label">数据备份</span>`;
  nav.appendChild(backup);
}

function setActive(key) {
  document.querySelectorAll('.side-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.key === key);
  });
}

async function switchView(key) {
  if (key === current) return;
  current = key;
  setActive(key);
  const view = document.querySelector('#view');
  view.innerHTML = '';
  await views[key].render(view);
}

function initSidebar() {
  const sidebar = document.querySelector('#sidebar');
  sidebar.classList.toggle('collapsed', localStorage.getItem(KEYS.sidebar) === '1');
  document.querySelector('.side-toggle').onclick = () => {
    const now = sidebar.classList.toggle('collapsed');
    localStorage.setItem(KEYS.sidebar, now ? '1' : '0');
  };
}

buildNav();
initSidebar();
initBackup();
init();

function initBackup() {
  const btn = document.querySelector('#backup-btn');
  if (!btn) return;
  btn.onclick = () => {
    const body = document.createElement('div');

    const tip = document.createElement('div');
    tip.className = 'bk-tip';
    tip.innerHTML = `${ICON_SHIELD}<span>定期导出备份可防止数据丢失。备份为 JSON 文件，包含<strong>人员 / 任务 / 班次</strong>全部数据。</span>`;

    const cards = document.createElement('div');
    cards.className = 'bk-cards';

    const exportCard = mkBackupCard(
      ICON_BACKUP, '导出备份',
      '将当前全部数据打包为一个 JSON 文件，下载保存到本地。',
      '导出 JSON', 'btn btn-primary',
      async () => {
        const blob = new Blob([await exportJSON()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        a.href = url;
        a.download = `Numbers-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('已导出备份', 'success');
      },
    );

    const importCard = mkBackupCard(
      ICON_RESTORE, '恢复数据',
      '从备份文件还原数据，将覆盖当前全部内容。',
      '选择备份文件', 'btn btn-default',
      () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
          if (!input.files[0]) return;
          const text = await input.files[0].text();
          const r = await importJSON(text);
          showToast(r.message, r.ok ? 'success' : 'error');
          if (r.ok) location.reload();
        };
        input.click();
      },
    );

    cards.append(exportCard, importCard);

    const warn = document.createElement('div');
    warn.className = 'bk-warn';
    warn.innerHTML = `${ICON_WARN}<span>恢复会覆盖当前数据，请先确认已导出最新备份。</span>`;

    body.append(tip, cards, warn);
    openModal({ title: '数据备份', body, boxClass: 'bk-box' });
  };
}

function mkBackupCard(icon, title, desc, btnText, btnClass, onClick) {
  const card = document.createElement('div');
  card.className = 'bk-card';
  const iconEl = document.createElement('div');
  iconEl.className = 'bk-icon';
  iconEl.innerHTML = icon;
  const h4 = document.createElement('h4');
  h4.textContent = title;
  const p = document.createElement('p');
  p.textContent = desc;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = btnClass;
  b.textContent = btnText;
  b.onclick = onClick;
  card.append(iconEl, h4, p, b);
  return card;
}

async function init() {
  await loadAll();
  await switchView('calendar');
}

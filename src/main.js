import { injectGlobalStyles } from './ui/theme.js';
injectGlobalStyles();

import { renderCalendar } from './views/calendar.js';
import { renderConfig } from './views/config.js';
import { renderAnalysis } from './views/analysis.js';
import { loadAll } from './data/store.js';

const ICON = {
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/><path d="M8 14h3M13 14h3"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
};

const views = {
  calendar: { label: '排班周历', icon: ICON.calendar, render: renderCalendar },
  config: { label: '基础配置', icon: ICON.gear, render: renderConfig },
  analysis: { label: '疲劳分析', icon: ICON.chart, render: renderAnalysis },
};

const TOGGLE_KEY = 'sidebar-collapsed';
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
  sidebar.classList.toggle('collapsed', localStorage.getItem(TOGGLE_KEY) === '1');
  document.querySelector('.side-toggle').onclick = () => {
    const now = sidebar.classList.toggle('collapsed');
    localStorage.setItem(TOGGLE_KEY, now ? '1' : '0');
  };
}

buildNav();
initSidebar();
init();

async function init() {
  await loadAll();
  await switchView('calendar');
}

import { renderCalendar } from './views/calendar.js';
import { renderConfig } from './views/config.js';
import { renderAnalysis } from './views/analysis.js';

const views = {
  calendar: { label: '排班周历', render: renderCalendar },
  config: { label: '基础配置', render: renderConfig },
  analysis: { label: '疲劳分析', render: renderAnalysis },
};

let current = 'calendar';

function buildNav() {
  const nav = document.querySelector('#nav');
  nav.innerHTML = '';
  for (const key of Object.keys(views)) {
    const b = document.createElement('button');
    b.textContent = views[key].label;
    b.className = key === current ? 'active' : '';
    b.onclick = () => switchView(key);
    nav.appendChild(b);
  }
}

async function switchView(key) {
  current = key;
  buildNav();
  const view = document.querySelector('#view');
  view.innerHTML = '';
  await views[key].render(view);
}

buildNav();
switchView('calendar');

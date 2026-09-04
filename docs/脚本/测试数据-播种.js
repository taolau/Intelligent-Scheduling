// 排班测试数据播种脚本
// 用法：在应用页面 DevTools Console 粘贴整个文件执行（日期相对"今天"动态生成，无需改）
// 覆盖范围：过去约 5 周 + 当前周 + 未来 2 周（8 任务 / 11 人员 / ~190 班次）
// 注意：直接覆盖 localStorage 三表（projects/staffs/schedules），无自动备份；
//       如需保留当前数据，先点侧栏「数据备份 → 导出 JSON」存本地，再执行本脚本。
// 演示点：S01 林栋(周上限 4)本周红标；S08 周野禁重活/0 高强度；S11 王新(new)不碰 3 分；
//       赵青(rest)/钱途(left) 仅历史；P07 一次性、P08 停用；未来两周大量未满员可点闪电/智能填充。
(() => {
  // 日期工具（本地时区）
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const thisMon = add(today, 1 - (today.getDay() || 7));
  const monKey = d => ds(add(d, 1 - (d.getDay() || 7)));

  // 任务
  const projects = [
    { id: 'P01', name: '场地搬运', fatigueScore: 3, requiredCapacity: 2, weekDays: [1, 3, 5], slots: [{ label: '早' }, { label: '中' }], description: '把器材从仓库搬到活动场地并归位摆放，重体力，需两人协作；完成后清点数量并签字。', active: true, timeRange: { start: '08:00', end: '18:00' } },
    { id: 'P02', name: '前台接待', fatigueScore: 1, requiredCapacity: 1, weekDays: [1, 2, 3, 4, 5, 6], slots: [{ label: '早' }], description: '', active: true, timeRange: null },
    { id: 'P03', name: '机房巡检', fatigueScore: 2, requiredCapacity: 1, weekDays: [1, 3, 5], slots: [{ label: '晚' }], description: '巡检服务器温度、磁盘与告警灯，异常在群里上报。', active: true, timeRange: { start: '20:00', end: '22:00' } },
    { id: 'P04', name: '会议纪要', fatigueScore: 1, requiredCapacity: 1, weekDays: [2, 4], slots: [{ label: '自主安排' }], description: '', active: true, timeRange: null },
    { id: 'P05', name: '周末大扫除', fatigueScore: 2, requiredCapacity: 3, weekDays: [6], slots: [{ label: '早' }], description: '全办公室清扫，含工位区/茶水间/会议室，约 2 小时。', active: true, timeRange: null },
    { id: 'P06', name: '夜班值守', fatigueScore: 3, requiredCapacity: 2, weekDays: [0, 2, 4, 6], slots: [{ label: '晚' }], description: '', active: true, timeRange: null },
    { id: 'P07', name: '临时搬书', fatigueScore: 2, requiredCapacity: 2, weekDays: [], slots: [{ label: '自主安排' }], description: '一次性任务：图书角整理上架。', active: true, timeRange: null },
    { id: 'P08', name: '采购统计', fatigueScore: 1, requiredCapacity: 1, weekDays: [3], slots: [{ label: '早' }], description: '', active: false, timeRange: null }
  ];

  // 人员
  const D = 86400000;
  const staffs = [
    { id: 'S01', name: '林栋', status: 'active', joinedAt: Date.now() - 3 * D, maxWeeklyFatigue: 4, maxHeavyTaskCount: 1, restFrom: null, allowedProjects: ['P01', 'P03', 'P06'], preferredProjects: [{ projectId: 'P06', reason: '能熬夜' }, { projectId: 'P01', reason: '力气大' }], bannedProjects: [{ projectId: 'P05', reason: '恐高不想扫天花板' }] },
    { id: 'S02', name: '陈曦', status: 'active', joinedAt: Date.now() - 6 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: null, allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'], preferredProjects: [{ projectId: 'P01', reason: '搬运熟练' }], bannedProjects: [] },
    { id: 'S03', name: '高翔', status: 'active', joinedAt: Date.now() - 8 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: null, allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'], preferredProjects: [{ projectId: 'P03', reason: '懂服务器' }], bannedProjects: [] },
    { id: 'S04', name: '苏蔓', status: 'active', joinedAt: Date.now() - 12 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: null, allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'], preferredProjects: [{ projectId: 'P05', reason: '组织能力强' }], bannedProjects: [] },
    { id: 'S05', name: '方圆', status: 'active', joinedAt: Date.now() - 15 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: null, allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'], preferredProjects: [], bannedProjects: [] },
    { id: 'S06', name: '刘川', status: 'active', joinedAt: Date.now() - 18 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 1, restFrom: null, allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'], preferredProjects: [], bannedProjects: [] },
    { id: 'S07', name: '李慧', status: 'active', joinedAt: Date.now() - 20 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: null, allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'], preferredProjects: [{ projectId: 'P04', reason: '打字快' }], bannedProjects: [] },
    { id: 'S08', name: '周野', status: 'active', joinedAt: Date.now() - 25 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 0, restFrom: null, allowedProjects: ['P02', 'P03', 'P04', 'P05', 'P07'], preferredProjects: [], bannedProjects: [{ projectId: 'P06', reason: '夜班失眠' }, { projectId: 'P01', reason: '腰伤' }] },
    { id: 'S11', name: '王新', status: 'new', joinedAt: Date.now() - 1 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: null, allowedProjects: ['P02', 'P04', 'P05'], preferredProjects: [{ projectId: 'P05', reason: '想表现' }], bannedProjects: [] },
    { id: 'S10', name: '赵青', status: 'rest', joinedAt: Date.now() - 60 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: 'active', allowedProjects: ['P02', 'P03', 'P04', 'P05'], preferredProjects: [], bannedProjects: [] },
    { id: 'S09', name: '钱途', status: 'left', joinedAt: Date.now() - 200 * D, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, restFrom: null, allowedProjects: ['P01', 'P03', 'P06'], preferredProjects: [], bannedProjects: [] }
  ];

  // 班次
  const schedules = [];
  const P = Object.fromEntries(projects.map(p => [p.id, p]));
  const S = Object.fromEntries(staffs.map(s => [s.id, s]));
  const pool = {
    P01: ['S02', 'S01', 'S03', 'S05', 'S04', 'S06', 'S07'],
    P02: ['S04', 'S11', 'S02', 'S07', 'S05', 'S06', 'S08', 'S03'],
    P03: ['S03', 'S01', 'S06', 'S07', 'S02', 'S05', 'S04'],
    P04: ['S07', 'S04', 'S11', 'S02', 'S06', 'S05'],
    P05: ['S04', 'S11', 'S02', 'S06', 'S07', 'S08', 'S05', 'S03'],
    P06: ['S02', 'S01', 'S03', 'S05', 'S06', 'S04'],
    P07: ['S05', 'S06', 'S08']
  };
  const bannedOf = s => new Set(s.bannedProjects.map(b => b.projectId));
  const dayCnt = new Map(), slotTaken = new Map(), wkFat = new Map(), wkHvy = new Map();
  const thisMonKey = monKey(thisMon);
  const bump = (sid, f) => { wkFat.set(sid, (wkFat.get(sid) || 0) + f); if (f === 3) wkHvy.set(sid, (wkHvy.get(sid) || 0) + 1); };
  const tryAssign = (pid, dt, slot) => {
    const proj = P[pid];
    const wkey = monKey(dt);
    const dc = dayCnt.get(dt.getTime()) || (dayCnt.set(dt.getTime(), new Map()), dayCnt.get(dt.getTime()));
    const stk = slotTaken.get(dt.getTime() + '|' + slot) || (slotTaken.set(dt.getTime() + '|' + slot, new Set()), slotTaken.get(dt.getTime() + '|' + slot));
    const chosen = [];
    for (const sid of pool[pid]) {
      if (chosen.length >= proj.requiredCapacity) break;
      const st = S[sid];
      if (bannedOf(st).has(pid)) continue;
      if (proj.fatigueScore === 3 && st.status === 'new') continue;
      if (stk.has(sid)) continue;
      if ((dc.get(sid) || 0) >= 2) continue;
      const curFat = wkFat.get(sid) || 0;
      const overFat = curFat + proj.fatigueScore > st.maxWeeklyFatigue;
      const overHvy = proj.fatigueScore === 3 && (wkHvy.get(sid) || 0) + 1 > st.maxHeavyTaskCount;
      const forceRed = sid === 'S01' && wkey === thisMonKey;
      if (!forceRed && (overFat || overHvy)) continue;
      chosen.push(sid); stk.add(sid); dc.set(sid, (dc.get(sid) || 0) + 1); bump(sid, proj.fatigueScore);
    }
    return chosen;
  };
  let seq = 0;
  const addSch = (dt, pid, slot) => {
    const proj = P[pid];
    schedules.push({ id: 'SCH_' + String(++seq).padStart(4, '0'), date: ds(dt), projectId: pid, slotLabel: slot, staffIds: tryAssign(pid, dt, slot) });
  };
  const startT = thisMon.getTime() - 35 * D, endT = thisMon.getTime() + 21 * D;
  for (let t = startT; t <= endT; t += D) {
    const dt = new Date(t), dow = dt.getDay();
    ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'].forEach(pid => {
      const proj = P[pid];
      if (proj.weekDays.includes(dow)) proj.slots.forEach(s => addSch(dt, pid, s.label));
    });
  }
  [-23, -16, -9, -2].forEach(off => addSch(add(thisMon, off), 'P07', '自主安排'));
  const old = o => ds(add(thisMon, o));
  schedules.push(
    { id: 'SCH_old_1', date: old(-16), projectId: 'P01', slotLabel: '早', staffIds: ['S09', 'S02'] },
    { id: 'SCH_old_2', date: old(-14), projectId: 'P06', slotLabel: '晚', staffIds: ['S09', 'S01'] },
    { id: 'SCH_old_3', date: old(-12), projectId: 'P06', slotLabel: '晚', staffIds: ['S09'] },
    { id: 'SCH_old_4', date: old(-10), projectId: 'P02', slotLabel: '早', staffIds: ['S10'] },
    { id: 'SCH_old_5', date: old(-9), projectId: 'P02', slotLabel: '早', staffIds: ['S10'] },
    { id: 'SCH_old_6', date: old(-7), projectId: 'P04', slotLabel: '自主安排', staffIds: ['S10'] }
  );

  localStorage.setItem('is_sched:projects', JSON.stringify(projects));
  localStorage.setItem('is_sched:staffs', JSON.stringify(staffs));
  localStorage.setItem('is_sched:schedules', JSON.stringify(schedules));
  localStorage.removeItem('is_sched:cal_view');
  localStorage.removeItem('is_sched:cal_scale');
  localStorage.removeItem('is_sched:config_tab');
  console.log('SEED OK projects=' + projects.length + ' staffs=' + staffs.length + ' schedules=' + schedules.length + ' range ' + ds(add(thisMon, -35)) + ' ~ ' + ds(add(thisMon, 21)));
  location.reload();
})();

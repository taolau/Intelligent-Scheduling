// ============================================================
// 排班测试数据 - 全面播种脚本（全机制覆盖版）
// 用法：打开应用页面 → DevTools Console 粘贴整个文件执行（日期相对"今天"动态生成，任何日期执行都对齐本周）
//       node 环境 require 本文件做纯核算（不写 localStorage）：const { stats } = require('./测试数据-全面播种.js')
// 覆盖：11 任务 / 11 人员 / 约 170 班次：上上周 ~ 未来 4 周
// ⚠️ 直接覆盖 localStorage 三表，无自动备份；如需保留当前数据，先「数据备份 → 导出 JSON」再执行
//
// 演示点清单（对照 spec §4.2/4.3/5.2 验收）：
//  【本周红】  苏蔓 周疲劳 12/5 + 周高强 4/1 → 红 chip；hover 看「本周疲劳 12/5 · 高强度 4/1」
//  【本周黄】  李慧 周疲劳 11/12（周高强 3/3 达线）；高翔 周疲劳 9/10
//  【月红】    刘川 本月疲劳 ≈21~24/15（周粒度正常、月粒度 chip 红）→ 切月粒度看月 chip 两档
//  【月黄】    李慧 本月 ≈18/20（黄）
//  【连任拒绝】林栋 连续独占 P10 值班巡逻 5 周（周 1/3/5 晚）：9/21、9/23 空班点闪电/加人 →
//             林栋被拒（「同一任务将连任 N 期」），高翔可排（推荐首位）
//  【连任豁免】9/28 空班：高翔当天已 2 班(日限)、刘川当晚已占 P03 机房时段 → 无其他候选 →
//             林栋破例放行（豁免条提示）
//  【当日弹窗】本周五密集日 9 班跨 4 时段 → 日期列头日历钮打开横排卡流 + 导出图片
//             （含 timeRange 排序：早组 08:00 P01 → 09:00 P09；空班 P06 缺1「暂未分配」卡）
//  【加分标签】P05 大扫除 bonusTags[卫生组]（苏蔓/周野/王新带标签）、P06/P10 bonusTags[值班组]
//  【均衡优先】方圆 近 30 天窗口积分全库最低 → 替补/分配推荐「近 N 天排班较少，建议优先」
//  【黑名单】  周野 banned P01(腰伤)/P06(夜班失眠) → 3 分任务候选被拒原因可见；高强上限 0 双拒因
//  【新入】    王新(new) 不碰 3 分任务（分配弹窗「暂不可添加」区可见原因）；均衡恒 0
//  【休假/退出】赵青(rest)/钱途(left) 仅历史班次（导出/统计仍含）
//  【跨月】    8/31~9/6 周横跨 8/31(8月)/9/1-9/6(9月)：周疲劳同周滚动、月疲劳分账；未来含 9/28~10/11 跨下月
//  【未满梯队】 9/14、9/18 P01 缺 1；9/21 P01 全空；P06 9/11 缺 1、9/12 全空；P10 9/21/23/28 全空
//  【一次性/停用】P07 临时搬书(weekDays=[] 手动班 9/11)；P08 采购统计(active:false 仅历史 2 班)
// ============================================================
(() => {
  // ---------- 日期工具（本地时区，周一锚） ----------
  const pad = n => String(n).padStart(2, '0');
  const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const thisMon = new Date(today0.getTime() + (1 - (today0.getDay() || 7)) * 86400000); // 本周一
  const D = (off, dow) => new Date(thisMon.getTime() + (off * 7 + dow - 1) * 86400000); // 周偏移 + 星期几(1=周一)

  // ---------- 任务 ----------
  const projects = [
    { id: 'P01', name: '场地搬运', fatigueScore: 3, requiredCapacity: 2, weekDays: [1, 3, 5], slots: [{ label: '早' }], description: '器材从仓库搬到活动场地并归位，重体力需两人协作；完成后清点数量并签字。', active: true, timeRange: { start: '08:00', end: '18:00' } },
    { id: 'P02', name: '前台接待', fatigueScore: 1, requiredCapacity: 1, weekDays: [1, 2, 3, 4, 5, 6], slots: [{ label: '早' }], description: '', active: true, timeRange: null },
    { id: 'P03', name: '机房巡检', fatigueScore: 2, requiredCapacity: 1, weekDays: [1, 3, 5], slots: [{ label: '晚' }], description: '巡检服务器温度、磁盘与告警灯，异常在群里上报。', active: true, timeRange: { start: '20:00', end: '22:00' } },
    { id: 'P04', name: '会议纪要', fatigueScore: 1, requiredCapacity: 1, weekDays: [2, 4], slots: [{ label: '自主安排' }], description: '', active: true, timeRange: null },
    { id: 'P05', name: '周末大扫除', fatigueScore: 2, requiredCapacity: 3, weekDays: [6], slots: [{ label: '早' }], description: '全办公室清扫，含工位/茶水间/会议室，约 2 小时。', active: true, timeRange: null, bonusTags: ['卫生组'] },
    { id: 'P06', name: '夜班值守', fatigueScore: 3, requiredCapacity: 2, weekDays: [2, 4, 6], slots: [{ label: '晚' }], description: '晚间值守，每两小时巡楼一次。', active: true, timeRange: null, bonusTags: ['值班组'] },
    { id: 'P07', name: '临时搬书', fatigueScore: 2, requiredCapacity: 2, weekDays: [], slots: [{ label: '自主安排' }], description: '一次性任务：图书角整理上架。', active: true, timeRange: null },
    { id: 'P08', name: '采购统计', fatigueScore: 1, requiredCapacity: 1, weekDays: [3], slots: [{ label: '早' }], description: '', active: false, timeRange: null },
    { id: 'P09', name: '活动签到', fatigueScore: 1, requiredCapacity: 2, weekDays: [0], slots: [{ label: '早' }], description: '开放日签到与引导。', active: true, timeRange: { start: '09:00', end: '11:00' } },
    { id: 'P10', name: '值班巡逻', fatigueScore: 2, requiredCapacity: 1, weekDays: [1, 3, 5], slots: [{ label: '晚' }], description: '', active: true, timeRange: { start: '19:00', end: '21:00' }, bonusTags: ['值班组'] },
    { id: 'P11', name: '班车随行', fatigueScore: 1, requiredCapacity: 1, weekDays: [1, 5], slots: [{ label: '中' }], description: '接送协作单位往返，随车清点人数。', active: true, timeRange: { start: '11:30', end: '12:10' } },
  ];
  const P = Object.fromEntries(projects.map(p => [p.id, p]));

  // ---------- 人员 ----------
  const DAY = 86400000;
  const staffs = [
    { id: 'S01', name: '林栋', status: 'active', joinedAt: Date.now() - 90 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, maxMonthlyFatigue: 30, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['值班组'], preferredProjects: [{ projectId: 'P10', reason: '夜巡多年路线熟' }, { projectId: 'P06', reason: '能熬夜' }], bannedProjects: [{ projectId: 'P05', reason: '周末家庭日' }], allowedProjects: ['P01', 'P02', 'P03', 'P06', 'P10'] },
    { id: 'S02', name: '陈曦', status: 'active', joinedAt: Date.now() - 80 * DAY, maxWeeklyFatigue: 12, maxHeavyTaskCount: 4, maxMonthlyFatigue: 40, maxMonthlyHeavyCount: 8, restFrom: null, tags: [], preferredProjects: [{ projectId: 'P01', reason: '搬运熟练' }], bannedProjects: [], allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P06', 'P09', 'P11'] },
    { id: 'S03', name: '高翔', status: 'active', joinedAt: Date.now() - 70 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 4, maxMonthlyFatigue: 35, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['值班组'], preferredProjects: [{ projectId: 'P03', reason: '懂服务器' }], bannedProjects: [], allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P06', 'P09', 'P10'] },
    { id: 'S04', name: '苏蔓', status: 'active', joinedAt: Date.now() - 60 * DAY, maxWeeklyFatigue: 5, maxHeavyTaskCount: 1, maxMonthlyFatigue: 40, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['卫生组'], preferredProjects: [{ projectId: 'P05', reason: '组织能力强' }], bannedProjects: [], allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P09', 'P11'] },
    { id: 'S05', name: '方圆', status: 'active', joinedAt: Date.now() - 50 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, maxMonthlyFatigue: 40, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['机动'], preferredProjects: [], bannedProjects: [], allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P07', 'P09', 'P11'] },
    { id: 'S06', name: '刘川', status: 'active', joinedAt: Date.now() - 40 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 3, maxMonthlyFatigue: 15, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['值班组'], preferredProjects: [], bannedProjects: [{ projectId: 'P05', reason: '周末补习班' }], allowedProjects: ['P01', 'P02', 'P03', 'P06', 'P10'] },
    { id: 'S07', name: '李慧', status: 'active', joinedAt: Date.now() - 30 * DAY, maxWeeklyFatigue: 12, maxHeavyTaskCount: 3, maxMonthlyFatigue: 20, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['机动'], preferredProjects: [{ projectId: 'P04', reason: '打字快' }], bannedProjects: [], allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P09', 'P11'] },
    { id: 'S08', name: '周野', status: 'active', joinedAt: Date.now() - 20 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 0, maxMonthlyFatigue: 40, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['卫生组'], preferredProjects: [{ projectId: 'P05', reason: '爱干净' }], bannedProjects: [{ projectId: 'P01', reason: '腰伤，不宜搬重物' }, { projectId: 'P06', reason: '夜班失眠' }], allowedProjects: ['P02', 'P04', 'P05', 'P07', 'P09', 'P11'] },
    { id: 'S09', name: '钱途', status: 'left', joinedAt: Date.now() - 400 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, maxMonthlyFatigue: 40, maxMonthlyHeavyCount: 8, restFrom: null, tags: [], preferredProjects: [], bannedProjects: [], allowedProjects: ['P01', 'P03', 'P06'] },
    { id: 'S10', name: '赵青', status: 'rest', joinedAt: Date.now() - 300 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, maxMonthlyFatigue: 40, maxMonthlyHeavyCount: 8, restFrom: 'active', tags: [], preferredProjects: [], bannedProjects: [], allowedProjects: ['P02', 'P03', 'P04', 'P05'] },
    { id: 'S11', name: '王新', status: 'new', joinedAt: Date.now() - 2 * DAY, maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, maxMonthlyFatigue: 40, maxMonthlyHeavyCount: 8, restFrom: null, tags: ['卫生组'], preferredProjects: [{ projectId: 'P05', reason: '想表现' }], bannedProjects: [], allowedProjects: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P09', 'P10', 'P11'] },
  ];
  const S = Object.fromEntries(staffs.map(s => [s.id, s]));

  // ---------- 班次构建 ----------
  const schedules = [];
  let seq = 0;
  const usedKeys = new Set(); // 已被叙事硬排占用的 (off|dow|pid|slot)，自动铺排跳过
  const slotUsed = new Map(); // date|sid -> slotLabel（同人同日同 slot 唯一）
  const dayCount = new Map(); // date|sid -> n（同人同日 ≤2）
  const add = (off, dow, pid, slot, staffIds = []) => {
    const key = `${off}|${dow}|${pid}|${slot}`;
    usedKeys.add(key);
    const dt = D(off, dow), ds_ = ds(dt);
    for (const sid of staffIds) {
      slotUsed.set(`${ds_}|${sid}`, slot);
      dayCount.set(`${ds_}|${sid}`, (dayCount.get(`${ds_}|${sid}`) || 0) + 1);
    }
    schedules.push({ id: `SCH_${String(++seq).padStart(4, '0')}`, date: ds_, projectId: pid, slotLabel: slot, staffIds });
  };
  // 9 月自动铺排剔除名单：方圆(均衡最低锚)、李慧(月黄 18/20 锚)——其余人自动排到的超额即是数据本身
  const EXCLUDE_SEP = new Set(['S05', 'S07']);
  const poolFor = off => {
    const ex = off <= 3 ? EXCLUDE_SEP : new Set();
    const all = {
      P01: ['S03', 'S06', 'S02', 'S04'],
      P02: ['S08', 'S11', 'S02', 'S03'],
      P03: ['S06', 'S02', 'S04', 'S03', 'S01'],
      P04: ['S11', 'S02', 'S03'],
      P05: ['S04', 'S08', 'S11', 'S02'],
      P06: ['S02', 'S03', 'S04', 'S01', 'S06'],
      P07: ['S05', 'S08', 'S11'],
      P09: ['S02', 'S03'],
      P10: ['S01', 'S03', 'S06'],
      P11: ['S02', 'S03', 'S04'],
    };
    const result = {};
    for (const [pid, list] of Object.entries(all)) result[pid] = ex.size ? list.filter(s => !ex.has(s)) : list;
    return result;
  };
  const pick = (dt, pid, slot, count) => {
    const proj = P[pid];
    const chosen = [];
    const pool = poolFor(Math.round((dt.getTime() - thisMon.getTime()) / (7 * 86400000)))[pid];
    const start = seq % pool.length; // 轮转起点：避免每班固定取池头
    for (let i = 0; i < pool.length && chosen.length < count; i++) {
      const sid = pool[(start + i) % pool.length];
      const st = S[sid];
      if (chosen.includes(sid)) continue;
      if (!st.allowedProjects.includes(pid)) continue;
      if (st.bannedProjects.some(b => b.projectId === pid)) continue;
      if (proj.fatigueScore === 3 && st.status === 'new') continue;
      if (slotUsed.get(`${ds(dt)}|${sid}`) === slot) continue;
      if ((dayCount.get(`${ds(dt)}|${sid}`) || 0) >= 2) continue;
      chosen.push(sid);
    }
    return chosen;
  };
  const addAuto = (off, dow, pid, slot) => {
    const key = `${off}|${dow}|${pid}|${slot}`;
    if (usedKeys.has(key)) return;
    const dt = D(off, dow);
    const ids = pick(dt, pid, slot, P[pid].requiredCapacity);
    for (const sid of ids) {
      slotUsed.set(`${ds(dt)}|${sid}`, slot);
      dayCount.set(`${ds(dt)}|${sid}`, (dayCount.get(`${ds(dt)}|${sid}`) || 0) + 1);
    }
    schedules.push({ id: `SCH_${String(++seq).padStart(4, '0')}`, date: ds(dt), projectId: pid, slotLabel: slot, staffIds: ids });
  };

  // ================= A. 叙事硬排（锚点，全部显式） =================

  // ---- A1. 本月红线锚（覆盖 R-1/R0 的 P01/P06，9/1~9/13）----
  // 刘川（月红锚 ≈18~22/15）：9/1,3,5 夜班(9 分) + 9/4 P01(3) + 9/8,10 夜班(6)
  // 苏蔓（周红锚：本周 9/5、高强 3/1）：9/7 P01 早 + 9/8、9/11 P06
  add(-1, 1, 'P01', '早', ['S03', 'S02']);                 // 8/31 早
  add(-1, 3, 'P01', '早', ['S02', 'S04']);                 // 9/2 早
  add(-1, 5, 'P01', '早', ['S03', 'S06']);                 // 9/4 早（刘川）
  add(-1, 2, 'P06', '晚', ['S06', 'S01']);                 // 9/1
  add(-1, 4, 'P06', '晚', ['S06', 'S03']);                 // 9/3
  add(-1, 6, 'P06', '晚', ['S06', 'S02']);                 // 9/5
  // 本周 R0（9/7 起）：
  add(0, 1, 'P01', '早', ['S04', 'S07']);                  // 9/7 苏蔓(红)+李慧
  add(0, 3, 'P01', '早', ['S07', 'S03']);                  // 9/9 李慧+高翔(黄)
  add(0, 5, 'P01', '早', ['S07', 'S05']);                  // 9/11 李慧+方圆
  add(0, 2, 'P06', '晚', ['S06', 'S04']);                  // 9/8 刘川+苏蔓
  add(0, 4, 'P06', '晚', ['S02']);                         // 9/10 陈曦单（缺 1；刘川本周只 9/8 一班组「周正常/月红」对照）
  add(0, 6, 'P06', '晚', []);                              // 9/12 全空（未满梯队演示）
  // ---- A1b. 9/16~9/30 P01/P06 手动（3 分任务 9 月全手动，10 月恢复自动）----
  add(1, 1, 'P01', '早', ['S05']);                         // 9/14 缺 1（方圆）
  add(1, 3, 'P01', '早', ['S07', 'S02']);                  // 9/16 李慧(月 18/20 黄锚点)+陈曦
  add(1, 5, 'P01', '早', ['S07']);                         // 9/18 缺 1（李慧）
  add(2, 1, 'P01', '早', []);                              // 9/21 全空（智能排班大缺口）
  add(2, 3, 'P01', '早', ['S03', 'S05']);                  // 9/23 高翔+方圆
  add(2, 5, 'P01', '早', ['S01', 'S03']);                  // 9/25 林栋+高翔
  add(3, 1, 'P01', '早', ['S03', 'S02']);                  // 9/28 高翔+陈曦（豁免封锁：高翔早班）
  add(3, 1, 'P04', '自主安排', ['S03']);                   // 9/28 临时加场纪要（高翔 2 班满日限 → 豁免成立）
  add(3, 3, 'P01', '早', ['S02', 'S04']);                  // 9/30
  // P06 手动（9/15~10/3；刘川月红线 9/10 后定格、林栋不排）
  add(1, 2, 'P06', '晚', ['S02', 'S03']);                  // 9/15
  add(1, 4, 'P06', '晚', ['S02', 'S04']);                  // 9/17
  add(1, 6, 'P06', '晚', ['S02', 'S04']);                  // 9/19
  add(2, 2, 'P06', '晚', ['S02', 'S04']);                  // 9/22
  add(2, 4, 'P06', '晚', ['S02', 'S04']);                  // 9/24
  add(2, 6, 'P06', '晚', ['S04']);                         // 9/26 缺 1（苏蔓）
  add(3, 2, 'P06', '晚', ['S02', 'S03']);                  // 9/29
  add(3, 4, 'P06', '晚', ['S02', 'S04']);                  // 10/1
  add(3, 6, 'P06', '晚', ['S03', 'S04']);                  // 10/3

  // ---- A2. P10 值班巡逻（连任主线：林栋连续独占，9/21 起留空供「闪电/加人」演示）----
  for (const off of [-1, 0, 1]) for (const dow of [1, 3, 5]) add(off, dow, 'P10', '晚', ['S01']); // 期 1~3
  add(2, 1, 'P10', '晚', []);                              // 9/21 空：加林栋应被拒(段长将超 3 期)，高翔可排
  add(2, 3, 'P10', '晚', []);                              // 9/23 空
  add(2, 5, 'P10', '晚', ['S01']);                         // 9/25 林栋第 4 期（已落库）
  add(3, 1, 'P10', '晚', []);                              // 9/28 空：高翔日满+刘川晚 slot 占 → 加林栋应豁免放行
  add(3, 3, 'P10', '晚', ['S03']);                         // 9/30
  add(3, 5, 'P10', '晚', ['S03']);                         // 10/2
  add(4, 1, 'P10', '晚', ['S03']);
  add(4, 3, 'P10', '晚', ['S01']);
  add(4, 5, 'P10', '晚', ['S03']);

  // ---- A3. 本周五（9/11）密集日：当日弹窗演示（9 班跨 4 时段） ----
  add(0, 5, 'P07', '自主安排', ['S05', 'S11']);            // 一次性任务（方圆+王新）
  add(0, 5, 'P04', '自主安排', ['S07']);                   // 临时加场纪要（李慧）
  add(0, 5, 'P09', '早', ['S08', 'S11']);                  // 活动签到 09:00-11:00（与 P01 08:00 组内排序对照）
  add(0, 5, 'P03', '晚', ['S06']);                         // 机房（刘川）
  add(0, 5, 'P06', '晚', ['S04']);                         // 夜班缺 1 →「暂未分配」卡

  // ---- A4. P03 机房 R0 叙事（高翔黄锚）+ 9/28 封锁 ----
  add(0, 1, 'P03', '晚', ['S03']);                         // 9/7 高翔
  add(0, 3, 'P03', '晚', ['S03']);                         // 9/9 高翔
  add(3, 1, 'P03', '晚', ['S06']);                         // 9/28 刘川（豁免封锁：刘川当晚占晚 slot）

  // ---- A5. P05 大扫除每周六（9 月 4 周固定组，10 月起自动）----
  add(-1, 6, 'P05', '早', ['S04', 'S08', 'S11']);          // 9/5 苏蔓+周野+王新
  add(0, 6, 'P05', '早', ['S07', 'S08', 'S11']);           // 9/12 李慧(月 2 分)+周野+王新
  add(1, 6, 'P05', '早', ['S04', 'S08', 'S11']);           // 9/19 苏蔓+周野+王新
  add(2, 6, 'P05', '早', ['S04', 'S08', 'S11']);           // 9/26 苏蔓+周野+王新

  // ---- A6. 停用任务历史 + left/rest 历史 + 方圆均衡低零星班 ----
  add(-2, 3, 'P08', '早', ['S07']);                        // 停用历史
  add(-1, 3, 'P08', '早', ['S07']);                        // 停用历史（9/2，李慧月 1 分）
  add(-3, 1, 'P01', '早', ['S09', 'S02']);                 // 钱途(left) 历史
  add(-3, 3, 'P01', '早', ['S09', 'S03']);                 // 钱途(left) 历史
  add(-3, 4, 'P06', '晚', ['S09', 'S01']);                 // 钱途(left) 历史
  add(-3, 2, 'P02', '早', ['S10']);                        // 赵青(rest) 历史
  add(-3, 4, 'P04', '自主安排', ['S10']);                  // 赵青(rest) 历史
  add(-2, 1, 'P03', '晚', ['S10']);                        // 赵青(rest) 历史
  add(-2, 5, 'P02', '早', ['S09']);                        // 钱途(left) 历史
  add(-3, 1, 'P11', '中', ['S05']);                        // 方圆 窗口 2 分
  add(-3, 5, 'P11', '中', ['S05']);                        // 方圆 窗口 4 分

  // ================= B. 常规自动铺排（6 周，skip 叙事占用） =================
  for (let off = -1; off <= 4; off++) {
    for (let dow = 1; dow <= 7; dow++) {
      for (const p of projects) {
        if (!p.active || !p.weekDays.includes(dow)) continue;
        for (const s of p.slots) addAuto(off, dow, p.id, s.label);
      }
    }
  }

  // ---------- 核算（node require 与 console 播种通用） ----------
  const mondayOf = d => { const x = new Date(d + 'T00:00:00'); return ds(new Date(x.getTime() + (1 - (x.getDay() || 7)) * 86400000)); };
  const staffName = Object.fromEntries(staffs.map(s => [s.id, s.name]));
  const fOf = s => P[s.projectId]?.fatigueScore ?? 0;
  const accumulate = () => {
    const month = {}, week = {}, win = {};
    const windowCut = ds(new Date(today0.getTime() - 30 * 86400000));
    for (const s of schedules) {
      const f = fOf(s); if (!f) continue;
      const mk = `${s.date.slice(0, 7)}`, wk = mondayOf(s.date);
      for (const sid of s.staffIds) {
        (month[mk] = month[mk] || {})[sid] = month[mk][sid] || { f: 0, h: 0 };
        const m = month[mk][sid], w = (week[wk] = week[wk] || {})[sid] = (week[wk] || {})[sid] || { f: 0, h: 0 };
        m.f += f; if (f === 3) m.h++;
        w.f += f; if (f === 3) w.h++;
        if (s.date >= windowCut) win[sid] = (win[sid] || 0) + f;
      }
    }
    return { month, week, win, windowCut };
  };
  const { month, week, win, windowCut } = accumulate();
  const curMon = ds(today0).slice(0, 7);
  const curWk = mondayOf(ds(today0));
  const fmt = (m, w) => `${m.f}/${w.maxWeeklyFatigue ?? 10} · 高强 ${m.h}/${w.maxHeavyTaskCount ?? 2}`;
  const line = [];
  line.push('【总量】' + schedules.length + ' 班次（窗口起点 ' + windowCut + '）');
  line.push('【本月 ' + curMon + ' / 本周对照】月疲劳：刘川 30/15=红(锚)；李慧 19/20=黄(锚)；苏蔓 46/40=红(红线人自然)；高翔/陈曦 43~50 超限(噪点数据，非锚)');
  for (const sid of ['S04', 'S06', 'S07', 'S05', 'S03', 'S02', 'S01', 'S08', 'S11']) {
    const m = (month[curMon] || {})[sid] || { f: 0, h: 0 };
    const w = (week[curWk] || {})[sid] || { f: 0, h: 0 };
    line.push(`  ${staffName[sid]}：本月 ${m.f}/${S[sid].maxMonthlyFatigue ?? 40} 高强 ${m.h}/${S[sid].maxMonthlyHeavyCount ?? 8} | 本周 ${w.f}/${S[sid].maxWeeklyFatigue} 高强 ${w.h}/${S[sid].maxHeavyTaskCount}`);
  }
  line.push('【窗口积分排序】(active 最低者=方圆 13 → 替补推荐「近 N 天排班较少」；赵青/钱途为 rest/left 不参与均衡)');
  line.push('  ' + Object.entries(win).sort((a, b) => a[1] - b[1]).map(([sid, v]) => `${staffName[sid]} ${v}`).join(' | '));
  line.push('【本周五密集日】(当日弹窗：早 3 / 中 1 / 晚 3 / 自主 2 = 9 班)');
  const fri = ds(D(0, 5));
  for (const s of schedules.filter(x => x.date === fri)) {
    line.push(`  ${s.slotLabel} ${P[s.projectId].name} [${s.staffIds.length ? s.staffIds.map(id => staffName[id]).join('、') : '空'}]`);
  }
  line.push('【P10 巡逻】' + schedules.filter(x => x.projectId === 'P10').map(s => `${s.date.slice(5)} ${s.staffIds.length ? staffName[s.staffIds[0]] : '空'}`).join(' | '));
  const stats = line.join('\n');

  if (typeof module !== 'undefined' && module.exports) { module.exports = { projects, staffs, schedules, stats }; return; }

  localStorage.setItem('is_sched:projects', JSON.stringify(projects));
  localStorage.setItem('is_sched:staffs', JSON.stringify(staffs));
  localStorage.setItem('is_sched:schedules', JSON.stringify(schedules));
  localStorage.removeItem('is_sched:cal_view');
  localStorage.removeItem('is_sched:cal_scale');
  localStorage.removeItem('is_sched:config_tab');
  console.log('========== 测试数据播种完成 ==========');
  console.log(stats);
  location.reload();
})();

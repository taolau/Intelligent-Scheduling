import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX_NS from 'xlsx-js-style';
const XLSX = XLSX_NS.default ?? XLSX_NS;
import { getCache, saveProject, saveStaff } from '../src/data/store.js';
import { createProject, createStaff } from '../src/data/model.js';
import { formatAvailability, parseAvailability, buildProjectsAoa, buildStaffsAoa, buildSheet, importStaffs, importProjects, PROJECT_BASE_COLS, STAFF_BASE_COLS } from '../src/ui/excel.js';

// 端到端「导出 → 重导入」闭环需要 store 读写；node 无 localStorage，文件级注入内存 mock
const storage = {};
globalThis.localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; },
};

test('formatAvailability: null/空 entries → 两列皆空', () => {
  assert.deepEqual(formatAvailability(null), { mode: '', entries: '' });
  assert.deepEqual(formatAvailability(undefined), { mode: '', entries: '' });
  assert.deepEqual(formatAvailability({ mode: 'available', entries: [] }), { mode: '', entries: '' });
});

test('formatAvailability: 输出全称星期 + 中文模式，可回读', () => {
  const av = { mode: 'unavailable', entries: [
    { weekDays: [1, 3], start: '09:00', end: '12:00' },
    { weekDays: [0], start: '14:00', end: '18:00' },
  ] };
  const { mode, entries } = formatAvailability(av);
  assert.equal(mode, '不可用');
  assert.equal(entries, '周一、周三 09:00-12:00;周日 14:00-18:00');
  const back = parseAvailability(mode, entries);
  assert.equal(back.error, undefined);
  assert.deepEqual(back.value, av);
});

test('formatAvailability/parseAvailability: 全天（无起止）往返', () => {
  const av = { mode: 'unavailable', entries: [
    { weekDays: [1] },
    { weekDays: [0], start: '09:00', end: '12:00' },
  ] };
  const { mode, entries } = formatAvailability(av);
  assert.equal(mode, '不可用');
  assert.equal(entries, '周一 全天;周日 09:00-12:00');
  assert.deepEqual(parseAvailability(mode, entries).value, av);
  assert.equal(parseAvailability('不可用', '周一 全天').value.entries[0].start, undefined);
});

test('parseAvailability: 两列均空 → value null（未配置）', () => {
  assert.deepEqual(parseAvailability('', ''), { value: null });
  assert.deepEqual(parseAvailability(undefined, undefined), { value: null });
});

test('parseAvailability: 仅模式或仅时段 → error', () => {
  assert.ok(parseAvailability('可用', '').error);
  assert.ok(parseAvailability('', '周一 09:00-12:00').error);
  assert.ok(parseAvailability('限制', '周一 09:00-12:00').error);
});

test('parseAvailability: 非法星期 / 缺时分隔 / 倒挂跨日 → error', () => {
  assert.ok(parseAvailability('可用', '周一和周三 09:00-12:00').error); // 含不识别字符
  assert.ok(parseAvailability('可用', '周一 0900-12:00').error);
  assert.ok(parseAvailability('可用', '周一 22:00-02:00').error); // 跨日
  assert.ok(parseAvailability('可用', '周一 12:00-09:00').error); // 倒挂
  assert.ok(parseAvailability('可用', '周八 09:00-12:00').error);
});

test('parseAvailability: 兼容全角冒号，多时间段以分号分隔', () => {
  const r = parseAvailability('可用', '周一、周三 09：00-12：00;周五 08:00-10:00');
  assert.equal(r.error, undefined);
  assert.deepEqual(r.value.entries[0].weekDays, [1, 3]);
  assert.deepEqual(r.value.entries[1].weekDays, [5]);
  assert.equal(r.value.entries[1].start, '08:00');
});

// ---- 09-09 导出改造：去 ID 列 / 任务中文名 / 样式 ----

test('buildProjectsAoa: 无 ID 列，列序 = 任务卡片展示顺序', () => {
  const aoa = buildProjectsAoa([
    { id: 'P101', name: '场地搬运', fatigueScore: 3, requiredCapacity: 2, weekDays: [0, 1], slots: [{ label: '早' }, { label: '中' }], timeRange: { start: '08:00', end: '18:00' }, description: '注意轻拿轻放', bonusTags: ['组长'], active: true },
    { id: 'P102', name: '一次性', fatigueScore: 1, requiredCapacity: 1, weekDays: [], slots: [{ label: '自主安排' }], timeRange: null, description: '', bonusTags: [], active: false },
  ]);
  assert.equal(aoa[0][0], '名称');
  assert.equal(aoa[0].includes('ID'), false);
  assert.deepEqual(aoa[0], ['名称', '启用', '劳累指数', '所需人数', '重复星期', '时段', '时间段开始', '时间段结束', '加分标签', '任务说明']);
  assert.deepEqual(aoa[1], ['场地搬运', 1, 3, 2, '7;1', '早;中', '08:00', '18:00', '组长', '注意轻拿轻放']);
  assert.deepEqual(aoa[2], ['一次性', 0, 1, 1, '', '自主安排', '', '', '', '']);
});

test('buildStaffsAoa: 列序 = 人员卡片展示顺序，任务引用导出中文名，任务已删/任务名含括号回退 ID', () => {
  const staffs = [{
    id: 'S001', name: '张三', status: 'active',
    allowedProjects: ['P101', 'P999'],
    preferredProjects: [{ projectId: 'P101', reason: '体力好,搬运熟练' }],
    bannedProjects: [{ projectId: 'P102', reason: '腰伤' }, { projectId: 'P777' }],
    maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, tags: ['组长'], availability: null,
  }];
  const projects = [
    { id: 'P101', name: '场地搬运' },
    { id: 'P102', name: '门(岗)执勤' }, // 任务名含括号 → 防中文名(原因) 再导入解析错，回退 ID
  ];
  const settings = { defaultMonthlyFatigue: 40, defaultMonthlyHeavyCount: 8 };
  const aoa = buildStaffsAoa(staffs, projects, settings);
  assert.equal(aoa[0].includes('ID'), false);
  assert.deepEqual(aoa[0], ['姓名', '状态', '可胜任任务', '擅长任务', '不合适任务', '标签', '每周时间模式', '每周时间段', '周疲劳上限', '月疲劳上限', '周高强度次数上限', '月高强度次数上限']);
  assert.equal(aoa[1][1], '活跃');
  assert.equal(aoa[1][2], '场地搬运;P999'); // 中文名 + 已删任务回退 ID
  assert.equal(aoa[1][3], '场地搬运(体力好,搬运熟练)');
  assert.equal(aoa[1][4], 'P102(腰伤);P777'); // 含括号任务回退 ID + 已删回退
  assert.equal(aoa[1][5], '组长'); // 标签（卡片「标签」行）
  assert.equal(aoa[1][6], ''); // 时间安排模式
  assert.equal(aoa[1][7], ''); // 时间安排段
  assert.equal(aoa[1][8], 10); // 周疲劳上限
  assert.equal(aoa[1][9], 40); // 月疲劳上限（未配置取设置默认）
  assert.equal(aoa[1][10], 2); // 周高强度次数上限
  assert.equal(aoa[1][11], 8); // 月高强度次数上限
});

test('buildSheet: 表头深紫字淡紫底 + 数据行边框换行 + 列宽留白/行高/自动筛选', () => {
  const aoa = [['名称', '说明'], ['场地搬运', '长文本说明'], ['门口执勤', '']];
  const ws = buildSheet(aoa);
  assert.equal(ws['A1'].s.font.bold, true);
  assert.equal(ws['A1'].s.font.color.rgb, '5A1D78');
  assert.equal(ws['A1'].s.fill.fgColor.rgb, 'E6DCF4');
  assert.equal(ws['A1'].s.alignment.wrapText, true);
  assert.equal(ws['A1'].s.border.top.style, 'thin');
  assert.equal(ws['A1'].s.border.left.color.rgb, 'C4B5DD');
  assert.equal(ws['A2'].s.border.all, undefined); // xlsx-js-style 的 border.all 不生效，须显式四边
  assert.equal(ws['A2'].s.border.top.style, 'thin');
  assert.equal(ws['A2'].s.border.bottom.color.rgb, 'E0D9EE');
  assert.equal(ws['A2'].s.alignment.wrapText, true);
  assert.deepEqual(ws['!cols'].map(c => c.wch), [14, 15]); // 最长「场地搬运」8+5→min14 /「长文本说明」10+5
  assert.equal(ws['!rows'].length, 3);
  assert.equal(ws['!autofilter'].ref, 'A1:B3');
});

test('导出文件重导入闭环：中文任务名解析回 ID，不丢引用', async () => {
  await saveProject(createProject({ id: 'P101', name: '场地搬运', fatigueScore: 3, requiredCapacity: 2, weekDays: [1], slots: [{ label: '早' }] }));
  await saveStaff(createStaff({
    id: 'S001', name: '张三', status: 'active',
    allowedProjects: ['P101'], preferredProjects: [{ projectId: 'P101', reason: '体力好' }], bannedProjects: [],
    maxWeeklyFatigue: 10, maxHeavyTaskCount: 2, tags: ['组长'],
  }));

  // 用 buildStaffsAoa 生成「新导出格式」文件（中文名、无 ID）
  const { staffs, projects } = getCache();
  const settings = getCache().settings ?? (await import('../src/data/store.js')).getSettings();
  const aoa = buildStaffsAoa(staffs, projects, settings);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(aoa), '人员');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const file = new File([buf], 'Numbers-人员表.xlsx');

  const result = await importStaffs(file);
  assert.equal(result.ok, true);
  const after = getCache().staffs.find(s => s.id === 'S001');
  assert.deepEqual(after.allowedProjects, ['P101']);
  assert.deepEqual(after.preferredProjects, [{ projectId: 'P101', reason: '体力好' }]);
  assert.deepEqual(after.bannedProjects, []);
});

test('新模板表头（只标必填）可重导入：alias 解析 + 空字段自动入默认值', async () => {
  const fileFor = (aoa, name) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildSheet(aoa), '模板');
    return new File([XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })], name);
  };
  // 任务：仅名称必填；劳累/人数/启用留空 → 默认 1 / 1 / 启用
  const pr = await importProjects(fileFor([
    PROJECT_BASE_COLS,
    ['场地搬运', '', '', '', '7;1', '早', '', '', '', '搬运物资到三楼'],
  ], '任务模板.xlsx'));
  assert.equal(pr.ok, true);
  const p = getCache().projects.find(x => x.name === '场地搬运');
  assert.equal(p.fatigueScore, 1); // 空 → 默认 1
  assert.equal(p.requiredCapacity, 1); // 空 → 默认 1
  assert.deepEqual(p.weekDays, [0, 1]); // '7;1' → 周日/周一
  assert.deepEqual(p.slots, [{ label: '早' }]);
  assert.equal(p.active, true); // 空 → 默认启用
  assert.equal(p.description, '搬运物资到三楼');
  assert.deepEqual(p.bonusTags, []);

  // 人员：状态留空 → 默认活跃；上限留空 → 系统设置默认；月高强填 0（禁排）→ 保留 0；可胜任按中文名解析回任务 ID
  const sr = await importStaffs(fileFor([
    STAFF_BASE_COLS,
    ['李四', '', '场地搬运', '场地搬运(力气大)', '', '值班', '', '', '', '', '', '0'],
  ], '人员模板.xlsx'));
  assert.equal(sr.ok, true);
  const s = getCache().staffs.find(x => x.name === '李四');
  assert.equal(s.status, 'active'); // 状态空 → 默认活跃
  assert.deepEqual(s.allowedProjects, [p.id]); // 中文名 → 解析回任务 ID
  assert.deepEqual(s.preferredProjects, [{ projectId: p.id, reason: '力气大' }]);
  assert.deepEqual(s.tags, ['值班']);
  assert.equal(s.maxWeeklyFatigue, 10); // 上限空 → settings 默认
  assert.equal(s.maxHeavyTaskCount, 2);
  assert.equal(s.maxMonthlyFatigue, 40);
  assert.equal(s.maxMonthlyHeavyCount, 0); // 填 0 = 禁排高强度整月，不被默认值吞
});

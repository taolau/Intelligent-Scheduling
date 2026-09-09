// Excel 导入边界回归（importProjects / importStaffs 全矩阵）
// 与 excel.test.js（导出格式/解析函数）互补：本文件专测「真实 xlsx 文件 → 导入函数 → 落库 → message」的集成语义。
// UI 导入（config.js importDialog）调用的正是这两个导出函数，故本文件即 UI 导入的回归基线，npm test 自动跑。
// 前置：node 全局有 File（同 excel.test.js）；store 用内存缓存，beforeEach resetAll() 隔离。
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX_NS from 'xlsx-js-style';
const XLSX = XLSX_NS.default ?? XLSX_NS;
import { getCache, saveProject, saveStaff, saveSettings, resetAll, getSettings } from '../src/data/store.js';
import { createProject, createStaff, SLOT_LABELS } from '../src/data/model.js';
import {
  importStaffs, importProjects, buildStaffsAoa, buildProjectsAoa,
  PROJECT_BASE_COLS, STAFF_BASE_COLS,
} from '../src/ui/excel.js';

// ---- localStorage mock（node 无 localStorage；resetAll 走 db 层读写此 mock） ----
const storage = {};
globalThis.localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; },
};
beforeEach(async () => { await resetAll(); });

// 便捷：aoa（表头已含说明/别名）→ 真实 xlsx File → 调用导入
function fileFor(aoa, name = '导入.xlsx', sheet = 'Sheet1', bookType = 'xlsx') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  return new File([XLSX.write(wb, { bookType, type: 'buffer' })], name);
}
// 模板头快捷用法：PROJECT_BASE_COLS = 真实「下载模板」表头（含 (必填) 说明）
const mkProjectFile = (rows, name) => fileFor([PROJECT_BASE_COLS, ...rows], name);
const mkStaffFile = (rows, name) => fileFor([STAFF_BASE_COLS, ...rows], name);
const P = name => getCache().projects.find(p => p.name === name);
const S = name => getCache().staffs.find(s => s.name === name);

// ============ 任务导入 ============

test('任务：模板头基本字段全解析 + 示例行跳过', async () => {
  const r = await importProjects(mkProjectFile([
    ['【示例】场地搬运', '1', '3', '2', '7;1', '早;中', '08:00', '18:00', '组长', '示例不导入'],
    ['搬运物资', '', '2', '3', '7;2;4', '中', '09:00', '12:00', '', '轻拿轻放'],
    ['门口执勤', '', '1', '1', '', '自主安排', '', '', '', ''],
  ]));
  assert.equal(r.ok, true);
  const projects = getCache().projects;
  assert.equal(projects.length, 2); // 示例行跳过
  assert.equal(P('搬运物资').fatigueScore, 2);
  assert.equal(P('搬运物资').requiredCapacity, 3);
  assert.deepEqual(P('搬运物资').weekDays, [0, 2, 4]); // '7;2;4' → 周日(0),周二(2),周四(4)
  assert.deepEqual(P('搬运物资').slots.map(s => s.label), ['中']);
  assert.deepEqual(P('搬运物资').timeRange, { start: '09:00', end: '12:00' });
  assert.equal(P('搬运物资').description, '轻拿轻放');
  assert.equal(P('搬运物资').active, true);
  assert.equal(P('门口执勤').weekDays.length, 0); // 空星期 = 一次性任务
  assert.ok(r.message.includes('新增 2'));
});

test('任务：空字段 → 默认（劳累1/人数1/启用1），时段全非法标签落空数组（宽容）', async () => {
  await importProjects(mkProjectFile([
    ['巡逻', '', '', '', '8', '夜班;凌晨', '', '', '', ''],
  ]));
  const p = P('巡逻');
  assert.equal(p.fatigueScore, 1);
  assert.equal(p.requiredCapacity, 1);
  assert.equal(p.weekDays.length, 0); // '8' 越界被 parseWeekDays 过滤 → 一次性
  assert.deepEqual(p.slots, []); // '夜班'/'凌晨' 不在 SLOT_LABELS → 空（validate 不会跑，宽容落库）
  assert.equal(p.active, true);
  assert.equal(p.timeRange, null);
  assert.equal(p.description, '');
});

test('任务：同名已存在 → 覆盖更新保留原 id（引用安全），仅 updated 计数', async () => {
  const orig = createProject({ id: 'P-KEEP', name: '搬运', fatigueScore: 3, requiredCapacity: 2 });
  await saveProject(orig);
  await importProjects(mkProjectFile([['搬运', '1', '1', '4', '', '早', '', '', '', '改名改分']]));
  const p = P('搬运');
  assert.equal(p.id, 'P-KEEP'); // 保留原 id
  assert.equal(p.fatigueScore, 1); // 内容被覆盖
  assert.equal(p.requiredCapacity, 4);
  assert.equal(getCache().projects.length, 1); // 不新增
});

test('任务：旧含 ID 文件 + 旧表头别名兜底 → 按 ID 覆盖更新，新列补默认', async () => {
  const orig = createProject({ id: 'P101', name: '旧名', fatigueScore: 3, requiredCapacity: 2, weekDays: [0], slots: [{ label: '早' }] });
  await saveProject(orig);
  // 旧版表头：含 ID 列、'劳累指数(1-3)' 等旧文案；重复星期用 0-6
  const old = fileFor([
    ['ID', '名称(必填)', '劳累指数(1-3)', '所需人数(必填)', '重复星期(0-6)', '时段(分号隔开)', '启用(1/0)'],
    ['P101', 'P101 新名', '2', '', '0', '中;晚', '1'],
    ['', '纯新增', '3', '1', '', '早', ''],
  ]);
  const r = await importProjects(old);
  assert.equal(r.ok, true);
  assert.equal(P('P101 新名').id, 'P101'); // ID 列命中 → 改名覆盖
  assert.equal(P('P101 新名').fatigueScore, 2);
  assert.deepEqual(P('P101 新名').slots.map(s => s.label), ['中', '晚']);
  assert.equal(P('P101 新名').active, true);
  assert.equal(P('纯新增').id.startsWith('P'), false); // 无 ID → 随机新 id
});

test('任务：文件内多行同名 → 后者覆盖前者，库中只留一条（净计数不再双计）', async () => {
  const r = await importProjects(mkProjectFile([
    ['同任务', '', '3', '2', '', '早', '', '', '', '第一行'],
    ['同任务', '', '1', '5', '', '中', '', '', '', '第二行'],
  ]));
  const p = P('同任务');
  assert.equal(getCache().projects.length, 1);
  assert.equal(p.fatigueScore, 1); // 第二行赢
  assert.equal(p.requiredCapacity, 5);
  assert.equal(p.description, '第二行');
  assert.ok(r.message.includes('新增 1')); // 同 id 去重：文件内覆盖不再「新增1更新1」双计
  assert.ok(!r.message.includes('更新 1'));
});

test('任务：数值越界落默认（劳累超出 1-3 / 人数非正整数 → 1 并计数，2026-09-09 Tao 收紧）', async () => {
  const r = await importProjects(mkProjectFile([
    ['巡逻', '', '99', '-2', '', '早', '', '', '', ''],
    ['看门', '', '3.7', '2.6', '', '早', '', '', '', ''],
  ]));
  // 收紧后：不再宽容落库——越界/非数/小数人数 → 默认 1 并计数提示
  assert.equal(P('巡逻').fatigueScore, 1); // 99 超 1-3
  assert.equal(P('巡逻').requiredCapacity, 1); // -2 非法
  assert.equal(P('看门').fatigueScore, 1); // 3.7 超 1-3
  assert.equal(P('看门').requiredCapacity, 1); // 2.6 非整数
  assert.ok(r.message.includes('4 处劳累/人数超出范围已按默认'));
});

test('任务：启用列 0=禁用；值 trim 后识别（2026-09-09 补 trim，空格值不再误判启用）', async () => {
  await importProjects(mkProjectFile([
    ['停用任务', '', '', '', '', '早', '', '', '', ''],
    ['填零禁用', '0', '', '', '', '早', '', '', '', ''],
    ['空格零', ' 0 ', '', '', '', '早', '', '', '', ''],
  ]));
  assert.equal(P('停用任务').active, true); // 空 → 启用
  assert.equal(P('填零禁用').active, false); // '0' → 禁用
  assert.equal(P('空格零').active, false); // ' 0 ' → trim 后视为 0 → 禁用
});

test('任务：加分标签仅保留人员标签池已有，丢弃计数入 message', async () => {
  await saveStaff(createStaff({ id: 'S001', name: '张三', tags: ['组长'] }));
  const r = await importProjects(mkProjectFile([
    ['搬运', '', '', '', '', '早', '', '', '组长;夜班;组长;队长', ''],
  ]));
  const p = P('搬运');
  assert.deepEqual(p.bonusTags, ['组长']); // 池外 '夜班'/'队长' 丢弃，去重
  assert.ok(r.message.includes('丢弃 2 个不存在的加分标签'));
});

test('任务：加分标签列留空/全角分号 → 空/兼容', async () => {
  await saveStaff(createStaff({ id: 'S001', name: '张三', tags: ['组长', '值班'] }));
  await importProjects(mkProjectFile([
    ['A', '', '', '', '', '早', '', '', '', ''],
    ['B', '', '', '', '', '早', '', '', '组长；值班', ''],
  ]));
  assert.deepEqual(P('A').bonusTags, []);
  assert.deepEqual(P('B').bonusTags, ['组长', '值班']);
});

test('任务：空名称行跳过 + 表头不识别文件 → 整表 skip（无报错，报 0）', async () => {
  const r = await importProjects(mkProjectFile([
    ['', '1', '3', '2', '', '早', '', '', '', ''],
    ['   ', '', '', '', '', '', '', '', '', ''],
  ]));
  assert.equal(r.ok, true);
  assert.equal(getCache().projects.length, 0);
  assert.ok(r.message.includes('跳过 2 条空名称'));
  // 表头完全不识别（如选错 Excel）→ 无 name 键 → 全部空名跳过，ok 仍 true
  const wrong = fileFor([['随便', '列'], ['甲', '乙']]);
  const r2 = await importProjects(wrong);
  assert.equal(r2.ok, true);
  assert.equal(getCache().projects.length, 0);
});

// ============ 人员导入 ============

test('人员：模板头基本全字段（中文名引用 / 擅长原因 / 状态别名 / availability）', async () => {
  await saveProject(createProject({ id: 'P101', name: '场地搬运', fatigueScore: 3 }));
  await saveProject(createProject({ id: 'P102', name: '门口执勤', fatigueScore: 1 }));
  await importProjects(mkProjectFile([
    ['标签任务', '', '', '', '', '早', '', '', '组长', ''],
  ])); // 保证标签 '组长' 在人员池
  await saveStaff(createStaff({ id: 'S001', name: '池主', tags: ['组长'] }));
  const r = await importStaffs(mkStaffFile([
    ['张三', '新入', '场地搬运;门口执勤', '场地搬运(体力好,搬运熟练)', '门口执勤(腰伤)', '组长;值班', '不可用', '周一、周三 09:00-12:00;周日 全天', '10', '40', '2', '8'],
    ['李四', '', '场地搬运', '场地搬运(力气大)', '', '', '', '', '', '', '', '0'],
  ]));
  assert.equal(r.ok, true);
  const z = S('张三'), l = S('李四');
  assert.equal(z.status, 'new');
  assert.deepEqual(z.allowedProjects, ['P101']); // 可胜任中的 P102 门口执勤与不合适重叠 → reconcile 剔除（不合适优先）
  assert.deepEqual(z.preferredProjects, [{ projectId: 'P101', reason: '体力好,搬运熟练' }]);
  assert.deepEqual(z.bannedProjects, [{ projectId: 'P102', reason: '腰伤' }]);
  assert.deepEqual(z.tags, ['组长', '值班']);
  assert.deepEqual(z.availability, {
    mode: 'unavailable',
    entries: [{ weekDays: [1, 3], start: '09:00', end: '12:00' }, { weekDays: [0] }],
  });
  assert.equal(z.maxWeeklyFatigue, 10);
  assert.equal(z.maxHeavyTaskCount, 2);
  assert.equal(l.status, 'active'); // 状态空 → 默认活跃
  assert.equal(l.maxMonthlyHeavyCount, 0); // 填 0 = 禁排整月，不被默认吞
  assert.equal(l.maxMonthlyFatigue, 40); // 空 → settings 默认
  assert.ok(r.message.includes('新增 2'));
});

test('人员：擅长/不合适原因空括号 () → 等价纯引用，reason 为空串无影响（往返安全）', async () => {
  await saveProject(createProject({ id: 'P101', name: '场地搬运' }));
  await importStaffs(mkStaffFile([
    ['张三', '', '场地搬运', '场地搬运()', '', '', '', '', '', '', '', ''],
  ]));
  const z = S('张三');
  assert.deepEqual(z.allowedProjects, ['P101']); // 不合适留空 → 可胜任不被剔
  assert.deepEqual(z.preferredProjects, [{ projectId: 'P101', reason: '' }]); // 空括号 () 原因 → reason ''，无脏括号
  assert.deepEqual(z.bannedProjects, []);
  // 导出往返：reason 空 → 不带括号，仍可再导入
  const { staffs, projects } = getCache();
  const aoa = buildStaffsAoa(staffs, projects, getSettings());
  const line = aoa.find(r => r[0] === '张三');
  assert.equal(line[3], '场地搬运');
  const again = await importStaffs(fileFor([STAFF_BASE_COLS, ...aoa.slice(1)], '往返.xlsx'));
  assert.equal(again.ok, true);
  assert.equal(S('张三').preferredProjects.length, 1); // 不因空原因重复堆积
});

test('人员：原因含逗号 / 原因含括号嵌套 → 完整保留，不误切条目', async () => {
  await saveProject(createProject({ id: 'P101', name: '场地搬运' }));
  await importStaffs(mkStaffFile([
    ['张三', '', '场地搬运', '场地搬运(体力好,搬过 3 次);场地搬运(力气大(两次举重))', '', '', '', '', '', '', '', ''],
  ]));
  const z = S('张三');
  assert.deepEqual(z.preferredProjects, [
    { projectId: 'P101', reason: '体力好,搬过 3 次' },
    { projectId: 'P101', reason: '力气大(两次举重)' },
  ]);
  assert.deepEqual(z.bannedProjects, []);
});

test('人员：可胜任填任务中文名 → 解析回 ID；不存在的任务引用丢弃并计数（2026-09-09 对齐加分标签）', async () => {
  await saveProject(createProject({ id: 'P101', name: '场地搬运' }));
  const r = await importStaffs(mkStaffFile([
    ['张三', '', '场地搬运;不存在的任务;P999', '场地搬运(熟手);不存在(原因)', '不存在(原因)', '', '', '', '', '', '', ''],
  ]));
  const z = S('张三');
  assert.deepEqual(z.allowedProjects, ['P101']); // 可胜任两个坏引用被丢弃
  assert.deepEqual(z.preferredProjects, [{ projectId: 'P101', reason: '熟手' }]); // 擅长坏引用被丢弃
  assert.deepEqual(z.bannedProjects, []);
  assert.ok(r.message.includes('丢弃 4 个不存在的任务引用')); // 2 可胜任 + 1 擅长 + 1 不合适
});

test('人员：擅长/不合适填含括号任务名 + 原因 → 正则误拆为前缀被丢弃（不可解，钉现状）', async () => {
  // 任务名本身含括号「门(岗)执勤」：导出侧已回退 ID（见 excel.test.js），但用户手填「门(岗)执勤(原因)」无解
  await saveProject(createProject({ id: 'P102', name: '门(岗)执勤' }));
  await importStaffs(mkStaffFile([
    ['张三', '', '门(岗)执勤', '门(岗)执勤(力气大)', '', '', '', '', '', '', '', ''],
  ]));
  const z = S('张三');
  assert.deepEqual(z.allowedProjects, ['P102']); // 纯引用列 = 全文本 Map 查找 → 安全
  assert.deepEqual(z.preferredProjects, []); // 擅长列被正则拆成 '门' 前缀 → resolve 失败丢弃
});

test('人员：reconcile 三列表收敛（不合适优先）且 message 报修正数', async () => {
  await saveProject(createProject({ id: 'P101', name: '搬运', fatigueScore: 1 }));
  await saveProject(createProject({ id: 'P102', name: '夜巡', fatigueScore: 3 }));
  const r = await importStaffs(mkStaffFile([
    // 擅长=搬运 不在可胜任 → 自动并入；擅长=夜巡 与不合适重叠 → 剔除；可胜任=搬运 与不合适重叠 → 剔除
    ['张三', '', '搬运', '搬运;夜巡', '搬运;夜巡', '', '', '', '', '', '', ''],
  ]));
  const z = S('张三');
  // reconcile：banned={搬运,夜巡} → allowed 的'搬运'剔除；preferred 的'搬运'/'夜巡'均 banned → 全剔（不会把 banned 的擅长反向并入）
  assert.deepEqual(z.allowedProjects, []);
  assert.deepEqual(z.preferredProjects, []);
  assert.ok(r.message.includes('含矛盾配置'));
});

test('人员：状态别名 + 非法状态落默认活跃（2026-09-09 白名单收紧）+ rest 记前态', async () => {
  const r = await importStaffs(mkStaffFile([
    ['甲', '活跃', '', '', '', '', '', '', '', '', '', ''],
    ['乙', '休假', '', '', '', '', '', '', '', '', '', ''],
    ['丙', '已退出', '', '', '', '', '', '', '', '', '', ''],
    ['丁', '不存在的状态', '', '', '', '', '', '', '', '', '', ''],
  ]));
  assert.equal(S('甲').status, 'active');
  const yi = S('乙');
  assert.equal(yi.status, 'rest');
  assert.equal(yi.restFrom, 'active'); // 新增行直接写休假 → 恢复默认回活跃
  assert.equal(S('丙').status, 'left');
  assert.equal(S('丁').status, 'active'); // 白名单外（含大小写/未知文本）→ 默认活跃，不再原样存储
  assert.ok(r.message.includes('1 名状态无法识别已按活跃'));
});

test('人员：上限列空→settings 默认、0 保留、负数越界落默认（2026-09-09 收紧）', async () => {
  saveSettings({ defaultWeeklyFatigue: 10, defaultHeavyTaskCount: 2, defaultMonthlyFatigue: 40, defaultMonthlyHeavyCount: 8 });
  const r = await importStaffs(mkStaffFile([
    ['零限', '', '', '', '', '', '', '', '0', '0', '0', '0'],
    ['非法', '', '', '', '', '', '', '', 'abc', '-5', '3.5', ''],
  ]));
  const l = S('零限'), f = S('非法');
  assert.equal(l.maxWeeklyFatigue, 0); // 显式 0 保留（禁排语义，2026-09-09 确认）
  assert.equal(l.maxHeavyTaskCount, 0);
  assert.equal(l.maxMonthlyHeavyCount, 0);
  assert.equal(f.maxWeeklyFatigue, 10); // 'abc' 非数 → 默认
  assert.equal(f.maxMonthlyFatigue, 40); // '-5' 负数越界 → 落系统默认，不再原样存 -5
  assert.equal(f.maxHeavyTaskCount, 3.5); // 非负小数界内 → 保留
  assert.equal(f.maxMonthlyHeavyCount, 8); // 空 → 默认
  assert.ok(r.message.includes('1 处上限为负已按默认'));
});

test('人员：availability 解析失败 → 整行跳过并在 message 报条数；仅旧列缺字段特判保留', async () => {
  await saveProject(createProject({ id: 'P101', name: '搬运', fatigueScore: 1 }));
  await saveStaff(createStaff({ id: 'S001', name: '旧人', allowedProjects: ['P101'], availability: { mode: 'available', entries: [{ weekDays: [1] }] } }));
  const r = await importStaffs(mkStaffFile([
    ['新好', '', '搬运', '', '', '', '可用', '周一 09:00-12:00', '', '', '', ''],
    ['新坏', '', '搬运', '', '', '', '可用', '', '', '', '', ''],        // 有模式无段
    ['新坏2', '', '搬运', '', '', '', '', '周一 09:00-12:00', '', '', '', ''], // 有段无模式
    ['新坏3', '', '搬运', '', '', '', '可用', '周日 24:00-25:00', '', '', '', ''], // 跨日/非法
    ['新坏4', '', '搬运', '', '', '', '限制', '周一 09:00-12:00', '', '', '', ''], // 模式非法
  ]));
  assert.equal(r.ok, true);
  assert.equal(S('新好').availability.mode, 'available');
  assert.equal(S('新坏'), undefined); // 整行跳过
  assert.equal(S('新坏2'), undefined);
  assert.equal(S('新坏3'), undefined);
  assert.equal(S('新坏4'), undefined);
  assert.ok(r.message.includes('跳过 4 条时间安排配置错误'));
  assert.equal(getCache().staffs.length, 2); // 新好 + 旧人

  // 旧文件缺两列（表头无每周时间模式/时间段）→ 更新保留既有配置
  const oldNoAvail = fileFor([
    ['姓名(必填)', '状态(新入/活跃/休假/已退出,默认活跃)', '可胜任任务(分号隔开)', '擅长任务(任务(原因),分号隔开)', '不合适任务(任务(原因),分号隔开)',
     '标签(分号隔开,可多个)', '周疲劳上限', '月疲劳上限', '周高强度次数上限', '月高强度次数上限'],
    ['旧人', '', '搬运', '', '', '新标签', '', '', '', ''],
  ], '旧无时间列.xlsx');
  await importStaffs(oldNoAvail);
  const j = S('旧人');
  assert.deepEqual(j.availability, { mode: 'available', entries: [{ weekDays: [1] }] }); // 缺列 → 保留旧配置
  assert.deepEqual(j.tags, ['新标签']); // 其他列照常覆盖
});

test('人员：同名/同 ID 更新保留 id + joinedAt；文件内多行同名后者覆盖', async () => {
  await saveStaff(createStaff({ id: 'S-KEEP', name: '老人', joinedAt: 111, maxWeeklyFatigue: 9 }));
  const r = await importStaffs(mkStaffFile([
    ['老人', '休假', '', '', '', '', '', '', '3', '', '', ''],
    ['老人', '', '', '', '', '', '', '', '', '', '', ''],
  ]));
  const j = S('老人');
  assert.equal(j.id, 'S-KEEP');
  assert.equal(j.joinedAt, 111); // joinedAt 保留（前端排序锚）
  assert.equal(j.status, 'active'); // 第二行赢
  assert.equal(j.maxWeeklyFatigue, 10); // 第二行留空 → settings 默认覆盖（非合并）
  assert.equal(getCache().staffs.length, 1);
});

test('人员：标签列全角分号 / 空名称行 / 示例行跳过', async () => {
  const r = await importStaffs(mkStaffFile([
    ['【示例】张三', '', '场地搬运;门口执勤', '场地搬运(体力好,搬运熟练)', '夜间巡逻(腰伤)', '组长;值班', '', '', '', '', '', ''],
    ['李四', '', '', '', '', '组长；值班', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', ''],
  ]));
  assert.equal(getCache().staffs.length, 1);
  assert.deepEqual(S('李四').tags, ['组长', '值班']); // 全角分号兼容
  assert.ok(r.message.includes('跳过 1 条空姓名'));
});

test('人员：导出文件（简洁表头+中文名+无ID）整文件重导入 → 逐字段保留，不增员', async () => {
  await saveProject(createProject({ id: 'P101', name: '场地搬运', fatigueScore: 3 }));
  await saveProject(createProject({ id: 'P102', name: '门口执勤', fatigueScore: 1 }));
  await saveStaff(createStaff({
    id: 'S001', name: '张三', status: 'active', joinedAt: 222,
    allowedProjects: ['P101', 'P102'],
    preferredProjects: [{ projectId: 'P101', reason: '体力好' }],
    bannedProjects: [],
    maxWeeklyFatigue: 12, maxHeavyTaskCount: 3, tags: ['组长'],
    availability: { mode: 'unavailable', entries: [{ weekDays: [1, 3], start: '09:00', end: '12:00' }] },
  }));
  // 导出 → 改张三某字段 → 重导入 → 该字段被覆盖、其余引用保真
  const settings = getSettings();
  const aoa = buildStaffsAoa(getCache().staffs, getCache().projects, settings);
  const row = aoa.find(r => r[0] === '张三');
  row[1] = '休假'; // 导出文件里手动改状态
  const r = await importStaffs(fileFor([...aoa], '重导入.xlsx'));
  assert.equal(r.ok, true);
  assert.equal(getCache().staffs.length, 1); // 更新不新增
  const z = S('张三');
  assert.equal(z.status, 'rest');
  assert.equal(z.restFrom, 'active');
  assert.deepEqual(z.allowedProjects, ['P101', 'P102']);
  assert.deepEqual(z.preferredProjects, [{ projectId: 'P101', reason: '体力好' }]);
  assert.equal(z.maxWeeklyFatigue, 12);
  assert.equal(z.joinedAt, 222);
  assert.deepEqual(z.availability.entries, [{ weekDays: [1, 3], start: '09:00', end: '12:00' }]);
});

test('任务：timeRange 单边/倒挂/非法时间 → 静默 null（宽容），合法保留', async () => {
  await importProjects(mkProjectFile([
    ['A', '', '', '', '', '早', '08:00', '', '', ''], // 有开始无结束
    ['B', '', '', '', '', '早', '18:00', '08:00', '', ''], // 结束早于开始（倒挂）
    ['C', '', '', '', '', '早', '9x:00', '10:00', '', ''], // 非法时间
    ['D', '', '', '', '', '早', '08:00', '12:00', '', ''], // 合法
  ]));
  assert.equal(P('A').timeRange, null);
  assert.equal(P('B').timeRange, null);
  assert.equal(P('C').timeRange, null);
  assert.deepEqual(P('D').timeRange, { start: '08:00', end: '12:00' });
});

test('任务：.xls 旧格式（BIFF8）导入链路同 .xlsx（UI 支持 .xlsx / .xls）', async () => {
  const r = await importProjects(fileFor(
    [PROJECT_BASE_COLS, ['巡逻站岗', '1', '3', '2', '7', '早;中', '09:00', '12:00', '', '夜间值勤'],
     ['花草浇水', '', '', '', '', '早', '', '', '', '']],
    '旧格式.xls', 'Sheet1', 'xls',
  ));
  assert.equal(r.ok, true);
  const z = P('巡逻站岗'), c = P('花草浇水');
  assert.equal(z.fatigueScore, 3);
  assert.equal(z.requiredCapacity, 2);
  assert.deepEqual(z.weekDays, [0]); // '7' → 周日(0)
  assert.deepEqual(z.slots.map(s => s.label), ['早', '中']);
  assert.deepEqual(z.timeRange, { start: '09:00', end: '12:00' });
  assert.equal(z.description, '夜间值勤');
  assert.equal(c.active, true); // 启用列空 → 默认启用
  assert.ok(r.message.includes('新增 2'));
});

test('人员：休假 restFrom —— 新增行默认回活跃；new/active 更新成休假保留原前态（2026-09-09 收紧）', async () => {
  await importStaffs(mkStaffFile([
    ['纯新人', '新入', '', '', '', '', '', '', '', '', '', ''],
    ['新人转休', '休假', '', '', '', '', '', '', '', '', '', ''],
  ]));
  assert.equal(S('纯新人').status, 'new');
  assert.equal(S('纯新人').restFrom, null);
  assert.equal(S('新人转休').restFrom, 'active'); // 无既有前态 → 恢复默认回活跃
  // 已在库为 new 的人被文件改成休假 → 保留 new 前态（恢复仍回新人，不再升档活跃）
  await importStaffs(mkStaffFile([['纯新人', '休假', '', '', '', '', '', '', '', '', '', '']]));
  const n = S('纯新人');
  assert.equal(n.status, 'rest');
  assert.equal(n.restFrom, 'new');
});

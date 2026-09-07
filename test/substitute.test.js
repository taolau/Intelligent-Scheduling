import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, recommendSubstitutes, narrateReasons } from '../src/core/substitute.js';
import { createStaff, createProject } from '../src/data/model.js';

const P101 = createProject({ id: 'P101', name: '搬运', fatigueScore: 2, slots: [{ label: '上午', startTime: '08:00', endTime: '12:00' }] });
const projectById = { P101 };

const schedule = { date: '2026-08-24', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] };
const TODAY = '2026-08-30'; // 固定 today 使窗口断言不随运行日期漂移

test('buildContext 三轨计数：窗口积分/周累计/月累计/团队平均', () => {
  const staffs = [
    createStaff({ id: 'S1', name: '张三' }),
    createStaff({ id: 'S2', name: '李四' }),
  ];
  const schedules = [
    { date: '2026-08-24', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // S1 +2
    { date: '2026-08-25', projectId: 'P101', slotLabel: '上午', staffIds: ['S1', 'S2'] }, // S1+2 S2+2
  ];
  const ctx = buildContext(staffs, schedules, projectById, undefined, TODAY);
  assert.equal(ctx.fatigueWindow.get('S1'), 4); // 8/24~8/25 同在窗口与自然周
  assert.equal(ctx.fatigueWindow.get('S2'), 2);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-08-24'), 4); // 同周（8/24 起）
  assert.equal(ctx.heavyByWeek.has('S1|2026-08-24'), false); // P101 疲劳 2 非高强度
  assert.equal(ctx.fatigueByMonth.get('S1|2026-08'), 4);
  assert.equal(ctx.teamAvg, 3);
  assert.equal(ctx.fatigueCutoff, '2026-08-01'); // 8/30 回看 30 天（含 8/30）
});

test('buildContext 窗口滑出：窗口外班次不进均衡轨、但进周/月轨', () => {
  const staffs = [createStaff({ id: 'S1', name: '张三' })];
  const schedules = [
    { date: '2026-04-01', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // 窗口外（cutoff 6/2）
  ];
  const ctx = buildContext(staffs, schedules, projectById, undefined, TODAY);
  assert.equal(ctx.fatigueWindow.has('S1'), false);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-03-30'), 2); // 4/1 周三属 3/30 起自然周
  assert.equal(ctx.fatigueByMonth.get('S1|2026-04'), 2);
  assert.equal(ctx.teamAvg, 0); // 全员窗口积分 0
});

test('buildContext 未来已分配班次计入窗口（计划即负荷）', () => {
  const staffs = [createStaff({ id: 'S1', name: '张三' })];
  const schedules = [
    { date: '2026-10-01', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // 未来预排
  ];
  const ctx = buildContext(staffs, schedules, projectById, undefined, TODAY);
  assert.equal(ctx.fatigueWindow.get('S1'), 2);
});

test('buildContext 跨月自然周：周键同属 8/31 起、月键分离', () => {
  const staffs = [createStaff({ id: 'S1', name: '张三' })];
  const schedules = [
    { date: '2026-08-31', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // 8 月周一
    { date: '2026-09-01', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // 9 月周二，同周
  ];
  const ctx = buildContext(staffs, schedules, projectById, undefined, TODAY);
  assert.equal(ctx.fatigueByWeek.get('S1|2026-08-31'), 4); // 两班同周键
  assert.equal(ctx.fatigueByMonth.get('S1|2026-08'), 2);
  assert.equal(ctx.fatigueByMonth.get('S1|2026-09'), 2);
  assert.equal(ctx.fatigueWindow.get('S1'), 4);
});

test('buildContext balanceWindowDays 自定义窗口边界（含当天）', () => {
  const staffs = [createStaff({ id: 'S1', name: '张三' })];
  const schedules = [
    { date: '2026-08-23', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // cutoff 前 1 天
    { date: '2026-08-24', projectId: 'P101', slotLabel: '上午', staffIds: ['S1'] }, // cutoff 当天
  ];
  const ctx = buildContext(staffs, schedules, projectById, { balanceWindowDays: 7 }, TODAY);
  assert.equal(ctx.fatigueCutoff, '2026-08-24');
  assert.equal(ctx.fatigueWindow.get('S1'), 2); // 仅 8/24 计入
  assert.equal(ctx.fatigueByWeek.get('S1|2026-08-17'), 2); // 8/23 周轨仍留档
});

test('recommendSubstitutes: 返回 Top3 降序, 排除被替换人与当前人员', () => {
  const staffs = [
    createStaff({ id: 'S1', name: '被替换人' }),
    createStaff({ id: 'S2', name: '张三', allowedProjects: ['P101'], preferredProjects: [{ projectId: 'P101', reason: '熟练' }] }),
    createStaff({ id: 'S3', name: '李四', allowedProjects: ['P101'] }),
    createStaff({ id: 'S4', name: '王五', allowedProjects: ['P101'] }),
  ];
  const ctx = buildContext(staffs, [schedule], projectById, undefined, TODAY);
  const result = recommendSubstitutes(staffs, schedule, projectById, ctx, 'S1');
  assert.equal(result.length, 3);
  // 张三擅长加分最高，应排第一
  assert.equal(result[0].staff.id, 'S2');
  assert.ok(result.every(r => r.staff.id !== 'S1'));
  assert.ok(result.every(r => r.reasons.length > 0));
  // 理由人话化：首位（擅长者）副行 = 判断句「擅长搬运：熟练」+ 均衡带窗口天数（无「加分(N)/本人X/平均Y」黑话）
  assert.equal(result[0].reasons[0], '擅长搬运：熟练');
  assert.ok(result[0].reasons.some(r => r.includes('近 30 天排班较少')));
});

test('recommendSubstitutes: 无人可用时返回空', () => {
  const staffs = [createStaff({ id: 'S1', name: '被替换人' })];
  const ctx = buildContext(staffs, [schedule], projectById, undefined, TODAY);
  const result = recommendSubstitutes(staffs, schedule, projectById, ctx, 'S1');
  assert.equal(result.length, 0);
});

// —— 理由人话化（narrateReasons）分支 ——
const P101Narrate = { P101: { id: 'P101', name: '搬运' } };
const schNarrate = { date: '2026-08-24', projectId: 'P101', slotLabel: '上午' };

test('narrateReasons: 擅长命中带原因 + 窗口偏少给带时间范围的建议句', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate, [
    { label: '擅长加分', points: 15, reason: '体力好' },
    { label: '均衡加分', points: 25, reason: '旧黑话' },
  ], { fatigueWindow: new Map([['S9', 0]]), teamAvg: 5 });
  assert.deepEqual(lines, ['擅长搬运：体力好', '近 30 天排班较少，建议优先']);
});

test('narrateReasons: 均衡齐平（本人≈平均）不给行，无擅长则副行为空', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate,
    [{ label: '均衡加分', points: 0, reason: '旧黑话' }], { fatigueWindow: new Map([['S9', 5]]), teamAvg: 5 });
  assert.equal(lines.length, 0);
});

test('narrateReasons: 窗口偏多给中性句', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate,
    [{ label: '均衡加分', points: -15, reason: '旧黑话' }], { fatigueWindow: new Map([['S9', 8]]), teamAvg: 5 });
  assert.deepEqual(lines, ['近 30 天排班较多']);
});

test('narrateReasons: 时间范围用公平窗口实际天数（可配置 balanceWindowDays）', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate,
    [{ label: '均衡加分', points: 2, reason: '旧黑话' }],
    { fatigueWindow: new Map([['S9', 0]]), teamAvg: 5, settings: { balanceWindowDays: 30 } });
  assert.deepEqual(lines, ['近 30 天排班较少，建议优先']);
});

test('narrateReasons: 新入不产生均衡驱动句（算法均衡恒 0，界面不诱导用新人）', () => {
  const staff = { id: 'S9', status: 'new' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate,
    [{ label: '均衡加分', points: 0, reason: '旧黑话' }], { fatigueWindow: new Map([['S9', 0]]), teamAvg: 5 });
  assert.equal(lines.length, 0);
});

test('narrateReasons: 擅长无录入原因仅句头；均衡句不带裸数字（本人/平均）', () => {
  const staff = { id: 'S9', status: 'active' };
  const lines = narrateReasons(staff, schNarrate, P101Narrate,
    [{ label: '擅长加分', points: 15, reason: '' }, { label: '均衡加分', points: 2, reason: '旧黑话' }],
    { fatigueWindow: new Map([['S9', 0]]), teamAvg: 0.5 });
  assert.deepEqual(lines, ['擅长搬运', '近 30 天排班较少，建议优先']);
});

test('recommendSubstitutes: 返回全部通过者不截断（推荐前 3 / 其他可选分档是弹窗职责）', () => {
  const staffs = [
    createStaff({ id: 'S1', name: '被替换人', allowedProjects: ['P101'] }),
    createStaff({ id: 'S2', name: '甲', allowedProjects: ['P101'], preferredProjects: [{ projectId: 'P101', reason: 'x' }] }),
    createStaff({ id: 'S3', name: '乙', allowedProjects: ['P101'] }),
    createStaff({ id: 'S4', name: '丙', allowedProjects: ['P101'] }),
    createStaff({ id: 'S5', name: '丁', allowedProjects: ['P101'] }),
  ];
  const ctx = buildContext(staffs, [schedule], projectById, undefined, TODAY);
  const result = recommendSubstitutes(staffs, schedule, projectById, ctx, 'S1');
  assert.equal(result.length, 4); // 超过 3 也全量返回，供界面切成「推荐前3 + 其他」
  assert.ok(result.every((r, i) => i === 0 || result[i - 1].score >= r.score)); // 保持降序
});

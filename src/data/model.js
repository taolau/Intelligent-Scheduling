export const SLOT_LABELS = ['自主安排', '早', '中', '晚'];
export const STAFF_STATUSES = ['new', 'active', 'rest', 'left'];
export const FATIGUE_MAX = 3;
// 数量上限 + 预警阈值：去时间后替代时间冲突，可在配置页「设置」弹窗修改
export const DEFAULT_SETTINGS = { dailyTaskLimit: 2, slotTaskLimit: 1, warnDailyCount: 2, preferredBonus: 15, balanceFactor: 5 };

export function createProject(fields = {}) {
  return {
    id: fields.id ?? crypto.randomUUID(),
    name: fields.name ?? '',
    fatigueScore: fields.fatigueScore ?? 1,
    requiredCapacity: fields.requiredCapacity ?? 1,
    weekDays: fields.weekDays ?? [],
    slots: fields.slots ?? [{ label: SLOT_LABELS[0] }], // 新任务默认一个「自主安排」时段
    description: fields.description ?? '', // 任务说明（选填，仅展示）
    active: fields.active ?? true,
    timeRange: fields.timeRange ?? null, // 选填执行窗口 {start,end} HH:mm，仅展示不参与算法
  };
}

export function createStaff(fields = {}) {
  return {
    id: fields.id ?? crypto.randomUUID(),
    name: fields.name ?? '',
    allowedProjects: fields.allowedProjects ?? [],
    preferredProjects: fields.preferredProjects ?? [], // [{projectId, reason}]
    bannedProjects: fields.bannedProjects ?? [],       // [{projectId, reason}]
    maxWeeklyFatigue: fields.maxWeeklyFatigue ?? 6,
    maxHeavyTaskCount: fields.maxHeavyTaskCount ?? 1,
    status: fields.status ?? 'active',
    joinedAt: fields.joinedAt ?? Date.now(),   // 加入时间戳，卡片排序用
    restFrom: fields.restFrom ?? null,         // 休假前状态（'new'|'active'），开关恢复用
  };
}

export function createSchedule(fields = {}) {
  return {
    id: fields.id ?? crypto.randomUUID(),
    date: fields.date ?? '',
    projectId: fields.projectId ?? '',
    slotLabel: fields.slotLabel ?? '',
    staffIds: fields.staffIds ?? [],
  };
}

function problems(checks) {
  return checks.filter(c => c.cond).map(c => ({ field: c.field, msg: c.msg }));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function isValidTimeRange(tr) {
  return !!tr && HHMM.test(tr.start) && HHMM.test(tr.end) && tr.start < tr.end;
}

export function validateProject(p) {
  const errors = problems([
    { cond: !p.name, field: 'name', msg: '任务名不能为空' },
    { cond: p.fatigueScore < 1 || p.fatigueScore > FATIGUE_MAX, field: 'fatigueScore', msg: '劳累指数必须为 1-3' },
    { cond: p.requiredCapacity < 1, field: 'requiredCapacity', msg: '所需人数必须 >= 1' },
    { cond: p.weekDays.some(d => d < 0 || d > 6), field: 'weekDays', msg: '重复星期必须为 0-6' },
    { cond: p.slots.length === 0, field: 'slots', msg: '至少配置一个时段' },
    { cond: p.slots.some(s => !SLOT_LABELS.includes(s.label)), field: 'slots', msg: '时段标签必须在预置集合内' },
    { cond: p.timeRange != null && !isValidTimeRange(p.timeRange), field: 'timeRange', msg: '时间段范围需为 HH:mm 且结束晚于开始' },
  ]);
  return { valid: errors.length === 0, errors };
}

export function validateStaff(s) {
  const errors = problems([
    { cond: !s.name, field: 'name', msg: '姓名不能为空' },
    { cond: !STAFF_STATUSES.includes(s.status), field: 'status', msg: '状态必须为 new/active/rest/left' },
    { cond: s.status === 'rest' && !['new', 'active'].includes(s.restFrom), field: 'status', msg: '休假状态需记录休假前状态（new/active）' },
    { cond: s.maxWeeklyFatigue < 1, field: 'maxWeeklyFatigue', msg: '周疲劳上限必须 >= 1' },
    { cond: s.maxHeavyTaskCount < 0, field: 'maxHeavyTaskCount', msg: '高强度次数上限必须 >= 0' },
    { cond: s.bannedProjects.some(b => !b.projectId), field: 'bannedProjects', msg: '不合适项目必须包含 projectId' },
    { cond: s.preferredProjects.some(p => !p.projectId), field: 'preferredProjects', msg: '擅长项目必须包含 projectId' },
  ]);
  return { valid: errors.length === 0, errors };
}

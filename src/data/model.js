export const SLOT_LABELS = ['上午', '中午', '下午', '晚上'];
export const STAFF_STATUSES = ['new', 'active', 'left'];
export const FATIGUE_MAX = 3;
export const DEFAULT_TIMES = { 上午: '08:00-12:00', 中午: '11:30-13:00', 下午: '13:00-17:00', 晚上: '17:00-21:00' };

export function fillSlotTimes(slots) {
  return slots.map(s => {
    const def = (DEFAULT_TIMES[s.label] ?? '').split('-');
    return { ...s, startTime: s.startTime || def[0] || '', endTime: s.endTime || def[1] || '' };
  });
}

export function createProject(fields = {}) {
  return {
    id: fields.id ?? crypto.randomUUID(),
    name: fields.name ?? '',
    fatigueScore: fields.fatigueScore ?? 1,
    requiredCapacity: fields.requiredCapacity ?? 1,
    weekDays: fields.weekDays ?? [],
    slots: fields.slots ?? [],
    active: fields.active ?? true,
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

export function createLeave(fields = {}) {
  return {
    id: fields.id ?? crypto.randomUUID(),
    staffId: fields.staffId ?? '',
    date: fields.date ?? '',
    reason: fields.reason ?? '',
  };
}

function problems(checks) {
  return checks.filter(c => c.cond).map(c => ({ field: c.field, msg: c.msg }));
}

export function validateProject(p) {
  const errors = problems([
    { cond: !p.name, field: 'name', msg: '任务名不能为空' },
    { cond: p.fatigueScore < 1 || p.fatigueScore > FATIGUE_MAX, field: 'fatigueScore', msg: '劳累指数必须为 1-3' },
    { cond: p.requiredCapacity < 1, field: 'requiredCapacity', msg: '所需人数必须 >= 1' },
    { cond: p.weekDays.some(d => d < 0 || d > 6), field: 'weekDays', msg: '重复星期必须为 0-6' },
    { cond: p.slots.some(s => !SLOT_LABELS.includes(s.label)), field: 'slots', msg: '时段标签必须在预置集合内' },
  ]);
  return { valid: errors.length === 0, errors };
}

export function validateStaff(s) {
  const errors = problems([
    { cond: !s.name, field: 'name', msg: '姓名不能为空' },
    { cond: !STAFF_STATUSES.includes(s.status), field: 'status', msg: '状态必须为 new/active/left' },
    { cond: s.maxWeeklyFatigue < 1, field: 'maxWeeklyFatigue', msg: '周疲劳上限必须 >= 1' },
    { cond: s.maxHeavyTaskCount < 0, field: 'maxHeavyTaskCount', msg: '高强度次数上限必须 >= 0' },
    { cond: s.bannedProjects.some(b => !b.projectId), field: 'bannedProjects', msg: '不合适项目必须包含 projectId' },
    { cond: s.preferredProjects.some(p => !p.projectId), field: 'preferredProjects', msg: '擅长项目必须包含 projectId' },
  ]);
  return { valid: errors.length === 0, errors };
}

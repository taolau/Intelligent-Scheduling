export const SLOT_LABELS = ['自主安排', '早', '中', '晚'];
export const STAFF_STATUSES = ['new', 'active', 'rest', 'left'];
export const FATIGUE_MAX = 3;
// 数量上限 + 预警阈值 + 评分系数 + 新人员默认上限：可在数据配置页「系统设置」修改（改动对已保存数据即时生效；新人员默认仅作用于新建）
export const DEFAULT_SETTINGS = {
  dailyTaskLimit: 2, slotTaskLimit: 1, warnDailyCount: 1, preferredBonus: 15, tagBonus: 15, balanceFactor: 5,
  balanceWindowDays: 30, defaultWeeklyFatigue: 10, defaultHeavyTaskCount: 2,
  defaultMonthlyFatigue: 40, defaultMonthlyHeavyCount: 8, tenureLimit: 3,
};

// 月疲劳上限取值：已显式配置用逐人值；未配置（存量/Excel 缺省）跟随当前系统默认
export function monthlyFatigueLimitOf(staff, settings = DEFAULT_SETTINGS) {
  return staff.maxMonthlyFatigue ?? settings?.defaultMonthlyFatigue ?? DEFAULT_SETTINGS.defaultMonthlyFatigue;
}

// 月高强度（劳累 3）次数上限取值：同上；0 = 禁排高强度整个自然月
export function monthlyHeavyLimitOf(staff, settings = DEFAULT_SETTINGS) {
  return staff.maxMonthlyHeavyCount ?? settings?.defaultMonthlyHeavyCount ?? DEFAULT_SETTINGS.defaultMonthlyHeavyCount;
}

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
    bonusTags: fields.bonusTags ?? [],   // 加分标签（引用人员标签池文本，命中即加分）
  };
}

export function createStaff(fields = {}, defaults = {}) {
  return {
    id: fields.id ?? crypto.randomUUID(),
    name: fields.name ?? '',
    allowedProjects: fields.allowedProjects ?? [],
    preferredProjects: fields.preferredProjects ?? [], // [{projectId, reason}]
    bannedProjects: fields.bannedProjects ?? [],       // [{projectId, reason}]
    maxWeeklyFatigue: fields.maxWeeklyFatigue ?? defaults.maxWeeklyFatigue ?? DEFAULT_SETTINGS.defaultWeeklyFatigue,
    maxHeavyTaskCount: fields.maxHeavyTaskCount ?? defaults.maxHeavyTaskCount ?? DEFAULT_SETTINGS.defaultHeavyTaskCount,
    maxMonthlyFatigue: fields.maxMonthlyFatigue ?? defaults.maxMonthlyFatigue ?? DEFAULT_SETTINGS.defaultMonthlyFatigue,
    maxMonthlyHeavyCount: fields.maxMonthlyHeavyCount ?? defaults.maxMonthlyHeavyCount ?? DEFAULT_SETTINGS.defaultMonthlyHeavyCount,
    status: fields.status ?? 'active',
    joinedAt: fields.joinedAt ?? Date.now(),   // 加入时间戳，卡片排序用
    restFrom: fields.restFrom ?? null,         // 休假前状态（'new'|'active'），开关恢复用
    tags: fields.tags ?? [],                   // 自由文本标签（String[]，多人管理/筛选用）
    availability: fields.availability ?? null, // 每周时间安排（null=不限制）
  };
}

// 标签文本 → 数组：按 ; 或中文；分隔（Excel 列/粘贴串共用），trim + 去空 + 去重（保序）
export function parseTags(text) {
  if (!text) return [];
  return [...new Set(String(text).split(/[;；]/).map(t => t.trim()).filter(Boolean))];
}

// 标签数组 → 文本（Excel 列/导出共用）；单标签含 ; 会破坏分隔，展开为多个
export function formatTags(tags) {
  return (tags ?? []).map(t => String(t).trim()).filter(Boolean).join(';');
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

export function availabilityProblem(availability) {
  if (availability == null) return '';
  if (typeof availability !== 'object' || Array.isArray(availability)) return '每周时间安排格式不正确';
  if (!['available', 'unavailable'].includes(availability.mode)) return '每周时间安排只能选择可用或不可用';
  if (!Array.isArray(availability.entries) || availability.entries.length === 0) return '每周时间安排请至少添加一个时间段';
  for (let i = 0; i < availability.entries.length; i++) {
    const entry = availability.entries[i] ?? {};
    const days = entry.weekDays;
    const row = i + 1;
    if (!Array.isArray(days) || days.length === 0) return `第 ${row} 条请选择星期`;
    if (new Set(days).size !== days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) return `第 ${row} 条星期不正确`;
    const hasStart = entry.start != null && entry.start !== '';
    const hasEnd = entry.end != null && entry.end !== '';
    // 起止要么同时填（合法区间，禁跨日），要么都不填（= 整天）；单边填视为配置不完整
    if (hasStart || hasEnd) {
      if (!isValidTimeRange(entry)) return `第 ${row} 条时间需同时填写开始与结束，且结束晚于开始（不支持跨日；都留空 = 整天）`;
    }
  }
  return '';
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

/**
 * 三列表关系收敛（黑名单优先，与 filter 拒绝顺序一致）：
 * ① 可胜任 ∩ 不合适 = ∅：与不合适重叠的可胜任项剔除；
 * ② 擅长 ⊆ 可胜任：擅长项不在可胜任时自动并入可胜任（擅长必可做）；
 *    擅长与不合适重叠属不可解矛盾，该擅长条目剔除。
 * 返回收敛后的两个列表 + changed 标志；不合适列表原样保留。
 */
export function reconcileStaff(s) {
  const banned = new Set(s.bannedProjects.map(b => b.projectId));
  const merged = [...s.allowedProjects, ...s.preferredProjects.map(p => p.projectId)]
    .filter(id => id && !banned.has(id));
  const allowedProjects = [...new Set(merged)];
  const preferredProjects = s.preferredProjects.filter(p => !banned.has(p.projectId));
  return {
    allowedProjects,
    preferredProjects,
    changed: allowedProjects.length !== s.allowedProjects.length || preferredProjects.length !== s.preferredProjects.length,
  };
}

export function validateStaff(s) {
  const errors = problems([
    { cond: !s.name, field: 'name', msg: '姓名不能为空' },
    { cond: !STAFF_STATUSES.includes(s.status), field: 'status', msg: '状态必须为 new/active/rest/left' },
    { cond: s.status === 'rest' && !['new', 'active'].includes(s.restFrom), field: 'status', msg: '休假状态需记录休假前状态（new/active）' },
    { cond: s.maxWeeklyFatigue < 1, field: 'maxWeeklyFatigue', msg: '周疲劳上限必须 >= 1' },
    { cond: s.maxHeavyTaskCount < 0, field: 'maxHeavyTaskCount', msg: '高强度次数上限必须 >= 0' },
    { cond: s.maxMonthlyFatigue < 1, field: 'maxMonthlyFatigue', msg: '月疲劳上限必须 >= 1' },
    { cond: s.maxMonthlyHeavyCount < 0, field: 'maxMonthlyHeavyCount', msg: '月高强度次数上限必须 >= 0' },
    { cond: s.bannedProjects.some(b => !b.projectId), field: 'bannedProjects', msg: '不合适任务不能为空' },
    { cond: s.preferredProjects.some(p => !p.projectId), field: 'preferredProjects', msg: '擅长任务不能为空' },
    { cond: s.allowedProjects.some(id => s.bannedProjects.some(b => b.projectId === id)), field: 'allowedProjects', msg: '同一任务不能同时在可胜任与不合适中' },
    { cond: s.preferredProjects.some(p => !s.allowedProjects.includes(p.projectId)), field: 'preferredProjects', msg: '擅长任务必须同时是可胜任任务' },
    { cond: !!availabilityProblem(s.availability), field: 'availability', msg: availabilityProblem(s.availability) },
  ]);
  return { valid: errors.length === 0, errors };
}

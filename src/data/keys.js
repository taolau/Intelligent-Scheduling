// localStorage key 集中登记处（单一真源）：新增 key 必须在此定义并同步 docs/storage.md，
// 业务代码禁止手写 is_sched: 字符串。命名一律 is_sched: 前缀，DevTools 按前缀过滤即得全量。
// 清理语义：resetAll 只清 STORES 业务三表；settings 与 UI 状态跨重置保留、不进 JSON 备份。
export const STORES = ['projects', 'staffs', 'schedules'];

export const KEYS = {
  projects: 'is_sched:projects',
  staffs: 'is_sched:staffs',
  schedules: 'is_sched:schedules',
  settings: 'is_sched:settings',
  calView: 'is_sched:cal_view',
  configTab: 'is_sched:config_tab',
  sidebar: 'is_sched:sidebar',
};

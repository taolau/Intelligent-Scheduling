// localStorage key 集中登记处（单一真源）：新增 key 必须在此定义并同步 docs/storage.md，
// 业务代码禁止手写 is_sched: 字符串。命名一律 is_sched: 前缀，DevTools 按前缀过滤即得全量。
// 业务数据 = STORES 三数组表 + settings 单例（settings 非数组，不进 db Map，store 层直读写）：
// resetAll 清三表 + settings；export/importJSON 含三表 + settings。UI 状态（cal_view/cal_scale/config_tab/sidebar）属本机偏好，跨重置保留、不进备份。
export const STORES = ['projects', 'staffs', 'schedules'];

export const KEYS = {
  projects: 'is_sched:projects',
  staffs: 'is_sched:staffs',
  schedules: 'is_sched:schedules',
  settings: 'is_sched:settings',
  calView: 'is_sched:cal_view',
  calScale: 'is_sched:cal_scale', // 排班视图粒度 'week' | 'month'
  configTab: 'is_sched:config_tab',
  sidebar: 'is_sched:sidebar',
};

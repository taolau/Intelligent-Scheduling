# localStorage 存储说明（key 即库表）

> 本文档 = 浏览器 localStorage key 全量登记表。最后更新：2026-09-02
> **新增 key 的唯一入口**：在 `src/data/keys.js` 定义常量 + 在本表登记，业务代码禁止手写 `is_sched:` 字符串。

## key 全量表

| key | 类别 | 内容与格式 | 读写处 | 重置(resetAll) | JSON 备份 |
|-----|------|-----------|--------|:---:|:---:|
| `is_sched:projects` | 业务表 | 任务数组 `Project[]`（JSON，结构见 spec 3.1） | db.js（经 store.saveProject 等门面） | 清除 | 导出/导入 |
| `is_sched:staffs` | 业务表 | 人员数组 `Staff[]`（spec 3.2） | 同上 | 清除 | 导出/导入 |
| `is_sched:schedules` | 业务表 | 班次数组 `Schedule[]`（spec 3.4） | 同上 | 清除 | 导出/导入 |
| `is_sched:settings` | 业务参数 | 全局参数对象（`dailyTaskLimit`/`slotTaskLimit`/`warnDailyCount` 等，读取时与 `DEFAULT_SETTINGS` 合并） | store.getSettings / saveSettings | 保留 | 不进备份 |
| `is_sched:cal_view` | UI 状态 | `{mode:"overview"\|"project"\|"staff", id?}` 周历维度切换记忆 | calendar.js | 保留 | 不进备份 |
| `is_sched:cal_scale` | UI 状态 | `"week"` / `"month"` 排班视图粒度记忆（菜单进入清除回 week） | calendar.js | 保留 | 不进备份 |
| `is_sched:config_tab` | UI 状态 | `"staff"` / `"project"` / `"settings"` 配置页 tab 记忆 | config.js | 保留 | 不进备份 |
| `is_sched:sidebar` | UI 状态 | `"1"` 收缩 / `"0"` 展开侧边栏 | main.js | 保留 | 不进备份 |

## 维护规则

1. **单一真源**：全部 key 常量集中在 `src/data/keys.js`（`KEYS` 对象 + `STORES` 业务表名数组）；业务代码只 import 常量，禁止手写字符串。db 层按 `KEYS[storeName]` 查表读写——未在 keys.js 登记的表名取到 undefined，天然报错拦截。
2. **命名**：一律 `is_sched:` 前缀 + 小写下划线；DevTools → Application → Local Storage 按前缀过滤即得全量。
3. **重置语义**：`resetAll`（db.clearAll）只清业务三表——重置业务数据时保留参数与界面偏好，属有意设计。
4. **备份语义**：JSON 备份/恢复仅含三核心表；settings 与 UI 状态是本机偏好，不随备份迁移。
5. **缓存铁律**：业务三表经 db.js 内存 Map 索引 + store.js 增量缓存（cache 唯一真源）；直接在 DevTools 改 localStorage 与内存 Map 失同步，需刷新页面。

## 变更记录

- 2026-09-03：新增 `cal_scale`（排班视图周/月粒度记忆）。
- 2026-09-02：`config_tab` 值域扩为 `"staff"` / `"project"` / `"settings"`（设置由弹窗改为第三 tab「系统设置」）。
- 2026-09-01：建立 key 集中登记机制（`src/data/keys.js` + 本文档）。侧边栏 key 由 `sidebar-collapsed`（历史遗留，无前缀、连字符命名）改名 `is_sched:sidebar`，旧值不迁移不留兼容代码，浏览器 DevTools 中可手动删除残留。

# [时间] 2026-09-09
# [定位] 实时上下文：当前 Sprint 进度缓存
# [作用] 记录"现在"正在做的事。任务完成后需及时清理。
# [规则] 重点标注 Tao 的进度。

## 📍 当前状态
- **09-09 排班规则全面审计批（本会话）：改动待提交（git 未 commit/push）**
  - 修复 filter.js:77 settings 整体解构缺键致日/时段上限静默失效（#28 同族在 filter 层复发）→ 逐键兜底 + 回归测试钉住
  - 补 18 条回归测试（220→**238/238 全绿**）：accumulateDelta ± 对称/钳制/窗口外/tenure 专项（此前 -1 路径零覆盖）、warned 阈值可配、new 自动填充贯通、候选 warning 黄字贯通、均衡负分、空 active 池、黑名单无原因、validateProject 分支
  - Playwright 全链路实测通过（铺排→智能排班→手动建班→分配弹窗拒因→替换三轨联动→批量删除三轨回退，console 0 errors，测试数据已还原）
  - **名称唯一确认**（Tao 拍板）：已入 spec 3.1/3.2 字段标注 + 5.1「名称唯一」条目
- **09-09 替换弹窗候选行式改版（Tao 提出，本会话完成）：改动待提交**——去「选此替补」按钮改学排班分配弹窗行式（分徽章 + 周疲劳右置 + 副行人话理由），点整行触发二次确认（误触由 confirmDialog 兜底）；spec 5.3 已同步；Playwright 验证过（0 errors，数据已还原）
- **09-09 滚动保持 + 劳累指数两批：spec 5.1/5.2 同步完成（spec.md 改动待提交）**；两批功能代码早已提交 push（滚动保持 681a62e / 劳累标识 a01263e、9c8380a）
- **09-09 Excel 导入回归批：已 push（a9f215a）**——npm test 220/220、回归资产 fixtures 生成器在 `docs/脚本/gen-excel-import-fixtures.js`
- **dist**：⏳ 旧构建（09-03），需 `node build.js`（Tao 要求时才构建）

## 🧠 核心决策
> 已入 spec 正文的定稿（名称唯一、Excel 收紧、滚动保持、劳累标识、文案原则）不在此重复，spec 为最终载体。此处只留跨会话方法论经验。

- 测试数据红线锚定法（经验，防反复）：3 分任务每周人次 > 团队高强配额时自动铺排必超限 → 锚点周任务手动逐班指定、红线人物从自动池剔除、未来周超限噪点留给领导当调整素材（脚本内已注释）。
- Playwright 验证法（UI 回归复用）：**toast 记录型 MutationObserver**（`window.__toasts` 持续记录 .toast 新增，绕开 2.5s 移除竞态）；**注入测试数据前先整库备份到 localStorage 临时 key**（跨 reload 存活，测完还原再删 key，防覆盖真实数据）；**round-trip 直取 Playwright 落盘下载产物**（`.playwright-mcp/` 已忽略）回传验证。UI 全链路回归路径 = 批量铺排 → 智能排班 → 手动建班 → 分配弹窗（拒因区）→ 替换（点行二次确认）→ 批量删除（多选态）。

## ⚠️ 待办与注意
- **git 待提交**：本会话改动集（src: filter.js 修复 + calendar.js 替换弹窗行式 + theme.js；test 5 文件 +18 条；.ai/spec.md 三处 + memory.md）——Tao 说提交再走 /commit
- **dist**：⏳ 旧构建（09-03），Tao 要求时才 `node build.js`
- 注意：filter.js 已逐键兜底（daily/slotTaskLimit），与 score.js 一致；未来新增消费 settings 的规则代码一律逐键 `?? DEFAULT`（#28 教训，勿整体解构一把兜）

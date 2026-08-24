# UI 打磨设计（按钮 + 表单 + 组件一致化）

> 2026-08-24 与 Tao 逐项确认。范围：按钮+表单为主，连带组件一致化。
> 视觉基调：浅色简洁·精致化（保持白底+蓝主色，补全交互反馈）。

---

## 1. 背景与问题

当前全站 UI 为**内联 `style.cssText`**，存在：

- 按钮样式重复且不一致（config.js 与 calendar.js 各写一套 `btn()`，padding 不同）
- 主/危险/成功按钮散落各文件硬编码
- 编辑弹窗用**裸 JSON 输入框**（擅长/禁忌项目、时段），输入体验差
- 内联样式无法表达 `:hover` / `:focus` / `:active` / `:disabled` 伪类，交互反馈缺失
- 弹窗/表格/toast 无动画、无 hover，观感粗糙

## 2. 技术方案（已选 A）

**设计令牌 + 全局样式注入（CSS-in-JS 风格）**

- 新增 `src/ui/theme.js`：导出设计变量 + `injectGlobalStyles()` 注入 `<style>`，定义通用类
- 各视图从拼 cssText 改为挂 class
- 契合"无框架 + 单文件打包 + file:// 双击即用"约束：样式随 JS 内联进 `dist/index.html`，build.js 不用改
- 唯一能完整表达伪类，把交互反馈做全

## 3. 设计令牌（theme.js）

| 类别 | 值 |
|------|-----|
| 主色 | `#2563eb`（hover `#1d4ed8` / active `#1e40af`） |
| 语义色 | 成功 `#16a34a` / 危险 `#dc2626` / 警示 `#d97706` |
| 中性 | 文本 `#222` / 次级 `#6b7280` / 弱 `#9ca3af` / 边框 `#d1d5db` / 浅边框 `#e5e7eb` |
| 背景 | 页面 `#f5f6f8` / 卡片 `#fff` / 网格底 `#fafafa` |
| 圆角 | sm 4 / md 6 / lg 8 |
| 间距 | 4/8/12/16/24 |
| 阴影 | sm `0 1px 3px rgba(0,0,0,.08)`（卡片）/ md（弹窗） |
| 焦点环 | `rgba(37,99,235,.18)` 外圈 |

## 4. 按钮体系

- **基础 `.btn`**：`inline-flex; align-items:center; gap:6px; border:1px solid transparent; border-radius:6px; padding:8px 14px; font-size:14px; cursor:pointer; transition: background/border/box-shadow .15s`
- **变体**：
  - `.btn-primary` 蓝底白字（保存/创建/智能排班）
  - `.btn-default` 白底灰边（周切换/导入导出）
  - `.btn-danger` 红底白字（标记请假）
  - `.btn-success` 绿底白字（选此替补）
  - `.btn-ghost` 无底无框（周标签、超链接式操作）
- **尺寸**：`.btn-sm`（周历导航、表格编辑等紧凑场景，padding 6px 10px）
- **状态反馈**：`:hover` 变深一档 / 浅灰底；`:active` 再深一档；`:disabled` 灰底灰字 + `cursor:not-allowed`；`:focus-visible` 焦点环

## 5. 表单体系

- **`.field` 布局**：label 在上、控件在下，`margin-bottom:14px`；支持 `.required`（红星）与 `.hint`（提示小字）
- **`.input` / `.select`**：全宽、`padding:8px 10px`、边框 `#d1d5db`、圆角 6px；`:focus` 主色边框+焦点环；`:disabled` 灰底；`::placeholder` 弱灰
- **`.field.is-error`**：控件红边框 + 下方红色错误小字

## 6. 结构化动态行编辑器（src/ui/fields.js）

复用 `rowsEditor`，替换裸 JSON 输入框：

| 用途 | 每行构成 |
|------|----------|
| 擅长/禁忌项目（Staff） | `[项目下拉] [原因 input] [×]`，底部"＋ 添加一行"；擅长 placeholder"如：体力好，搬运熟练"，禁忌"如：腰伤，不宜搬重物" |
| 时段（Project） | `[标签下拉 上午/中午/下午/晚上] [开始 time] [结束 time] [×]`，底部"＋ 添加时段" |

## 7. 编辑弹窗结构化

- **人员**：状态下拉、`allowedProjects` 改项目多选、擅长/禁忌用 rowsEditor、上下限数字输入
- **任务**：劳累指数下拉(1-3)、重复星期改周一~周日 7 个勾选 chips、时段用 rowsEditor、启用开关

## 8. 校验错误行内化（连带改动）

- `validateStaff/validateProject` 从 `errors: string[]` 改为 `errors: [{field, msg}]`
- 保存失败时错误落到对应 field，不再只弹 toast
- 同步：config.js 的 `v.errors.join('；')` 调用点、`test/model.test.js` 中 2 处 `e.includes(...)` 断言

## 9. 连带组件收口

| 组件 | 打磨点 |
|------|--------|
| 弹窗 modal.js | 淡入动画；Escape 关闭 + 焦点管理；footer 按钮接入 `.btn` |
| 表格 | `.table` 类：表头浅灰底、行 hover 高亮、padding 一致；"编辑"用 `.btn .btn-sm` |
| toast | 入场动画、类型图标（✓/✕/ℹ）、颜色对齐 tokens |
| 周历卡片 & chips | 卡片 hover 轻投影；chip 补 hover 底；空单元格"＋"弱化提示 |
| 导航 tab | 接入 `.btn` + `.active` 态 |

## 10. 迁移策略（按依赖顺序）

1. 新增 `theme.js`、`fields.js`
2. `main.js` 入口调 `injectGlobalStyles()`
3. 依序迁移：`modal.js` → `toast.js` → `config.js`（含结构化表单）→ `calendar.js` → `analysis.js` → `main.js` 导航
4. model.js validate 结构化 + 同步调用点与断言

## 11. 测试与验证

- **单测**：算法层不受影响，41 单测保持全绿；model.test.js 仅同步 validate 断言格式
- **手测**（http + 打包 file://）：新增/编辑人员任务（动态行/多选/chips/错误行内）、按钮四态反馈、弹窗动画与 Escape、toast、周历拖拽不被破坏
- **打包**：按需 `node build.js` 验证单文件样式内联正常

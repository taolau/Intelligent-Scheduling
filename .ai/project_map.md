# [定位] 物理导航：项目结构与模块映射
# [作用] 描述项目文件夹逻辑，帮助 AI 快速定位代码文件，防止创建冗余文件。
# [规则] 仅记录目录职责和核心文件关联，不记录具体函数逻辑。保持结构扁平清晰。
---

## 顶层

```
Intelligent-Scheduling/
  index.html          # 入口（含首屏侧边栏样式内联，消除 FOUC；发布时 esbuild 内联为 dist/index.html 单文件）
  package.json        # scripts: dev(vite) / build(esbuild单文件) / test(node:test)
  build.js            # 打包脚本 → dist/index.html（开发多模块,发布单文件）
  dist/               # 构建产物（gitignore,仅 index.html）
  docs/               # 本地文档（storage.md = localStorage key 全量登记表与维护规则；score-rules.md = 排班推荐分数规则人话手册，spec 4.x 为真源）
  test/               # node:test 单测（算法层+模型+数据层 db/store）
```

## src/ 模块职责

| 目录 | 文件 | 职责 | 依赖 |
| --- | --- | --- | --- |
| `data/` | `model.js` | 数据模型定义+校验（Project/Staff/Schedule） | 无 |
| | `keys.js` | localStorage key 集中登记处（KEYS 全量常量 + STORES 业务表名；新 key 唯一入口，配套 docs/storage.md） | 无 |
| | `db.js` | localStorage 持久化 + 内存 Map 索引（CRUD + writeAll 批量写，KEYS[storeName] 查表读写） | keys |
| | `store.js` | 增量缓存门面（saveXxx 增量更新 cache 不重读；loadAll 仅初始化/导入/重置；JSON备份/恢复；getSettings/saveSettings） | db/keys |
| `core/` | `week.js` | 周/日期/时间工具（纯函数） | 无 |
| | `expand.js` | 按 weekDays+slots 展开班次；`expandWeeks` 批量展开连续 N 周 | week |
| | `filter.js` | 硬性过滤（一票否决，返回原因） | week |
| | `score.js` | 打分（擅长/均衡/间隔，返回得分构成） | week |
| | `substitute.js` | 替补 Top3 推荐 + 上下文聚合 | filter/score/week |
| `views/` | `calendar.js` | 周历网格看板（核心交互；**视图维度切换**：总览/项目/人员过滤+摘要，状态 is_sched:cal_view；工具栏「导出」hover 下拉=Excel/图片）；**替换弹窗 openReplaceDialog**（当天班次分组按时段排序、候选卡、完成态折叠绿条） | core+data+ui |
| | `config.js` | 基础配置页（人员/任务**卡片网格**，开关切换状态、编辑弹窗；tab 记忆 is_sched:config_tab） | data+ui+excel |
| | `analysis.js` | 疲劳分析柱状图（canvas） | core+data |
| `ui/` | `theme.js` | 设计令牌 tokens + 全局样式注入（按钮/表单/弹窗/表格/toast/周历类/卡片网格/开关）；**侧边栏样式与 index.html 首屏内联段同步维护** | 无 |
| | `icons.js` | 共享 SVG 图标常量（ICON_FIRE 劳累指数火焰等） | 无 |
| | `fields.js` | 表单构建：field()/setError()/rowsEditor() 结构化动态行 | select |
| | `select.js` | 自定义下拉：createSelect 单选/多选统一组件（`searchable` 可搜索过滤），el.value 兼容原生 select 读取；面板 fixed 视口定位防弹窗裁剪 | theme |
| | `timepicker.js` | 时间选择器：createTimePicker 点击整个框弹时/分双列面板（小时 00-23、分钟 00-59，选分钟自动收起），el.value 返回 'HH:mm' 或 '' | theme |
| | `modal.js` | 弹窗（openModal 单点收口全部弹窗：右上角 X 关闭、遮罩点击不关闭、ESC/footer 关闭） | theme |
| | `dnd.js` | 拖拽封装 | 无 |
| | `excel.js` | Excel 导入导出（SheetJS） | data/model |
| | `exportImage.js` | 周历导出 PNG（html2canvas 离屏克隆：固定 1200px 宽/静态视图/标题区），文件名 Numbers-排班图-… | excel(下载) + week |
| | `toast.js` | 提示 | theme |
| `main.js` | — | 入口装配三视图+导航 | views/* |

## 关键约定

- **算法层 core/ 是纯函数**（无 DOM/浏览器 API），可 node:test 单测；views/ui 依赖浏览器，仅手测。
- **数据流**：store.js 缓存为唯一真源，视图层经 `getCache()` 读、`saveXxx()` 写；`loadAll` 仅初始化/导入/重置时调用。
- **时段标签**：预置集合 `自主安排/早/中/晚`（model.js SLOT_LABELS），固定四行；全部无具体时间，负荷由数量上限+预警（settings）控制。
- **buildContext 必须返回 schedules**（filter 重叠检测依赖），勿精简。

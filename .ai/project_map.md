# [定位] 物理导航：项目结构与模块映射
# [作用] 描述项目文件夹逻辑，帮助 AI 快速定位代码文件，防止创建冗余文件。
# [规则] 仅记录目录职责和核心文件关联，不记录具体函数逻辑。保持结构扁平清晰。
---

## 顶层

```
Intelligent-Scheduling/
  index.html          # 入口（发布时 esbuild 内联为 dist/index.html 单文件）
  package.json        # scripts: dev(vite) / build(esbuild单文件) / test(node:test)
  build.js            # 打包脚本 → dist/index.html（开发多模块,发布单文件）
  dist/               # 构建产物（gitignore,仅 index.html）
  test/               # node:test 单测（算法层+模型）
```

## src/ 模块职责

| 目录 | 文件 | 职责 | 依赖 |
| --- | --- | --- | --- |
| `data/` | `model.js` | 数据模型定义+校验（Project/Staff/Schedule/Leave） | 无 |
| | `db.js` | localStorage 封装（CRUD） | 无 |
| | `store.js` | 业务门面（CRUD+缓存+JSON备份/恢复） | db |
| `core/` | `week.js` | 周/日期/时间工具（纯函数） | 无 |
| | `expand.js` | 按 weekDays+slots 展开班次；`expandWeeks` 批量展开连续 N 周 | week |
| | `filter.js` | 硬性过滤（一票否决，返回原因） | week |
| | `score.js` | 打分（擅长/均衡/间隔，返回得分构成） | week |
| | `substitute.js` | 替补 Top3 推荐 + 上下文聚合 | filter/score/week |
| `views/` | `calendar.js` | 周历网格看板（核心交互） | core+data+ui |
| | `config.js` | 基础配置页（人员/任务表） | data+ui+excel |
| | `analysis.js` | 疲劳分析柱状图（canvas） | core+data |
| `ui/` | `theme.js` | 设计令牌 tokens + 全局样式注入（按钮/表单/弹窗/表格/toast/周历类） | 无 |
| | `fields.js` | 表单构建：field()/setError()/rowsEditor() 结构化动态行 | select |
| | `select.js` | 自定义下拉：createSelect 单选/多选统一组件，el.value 兼容原生 select 读取；面板 fixed 视口定位防弹窗裁剪 | theme |
| | `modal.js` | 弹窗（替补推荐等） | theme |
| | `dnd.js` | 拖拽封装 | 无 |
| | `excel.js` | Excel 导入导出（SheetJS） | data/model |
| | `toast.js` | 提示 | theme |
| `main.js` | — | 入口装配三视图+导航 | views/* |

## 关键约定

- **算法层 core/ 是纯函数**（无 DOM/浏览器 API），可 node:test 单测；views/ui 依赖浏览器，仅手测。
- **数据流**：store.js 缓存为唯一真源，视图层通过 loadAll()/saveXxx() 读写。
- **时段标签**：预置集合 `上午/中午/下午/晚上`（model.js SLOT_LABELS），固定四行。
- **buildContext 必须返回 schedules**（filter 重叠检测依赖），勿精简。

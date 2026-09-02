# [定位] 影子知识库：逻辑陷阱与避坑指南
# [作用] 记录历史高频报错、隐蔽 Bug 及其解决方案。作为 AI 的反向参考。
# [规则] 默认静默，仅在【执行报错】或【涉及高危模块】时由断路器协议强制检索。
---

## 1. 上下文聚合对象必须包含算法依赖的所有字段

- **报错**：`Cannot read properties of undefined (reading 'find')` at filter.js
- **场景**：智能排班/拖拽调用 `filterCandidate` 时，`ctx.schedules` 为 undefined
- **根因**：`buildContext` 返回对象遗漏 `schedules` 字段，但 `filterCandidate` 的时间重叠检测依赖它
- **解决**：`buildContext` 返回 `{ weeklyFatigue, heavyCounts, teamAvg, weekStart, leaves, schedules }`；同时 filter 侧用 `(ctx.schedules ?? [])` 防御
- **启示**：聚合上下文的函数返回字段 = 所有下游算法消费字段的并集，精简会静默制造运行时崩溃

## 2. 跨日时间间隔计算：用绝对分钟，勿用日期串切片

- **报错**：间隔保护扣分结果错误（同日班次被误过滤）
- **场景**：`scoreCandidate` 计算"距上次排班结束不足 restHours"扣分
- **根因**：原实现用 `parseInt(date.slice(8))` 近似天数差，跨日与同日边界错误
- **解决**：`toAbsMinutes(date, time) = Date.parse(date+'T00:00:00')/86400000*1440 + timeToMinutes(time)`，再比较绝对分钟差
- **启示**：凡涉及跨日的时长/间隔计算，一律先归一化为绝对时间戳（天×1440+分钟），勿对日期字符串做算术

## 3. 计数 Map 需显式初始化 0，勿依赖"无记录=0"

- **报错**：`heavyCounts.get(id)` 返回 undefined 而非 0
- **场景**：`buildContext` 只对高强度项目写入 heavyCounts，非高强度人员无记录
- **根因**：`Map.get()` 无记录返回 undefined，断言 `=== 0` 失败
- **解决**：累加时统一 `map.set(id, (map.get(id) ?? 0) + n)`，保证参与排班者都有记录
- **启示**：对外承诺"次数"语义的 Map，内部必须为每个参与者初始化 0

## 4. Playwright 无法完整模拟 HTML5 拖拽 dataTransfer

- **报错**：`browser_drag`/`dragTo` 后 drop 处理未执行，数据无变化
- **场景**：手测拖拽人名换班次
- **根因**：Playwright 合成 DragEvent 的 `dataTransfer.getData` 返回空串，dnd 逻辑读不到 payload
- **解决**：用原生 DragEvent 构造——先 dispatch `dragstart`（让 enableDrag 写入 dt），再 dispatch `drop`（同一 dt）
- **启示**：拖拽类交互的浏览器手测需绕过 Playwright 的合成事件限制

## 5. file:// 协议下 IndexedDB.open 永不回调 → 页面空白且无报错

- **报错**：`dist/index.html` 双击（file://）打开，页面空白；console 无任何错误，nav 正常渲染但 view 为空
- **场景**：直接双击打开构建产物（非 http(s) 环境）
- **根因**：Chromium 对 file:// 的 `indexedDB.open()` 不触发任何回调（不 onsuccess 也不 onerror），`await loadAll()` 永久挂起，Promise 既不 resolve 也不 reject → 无报错、页面停在渲染前
- **解决**：存储层改用 localStorage（file:// 下可读写且持久，见 spec 存储决策）；接口签名不变，上层无感知
- **启示**：纯前端「双击即用」应用，存储介质必须选 file:// 下可用的方案（localStorage）；IndexedDB 依赖 http(s) 安全环境，是浏览器策略不可绕过

## 6. 新函数引用的模块导出必须同步加入 import 清单

- **报错**：点击"新增任务"弹窗静默不出现，页面无点击反馈
- **场景**：UI 打磨重写 `config.js` 的 editProjectDialog，内部引用 `FATIGUE_MAX`
- **根因**：import 清单未包含 `FATIGUE_MAX`，async 函数同步段抛 ReferenceError → promise reject，click 无感知，弹窗不打开
- **解决**：import 补齐 `FATIGUE_MAX`；用 CDP 真实点击验证（点击后轮询 `.modal-header` 是否存在）抓出这类"静默无响应"运行时错误
- **启示**：手写引用模块导出后逐项核对 import 清单；静态 dump-dom 验不出异步交互错误，需真实事件驱动（Edge CDP Runtime.evaluate）

## 7. Playwright MCP 依赖系统 Chrome，本机缺失时改用 Edge headless CDP

> **2026-08-25 更新**：本机环境已变化，Playwright MCP 现在可直接驱动（`browser_navigate`/`browser_click`/`browser_evaluate` 等可用），本条目降级为备用方案。验证 UI 交互优先用 Playwright MCP。

- **报错**：`Chromium distribution 'chrome' is not found at C:\...\chrome.exe`
- **场景**：需要浏览器手测/交互验证，本机未安装 Google Chrome
- **根因**：Playwright MCP server 以 channel 'chrome' 启动，强制找系统 Chrome；`npx playwright install chrome` 在中国网络下极慢/易卡；项目未声明 playwright 依赖
- **解决**：改用手边系统 Edge（本机已装）：
  - 静态渲染：`msedge --headless=new --disable-gpu --virtual-time-budget=8000 --dump-dom <url>`（file:// 与 http 均可，验证页面不空白/关键 DOM）
  - 交互驱动：`msedge --headless=new --remote-debugging-port=9222 about:blank` + Node 脚本（Node 24 内置 WebSocket）连 CDP，`Runtime.evaluate` 执行真实点击与取值
  - 模拟按键注意：Escape 等需派发到 `document` 且 `bubbles:true`（KeyboardEvent 构造默认不冒泡，派发到子元素收不到 document 监听器）
- **启示**：UI 交互验证优先选本机可用浏览器；CDP 的 Runtime.evaluate 可替代 Playwright 的部分交互测试，且能驱动 file:// 页面

## 8. 后台 dev server 残留孤儿进程：TaskStop 杀不掉 vite 子进程，端口被占

- **报错**：`http://localhost:5173` 访问不了；`netstat -ano` 发现 5199 端口仍被旧 vite 进程 LISTENING
- **场景**：`npm run dev 2>&1 | tee log` 后台运行，之后用 TaskStop 停止
- **根因**：TaskStop 杀的是 npm/tee 外壳，vite 本体（node 子进程）成孤儿存活继续占端口；旧 server 在 5199、用户访问默认 5173 自然失败
- **解决**：后台 dev server 直接 `node ./node_modules/vite/bin/vite.js --port 5173 --strictPort`（不经 npm），TaskStop 可干净杀掉；停服务前 `netstat -ano | findstr :端口` 确认无残留，必要时 `Stop-Process -Id <pid> -Force`
- **启示**：后台长驻进程尽量直接跑可执行文件本体而非包一层 npm/tee；端口不可访问先查 LISTENING 与 PID，再谈重启

## 9. 日期运算禁用 toISOString().slice(0,10)：UTC 偏移致周切换错乱/定位错周

- **报错**：周历"下周 →"点了周标签纹丝不动、"上周"跳两周；本地凌晨打开页面定位到上周
- **场景**：calendar/analysis/substitute 用 `getWeekStart(new Date().toISOString().slice(0,10))` 或 `getWeekStart(date.toISOString().slice(0,10))`
- **根因**：`toISOString()` 返回 **UTC** 日期。本地（UTC+8）00:00-07:59 时 UTC 日期 = 本地昨天；本地 8/31 零点 → UTC 8/30 → `getWeekStart` 归一化回 8/24 → 周切换原地踏步甚至倒退
- **解决**：一律用本地日期工具：`todayStr()`（本地今天）、`toDateStr(date)`（Date → 本地字符串），替换全项目 5 处 `toISOString().slice(0,10)`
- **启示**：凡涉及"日期字符串 + 时区"，统一用本地 getter 构造（week.js 已封装 todayStr/toDateStr），永远不碰 toISOString

## 10. 弹窗内绝对定位下拉面板被 overflow 裁剪 → fixed 视口定位

- **报错**：手动建班次弹窗选任务的下拉"被吃掉"（选项看不见或需滚动）
- **场景**：自定义下拉 `.sel-panel`（position:absolute）位于 `.modal-body { overflow-y:auto }` 内，面板向下展开 224px 溢出 body 边界
- **根因**：`.modal-body` 的 overflow-y:auto 裁剪绝对定位子元素；弹窗内容矮时面板大部分在裁剪区外
- **解决**：select.js 打开面板时改 `position:fixed` 按 trigger getBoundingClientRect() 视口定位（z-index 提至 1050 浮于 modal 遮罩之上）；底部空间不足自动向上翻转；滚动跟随、resize 关闭
- **启示**：任何浮层（下拉/气泡）出现在滚动容器内都要考虑 overflow 裁剪，成熟做法是 fixed 定位到视口

## 11. Canvas 绘制必须 × devicePixelRatio + setTransform，否则高分屏模糊

- **报错**：疲劳分析柱状图在高分屏（缩放 >100%）模糊、文字发虚
- **场景**：analysis.js 用固定缓冲尺寸画 canvas
- **根因**：canvas 缓冲尺寸 ≠ CSS 显示尺寸 × DPR，浏览器把低分辨率缓冲拉伸到高 DPR 显示
- **解决**：缓冲 width/height × devicePixelRatio，`ctx.setTransform(dpr,0,0,dpr,0,0)` 后再画；图表容器 flex:1 填满消除下方空白
- **启示**：任何 canvas 自绘图表必须做 DPR 适配

## 12. file:// 下 File System Access 目录句柄无法跨会话持久化：每次打开需重新选目录

- **报错**：`showDirectoryPicker()` 选中的目录，刷新/重开后句柄丢失，需重新授权
- **场景**：想实现「指定桌面目录文件持久化」（纯前端 file:// 双击即用）
- **根因**：FileSystemHandle 持久化依赖 IndexedDB（structured clone 支持句柄）；file:// 下 IndexedDB 永不回调（见#5），localStorage 只能存字符串、句柄序列化后失效。实测：file:// 下 `isSecureContext=true`、showDirectoryPicker/OPFS 均可用，但句柄活不过会话
- **解决**：接受「每次打开点一次目录」+ localStorage 双写兜底；或引入本地进程（Node/EXE）才能真正固定路径全自动
- **启示**：纯前端 file:// 下「自动 + 固定路径 + 免授权」不可能三角，方案选型前先认清此边界

## 13. db 内存 Map 索引后：多标签页不同步，同 id 后写覆盖

- **报错**：两个标签页同时打开应用，A 页保存的数据 B 页看不到
- **场景**：db.js 改为内存 Map 索引后，getAll 不再每次重读 localStorage
- **根因**：内存 Map 仅在首次访问某 store 时从 localStorage 加载，之后 CRUD 走内存；另一标签页的写只改了它自己的 Map + 落盘，本页 Map 无感知
- **解决**：单用户单标签页场景无碍（双击即用定位天然单标签）；若需多标签页同步，监听 `storage` 事件触发 Map 重载
- **启示**：引入内存缓存时明确「是否接受跨标签页不一致」；接受则省一次 JSON.parse，不接受则加 storage 事件

## 14. 样式靠 JS 运行时注入（injectGlobalStyles）→ 刷新时 FOUC 裸闪

- **报错**：每次刷新，左上角侧边栏先以无样式裸 HTML 闪现（通栏宽度、裸文本品牌区、左右双箭头按钮），JS 注入 CSS 后才恢复正常
- **场景**：theme.js 用 `injectGlobalStyles()` 创建 `<style id="app-theme">` 运行时注入全量样式；index.html 的 `<style>` 只含几条基础规则
- **根因**：HTML 解析后、JS 模块执行前，依赖 JS 注入的样式未生效 → 静态 HTML 部分（侧边栏）裸渲染
- **解决**：首屏静态部分（侧边栏整套）的样式内联进 index.html `<style>`，首帧即生效；theme.js 注入同名覆盖作双保险；**两处样式需同步维护**（index.html 首屏段 + theme.js 侧边栏段，注释锚点标记）
- **启示**：样式全量 JS 注入的应用，静态首屏元素必有 FOUC；首屏可见的静态块样式应内联 HTML 消除

## 15. 重渲染函数读取旧 DOM 状态：必须先读后清空

- **报错**：配置页在「任务管理」tab 操作后重渲染跳回「人员管理」；修复后 tab 高亮错位（内容=任务卡片但高亮=人员管理）
- **场景**：`renderConfig` 重渲染配置页，需保持用户当前激活 tab
- **根因**：①`container.innerHTML = ''` 在读取 `.seg button.active` **之前**执行，旧 DOM 已被清空 → keepTab 永远 undefined → 回默认 tab；②即使内容按 keepTab 渲染对了，tab 按钮的 active class 仍硬编码在「人员管理」上 → 内容与高亮不一致
- **解决**：先读 `const keepTab = document.querySelector('.seg button.active')?.textContent` 再清空容器；active class 按 keepTab 动态分配（内容与高亮同一驱动源）；刷新后停留用 localStorage（is_sched:config_tab）持久化
- **启示**：任何「重渲染保持状态」的需求，旧状态必须在清空容器**之前**读取；视觉高亮与内容必须由同一变量驱动，禁止硬编码默认

## 16. 高频小交互（开关）勿全量重渲染：hover 动画被重建卡片重触发 → 抖动

- **报错**：点击任务卡「启用/停用」开关，卡片整体抖动/闪烁
- **场景**：卡片开关 onchange → 保存 → `renderConfig` 全量重建整个配置页 DOM
- **根因**：重建后鼠标悬停位置生成全新卡片，`.card:hover { transform:translateY(-2px) }` 的 hover 上浮动画在新节点上重新触发；且全页重建（工具栏/所有卡片）本身就有闪烁
- **解决**：开关切换改**局部更新**——保存数据后只替换卡片头部徽标（outerHTML）与开关标签（textContent），不重建 DOM；编辑弹窗保存等低频操作仍可全量渲染
- **启示**：高频小交互的即时反馈应局部更新 DOM；只有低频、结构性变更（增删、弹窗保存）才值得全量重渲染；判断标准=鼠标是否仍悬停在该交互目标上

## 17. 多级嵌套数据的分隔解析：内层分隔符不能与外层冲突

- **报错**：擅长项目 `P101(体力好,搬运熟练);P102` 导入后被切分为 `{projectId:"P101(体力好"}`、`{projectId:"搬运熟练)"}` 两条脏数据
- **场景**：Excel 导入解析「项目(原因)」格式，原因内含中文/英文逗号
- **根因**：解析函数先按分号+逗号统一 split，原因内的逗号把条目截断
- **解决**：条目间仅按分号分隔（`split(';')`），原因内逗号保留；项目 ID 与原因用括号正则提取 `^([^()]+)\(([\s\S]*)\)$`
- **启示**：凡多级嵌套数据（外层分号、内层括号/逗号），解析必须分层次处理，勿用同一分隔符集合统一切分

## 18. SheetJS 社区版 write 会剥离单元格样式

- **报错**：模板 Excel 示例行设置浅灰背景 `cell.s = { fill: { fgColor: {...} } }`，写出的文件读回 `cell.s` 为 undefined
- **场景**：想给下载的模板示例行加背景色做视觉区分
- **根因**：SheetJS 社区版（免费版）write 时不保留单元格样式（`cell.s`），样式是专业版功能；`XLSX.write` 后样式丢失
- **解决**：放弃背景色，用数据标识（「【示例】」前缀）区分示例行，导入时按前缀自动跳过
- **启示**：纯前端 Excel 生成无法依赖单元格样式美化模板；需要视觉区分时用内容标记替代

## 19. Excel 时间单元格读回为数字序列号：时间段导入静默丢失

- **报错**：任务模板「时间段开始/结束」填了时间，导入后周历卡片不显示时间段（`timeRange` 为 null），无任何报错
- **场景**：Excel 模板导入时间段，用户在单元格直接填 `08:00`
- **根因**：Excel 把 `08:00` 识别为原生时间，存储为**日期序列号**（浮点数，如 `0.3333`、带日期 `46023.33`）；`XLSX.utils.sheet_to_json` 默认 `raw:true` 读回**数字**而非字符串，原解析正则只认 `HH:mm` 字符串 → 判 null → 时间段静默丢失。另无前导零文本 `8:00` 也会被拒
- **解决**：`sheet_to_json` 加 **`raw:false`** 返回 Excel 格式化文本（`"08:00"`，天然消除浮点误差），解析层 `toHHmm` 规整化（兼容无前导零/全角冒号；保留数字序列号转换分支作防御）。`format_cell(cell)` 或 `cell.w` 亦可拿到精确文本
- **启示**：导入 Excel 时间/日期列勿用默认 raw 读值——单元格类型是数字序列号而非文本；需格式化文本时用 `raw:false` 或读 `w` 字段

## 21. 往 CSS Grid 容器 prepend 子元素会被网格布局接管：塞进第一格、挤乱原内容

- **报错**：周历导出图标题「挤在左上角」，且把周一列内容整体下推
- **场景**：想给 `.cal-grid`（`display:grid`，7 列）顶部加标题条，直接在 grid 上 `prepend(header)`
- **根因**：CSS Grid 容器的**直接子元素全部按网格项参与布局**——prepend 的标题成了第一个网格项，被自动放置进第一行第一列（周一列），宽度被压成一列宽、把原第一格内容顶下去；浏览器不报错、canvas 尺寸不变，视觉上就是「挤在左上角+内容下推」
- **解决**：浮动性 UI（标题/工具栏/覆盖层）不能塞进 grid 容器内部；改在容器**外部**另起结构，或离屏包一层「标题 + grid」的新容器再整体渲染
- **启示**：给 grid/flex 等「子元素全部参与布局」的容器注入新节点前，先问「它会以什么身份参与布局」；标题类 UI 应独立于网格结构

## 22. html2canvas 的 onclone 修改克隆元素不改变 canvas 尺寸：需要更大画面时用离屏包装容器整体截图

- **报错**：onclone 里往周历顶部插入标题条，导出图 canvas 尺寸与修改前完全一致，标题被布局挤压/裁切
- **场景**：想用 html2canvas 的 `onclone` 钩子「在截图副本里加标题」，期望画面自动变高
- **根因**：html2canvas 的 canvas 尺寸由**原 DOM** 中目标元素的边界决定（渲染前测量），`onclone` 对克隆文档的布局修改（加高/加宽）不会扩大 canvas——克隆里加了内容只会被裁剪或挤压进原尺寸
- **解决**：需要「比原元素更大的画面」时，构造一个**离屏包装容器**（`position:absolute;left:-99999px`，显式宽度），把「新增元素 + 原元素克隆」都放进去，把包装容器整体交给 html2canvas；克隆保留 class + 内联样式，全局注入的 `<style>` 会被 html2canvas 复制，样式照常生效
- **启示**：html2canvas 是「按原 DOM 边界截图」模型，所有需要改变画面尺寸的定制（加标题、加页脚、加留白）都应通过包装容器，而非 onclone 改布局；另外克隆 flex 元素注意 `flex:1` 依赖父级链，放入无高度约束的包装容器后高度会退化为内容高度（通常恰好是需要的）

## 23. position 不只改布局还改绘制优先级：给静态元素加 relative 会盖住 DOM 更靠前的绝对定位悬浮元素

- **报错**：时段大卡片右上角的「早/中/晚」chip 被第一张任务卡片盖住（此前一直正常显示）
- **场景**：为在 `.sch-card` 右上角放图标，给卡片加 `position:relative` 做定位锚点；chip（`.cal-slot-chip`，`position:absolute`）是大卡片的**第一个**子元素，卡片是后续子元素
- **根因**：chip 原本能浮在卡片上，靠的是 CSS 绘制规则「**定位元素绘制在非定位元素（static）之上**」，与 DOM 顺序无关；卡片加 `relative` 后自己也成了定位元素，两者同 `z-index:auto` → 转按 **DOM 顺序**绘制，DOM 靠后的卡片反超 chip。改一处样式解决 A 问题，静默引发 B 视觉 bug，浏览器无任何告警
- **解决**：悬浮标签类元素显式 `z-index:1` 自保（`.cal-slot-chip` 加 `z-index:1`）；卡片定位随后续需求移除后规则保留作防御
- **启示**：`position` 是「布局+绘制优先级」双刃剑——给流内元素加定位前，检查同容器内是否已有依赖「定位浮于静态」规则的悬浮元素（chip/角标/badge）；悬浮元素一律显式 z-index，不依赖隐式绘制规则

## 20. theme.js 大块替换样式时易误删同区域其他组件段落

- **报错**：实现周历布局改造时，按计划把 theme.js「周历」样式块整体替换，`.cal-bar`/`.cal-bar-group` 工具栏样式被一并删掉（工具栏布局错乱）
- **场景**：按"区域"组织 CSS 的样式文件（theme.js 一段区域内可能混着多个组件的类），计划/编辑时把整个区域替换成新内容
- **根因**：区域边界 ≠ 组件边界——「周历」区里除了网格/卡片，还内嵌了工具栏分组（`.cal-bar`）；只想着"新布局不要旧网格样式"就整块覆盖，未意识到区域内有必须保留的其他组件
- **解决**：替换前 grep 该区域内所有类名，逐一确认归属——属被替换组件可删、属相邻组件必须保留；宁可多留不用的类，也不要误删还在用的
- **启示**：大块 CSS 替换的核对清单 = 区域内每个类名 → 归属组件 → 是否仍被引用；区域式组织下"替换一个区域"往往需要"保留其中部分"

## 24. 弹窗内候选/推荐列表是状态快照：操作改变 ctx 后必须重算，否则过期候选可被塞进超限班次

- **报错**：替换弹窗中，第一组替换成功后，其余组的候选仍可点击，替补者被塞进当天第 3 个班次（超过 `dailyTaskLimit=2`），无任何提示
- **场景**：周历「替换」弹窗（openReplaceDialog）打开时一次性计算当天全部班次的候选列表
- **根因**：候选列表是「打开时 ctx 的快照」；一组替换执行后 ctx 已变化（替补者当日任务数/周疲劳/时段数 +1），其余组候选未重算 → 李四已被替换进浇花班次后，搬运班次的候选里仍有李四，点击后当日任务数 3 > 上限 2，超限班次被静默写入
- **解决**：替换成功后重算其余未完成组的候选（渲染抽成闭包 `group._rerender`，替换后遍历 `container.children` 重渲染）；对比先例：排班分配弹窗（scheduleDialog）每次操作后 `renderBody()` 整体重绘，本弹窗初版漏了此环节，浏览器实测（Playwright 注入测试班次 + 真实点击）暴露
- **启示**：凡弹窗内含「基于当前计数/积分生成的候选、推荐、可选列表」，任何会改变 ctx 的操作（加入/移除/替换）之后必须重算同一列表；交互态列表 ≠ 静态快照

## 25. 可搜索下拉点击选项无反应、面板直接取消：mousedown 失焦打断 IME 组合触发选项 DOM 重建

- **报错**：搜索框输入后点击过滤结果，面板直接关闭、选择不生效（表现像 onclick 没绑上或选项被遮挡，代码审查 onclick 绑定完全正常）
- **场景**：周历人员/项目维度可搜索下拉（createSelect `searchable:true`），中文输入法打拼音候选未确认时直接鼠标点选列表选项
- **根因**：四步竞态链——①点击选项瞬间 mousedown 使搜索框失焦；②失焦强制结束未确认的输入法组合，浏览器补发一次 input 事件；③input → renderOptions() 重建全部选项 DOM，被按住的原选项节点脱离文档；④click 只派发在 mousedown/mouseup 的公共祖先上，公共祖先已在 panel 外 → 冒泡到 document 的「点外关闭」→ 纯关闭（choose 从未执行）
- **解决**：选项节点上 `mousedown` 事件 `preventDefault()`（阻止焦点转移：搜索框不失焦 → 组合不被打断 → DOM 稳定 → click 正常落在原选项）；select.js renderOptions 循环内一行。**伴随修复**：onKey 回车分支 `choose(activeIndex)` 误传索引数字（0 被 `!o` 判空 return 选第一项无反应，非 0 取 `.value` 得 undefined）→ 改 `choose(view[activeIndex])`；搜索过滤后 activeIndex 未夹取（仍是全量列表旧值会越界）→ renderOptions 内重置
- **启示**：可搜索下拉的选项必须 mousedown preventDefault（业界标准做法），单纯绑 onclick 挡不住失焦重建竞态；「点击无反应」类 bug 先查 mousedown~click 之间 DOM 是否被重建——click 的事件目标由 mousedown/mouseup 公共祖先决定，不是鼠标按住时的那个节点

## 26. flex 容器内固定尺寸 SVG 与文本混排：默认 align-items:stretch 使图标贴行框顶部，视觉偏上

- **报错**：任务卡片「时间段」字段值里时钟图标高度位置不对、与文字不对称（偏上约 2px）
- **场景**：`.cfg-row .v`（`display:flex`）内 `内联SVG + 文本` 混排——时间段有值时 `${ICON_CLOCK} ${时间}`，SVG 12×12、文本 13px（行框 ≈16px）
- **根因**：flex 容器 `align-items` 默认 `stretch`：文本匿名 item 拉伸至行框高，固定尺寸（width/height 内联定死）的 SVG 不参与拉伸、沿交叉轴起点（顶部）对齐 → SVG 顶边贴合行框顶，行高 > 图标高时图标中心高于文字中心。**隐蔽性**：全图标行（如劳累指数多枚火焰 SVG）彼此顶部一致看不出问题；纯文本行无图标也看不出；只有「图标+文字」混排行暴露
- **解决**：`.cfg-row .v` 加 `align-items:center`（混排行图标与文字垂直居中）；对等高 tag 行（同容器其他用途）无副作用——行高不变，折叠测量（offsetTop/offsetHeight 分行）不受影响
- **启示**：flex 容器内「固定尺寸子元素 + 会拉伸的子元素」混排时，先想清楚 align-items——默认 stretch 下固定元素贴顶部；排查「图标/徽章比同行文字高或低」的视觉 bug，先看容器是 flex 还是 inline 布局（inline 走 baseline 是另一种错位），再对症用 align-items:center 或 vertical-align:middle

## 27. 超限/拒绝类提示文案必须区分「当前态」与「预测态」：已超不说成将超

- **报错**：周疲劳 20/7（当前 20 已超上限 7）的候选人被拒，提示却是「本周劳累积分将超限」
- **场景**：排班分配弹窗候选人被拒理由（filter 返回 reasons），亦波及替换弹窗、拖拽红框、智能排班（全链路直渲同一 reasons）
- **根因**：filter.js 超限检查只算「加后值 > 上限」即拒绝，reason 恒模板「…将超限」，**从不读当前值分支文案**——当前已超（cur>limit）该说「已超限」、恰满（cur===limit）该说「已达上限」、仅「未超但加后超」才配说「将超限」（+1 型检查不可能出现第三种，只有疲劳检查因加分 1-3 可跳超）
- **解决**：按当前值三分文案（`cur>limit` 已超限 / `cur===limit` 已达上限 / 余下将超限），判定逻辑不变；与 chip 视觉层级对齐（>`上限`=over 红、`=`=warn 黄）；文案改动同步 UI 直渲层无感知
- **启示**：面向用户的数值限制提示先问「此刻处于什么状态」再选词——「现状（已/达）」与「预测（将）」是两个语义域；模板文案一刀切最容易漏掉已超的现状表达

## 28. 消费 settings 时整体解构当心部分缺键：undefined 参与运算 → NaN 静默传播

- **报错**：自定义偏好参数测试 `r.score` 断言 20 实际 NaN；`均衡加分` 分值 NaN
- **场景**：score.js 从 `ctx.settings ?? DEFAULT_SETTINGS` 整体解构 `{ preferredBonus, balanceFactor }`，测试只传 `settings: { preferredBonus: 20 }`
- **根因**：`?? DEFAULT_SETTINGS` 只在 settings **整体为 undefined** 时兜底；settings 存在但**缺个别键**（部分传入/旧数据/不同调用方构造的局部 ctx）时解构得 `undefined` → `undefined * n = NaN`，且不报错一路算进 score 排序（静默错误）。项目里 store.getSettings 有 merge 层保证全键，容易误以为「settings 永远全键」，绕过 merge 直接构造 ctx 的调用（测试/新函数）即触发
- **解决**：score.js 改逐键兜底 `ctx.settings?.preferredBonus ?? DEFAULT_SETTINGS.preferredBonus`（每键独立 ??）；同时补部分键传入的测试用例钉住
- **启示**：凡消费「带默认值的配置对象」，不要整体解构一把 ?? 兜底——逐键 ?? 才免疫部分缺键；有 merge 层的配置数据只对走 merge 的路径成立，调用边界（测试、新入口）常直接传局部对象

## 29. overflow:auto 滚动容器内 flex 纵向子项默认 flex-shrink 压缩 → 内容静默截断且滚动条不出现

- **报错**：设置页矮视口下卡片中部内容（参数行）被截断；滚动条不出现、滚不动；`scrollHeight === clientHeight` 但内容明明超高
- **场景**：`.set-groups { display:flex; flex-direction:column }` 容器（父链 flex:1; min-height:0; overflow-y:auto）内放多张白卡 `.set-group`（高约 700px 内容 vs 437px 可视），卡内 `overflow:hidden`
- **根因**：flex 纵向容器主轴子项默认 `flex-shrink:1`——容器有确定高度（flex 布局定死）而子项总高超出时，flex 把子项**等比压缩变矮**而非溢出：卡被压扁、内容超出卡盒被 `overflow:hidden` 裁掉；压缩不产生溢出量，滚动容器 `scrollHeight` 不增长 → 无滚动条、中部内容（非底部）不可达。大视口下内容恰 ≤ 可视时不触发，只在窗口变矮时静默出现，极易误判为「卡片高度/布局 bug」
- **解决**：滚动容器内 flex 纵向子项一律禁收缩 `.set-group { flex:none }`（或容器改 block，子项自然高触发滚动）
- **启示**：凡是「固定高 + overflow auto」的容器，内部 flex 布局的**子项必须显式 flex:none/0**；排查「内容截断但无滚动条/滚不动」先量 scrollHeight vs clientHeight，相等且内容超即查 flex-shrink 压缩（压缩态下 scrollHeight 恒等于可视高）

## 30. `Number(x) || 默认值` 兜底会吞合法输入 0

- **报错**：设置页「高强度次数上限」填 0（合法语义 = 禁排高强度），保存后仍存 2（默认值）
- **场景**：配置项保存逻辑 `Math.max(0, Number(input.value) || DEFAULT)`——本项目同类写法第二次出现（首次在 createStaff 修过 `|| 1` 吞 0，此次是 settingsDialog 保存路径漏网）
- **根因**：`0 || default` 恒取 default（0 是 falsy）——「空值回退」的正确判定不能靠 truthiness，0 是合法业务值
- **解决**：显式判空再取数 `value.trim() !== '' && Number.isFinite(n) ? Math.max(min, n) : DEFAULT`（isFinite 拦 NaN，trim 拦空串）
- **启示**：凡数值输入「空/非法回默认」的兜底一律写成 isFinite + 非空判定；`||` truthiness 兜底只适用于「0 无意义」的字段——先问业务上 0 是否合法再决定兜底写法

## 31. 「内容超高才滚动」的 flex 面板是双向坑：外层 max-height 封顶 + 内层 min-height:0，缺一即静默截断

- **现象**：配置页人员/任务卡片面板（`.cfg-pane`，09-02 批次）——卡片少时面板贴内容高度**无滚动条**；卡片超高时面板封顶、滚动条出现在面板内（`.cfg-pane-body`）。此机制依赖三点，任一点被后续改样式破坏都会**静默**回到「内容截断、无滚动条、滚不动」：
  ① `.cfg-pane { max-height:100% }` 封顶——参照系是定位层 `.cfg-scroll`（flex:1 + min-height:0，高度确定）；
  ② `.cfg-pane-body { flex:1; min-height:0; overflow-y:auto }`——flex column 子项默认 `min-height:auto`（=内容高）会**阻止压缩**：内容超高时 body 压不下去 → 溢出被 `.cfg-pane { overflow:hidden }` 裁掉，且无滚动条；
  ③ `.cfg-scroll` 不再自滚（滚动收进各面板，避免双层滚动条；系统设置 tab 的双 `.set-pane-body` 同理自滚）
- **与 #29 同族相反**：#29 是滚动容器内 flex 子项被 flex-shrink **误压**（子项要 `flex:none` 防压）；本条是滚动层**自己需要被压缩**才能产生滚动（要 `min-height:0` 允许压）。同一个「flex + overflow 滚动」问题的两面，改样式前先分清谁该收缩
- **启示**：实现「内容少自然高、内容多限高内滚」的面板 = 外层 `max-height:100%` 封顶 + 滚动层 `flex:1 / min-height:0 / overflow-y:auto`；排查「该滚不滚、内容被裁」先量 scrollHeight vs clientHeight（被裁态下恒等），再逐层查 flex 链路上 min-height 与 flex-shrink 归属

## 32. 同一业务约束多入口时必须逐口核对拦截：弹窗加「状态提示」不等于「封口」

- **报错**：已满员班次（2/2 人）点卡片打开排班分配弹窗，候选人员行仍显示「＋ 添加」，点击后第 3 人写入、班次超员，无任何提示
- **场景**：周历班次满员（filled >= capacity）后仍可点击打开 scheduleDialog；弹窗满员时在候选区顶部插了一条绿字「本班次已满员」，但候选人员循环照常渲染
- **根因**：同一班次的加人约束共有四个入口——①排班分配弹窗（scheduleDialog）②拖拽（dropStaff）③闪电单班次填充（smartFillOne）④全局智能排班（fillSchedule）。③④②在历次迭代中陆续补齐了「满员拦截」，唯独弹窗改造加「进度条 + 满员态」时漏了封口：加满员绿条时只当「提示」写，没想到它旁边候选行仍在渲染——filterCandidate 只拦硬性规则（疲劳/黑名单/当日上限），**不拦名额**，名额判断是各入口自己的事
- **解决**：scheduleDialog 满员分支只渲染 `asg-full` 绿条、候选行整体不渲染（无「＋ 添加」路径）；移除一人后 renderBody() 重算即恢复（先减后加的人员调整不受影响）。卡片侧满员底部不渲染「已满」容量行（`.full` 绿框视觉已表达）。验收核对基准：改「名额类约束」后 grep 出该班次全部可变入口，逐个验证满员态行为一致
- **启示**：业务约束的「拦截点」≠「提示点」——弹窗里加状态提示（满员绿条/已满徽章）只表达了 UI 说明，不代表该弹窗不再产生数据；任何能写库的入口（弹窗按钮/拖拽/自动填充/导入）都必须自带约束判断，验收反向提问：「是否存在一条路径能违反此约束？」（本次正是第 4 个入口——弹窗——漏判）

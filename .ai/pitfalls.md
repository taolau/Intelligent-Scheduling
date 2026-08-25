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

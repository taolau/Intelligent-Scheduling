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

- **报错**：`Chromium distribution 'chrome' is not found at C:\...\chrome.exe`
- **场景**：需要浏览器手测/交互验证，本机未安装 Google Chrome
- **根因**：Playwright MCP server 以 channel 'chrome' 启动，强制找系统 Chrome；`npx playwright install chrome` 在中国网络下极慢/易卡；项目未声明 playwright 依赖
- **解决**：改用手边系统 Edge（本机已装）：
  - 静态渲染：`msedge --headless=new --disable-gpu --virtual-time-budget=8000 --dump-dom <url>`（file:// 与 http 均可，验证页面不空白/关键 DOM）
  - 交互驱动：`msedge --headless=new --remote-debugging-port=9222 about:blank` + Node 脚本（Node 24 内置 WebSocket）连 CDP，`Runtime.evaluate` 执行真实点击与取值
  - 模拟按键注意：Escape 等需派发到 `document` 且 `bubbles:true`（KeyboardEvent 构造默认不冒泡，派发到子元素收不到 document 监听器）
- **启示**：UI 交互验证优先选本机可用浏览器；CDP 的 Runtime.evaluate 可替代 Playwright 的部分交互测试，且能驱动 file:// 页面

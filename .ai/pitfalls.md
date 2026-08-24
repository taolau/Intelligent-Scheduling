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

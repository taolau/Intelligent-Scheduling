// UI 实测 Excel 导入 fixtures 生成器（node 运行，输出到 excel-import-fixtures/）
// 用途：为 Playwright / 手工回归准备「真实 .xlsx 文件」——单测层（test/excel-import.test.js）用内存 File 直测解析；
//       本脚本产物专测浏览器 UI 链路（文件选择 → importDialog → toast → 配置页重渲染）与 Excel 真实单元格类型（时间序列号）。
// 运行：node docs/脚本/gen-excel-import-fixtures.js   （输出到 docs/脚本/excel-import-fixtures/）
import * as XLSX_NS from 'xlsx-js-style';
const XLSX = XLSX_NS.default ?? XLSX_NS;
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_BASE_COLS, STAFF_BASE_COLS } from '../../src/ui/excel.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'excel-import-fixtures');
mkdirSync(OUT, { recursive: true });

function writeXlsx(aoa, name, tweak) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (tweak) tweak(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  writeFileSync(join(OUT, name), buf);
  console.log('生成', name);
}

// —— 任务 ——
writeXlsx([
  PROJECT_BASE_COLS,
  ['【示例】场地搬运', '1', '3', '2', '7;1', '早;中', '08:00', '18:00', '组长', '示例不导入'],
  ['搬运物资', '', '2', '3', '7;2;4', '中', '09:00', '12:00', '', '轻拿轻放'],
  ['夜间巡逻', '', '99', '-2', '8', '夜班;凌晨', '', '', '', ''], // 超范围疲劳/负人数/星期越界/时段非法标签
  ['值半天', '', '1', '1', '', '自主安排', '08:00', '', '', ''], // timeRange 单边
], 'T01_任务_模板头(含示例+脏数据).xlsx');

writeXlsx([
  ['ID', '名称(必填)', '劳累指数(1-3)', '所需人数(必填)', '重复星期(0-6)', '时段(分号隔开)', '启用(1/0)'],
  ['P101', 'P101 改名', '2', '', '0', '中;晚', '1'],
  ['', '纯新增', '3', '1', '', '早', ''],
], 'T02_任务_旧含ID表头.xlsx');

writeXlsx([['随便', '列'], ['甲', '乙']], 'T03_任务_表头不识别(选错文件).xlsx');

// Excel 原生时间单元格（用户手填 08:00 → Excel 存数字序列号 + 时间格式），raw:false 读回应为 '08:00'
writeXlsx([
  PROJECT_BASE_COLS,
  ['时间任务', '', '1', '1', '1', '早', '08:00', '12:00', '', ''],
], 'T04_任务_时间段时间序列号.xlsx', ws => {
  ws.G2 = { t: 'n', v: 0.3333333333333333, z: 'h:mm' }; // 08:00
  ws.H2 = { t: 'n', v: 0.5, z: 'h:mm' };               // 12:00
});

// —— 人员 ——
writeXlsx([
  STAFF_BASE_COLS,
  ['【示例】张三', '新入', '场地搬运;门口执勤', '场地搬运(体力好,搬运熟练);门口执勤(力气大)', '夜间巡逻(腰伤,不宜搬重物)', '组长;值班', '可用', '周一、周三、周五 09:00-12:00;周日 14:00-18:00', '10', '40', '2', '8'],
  ['李四', '', '场地搬运', '场地搬运()', '', '组长；值班', '不可用', '周三 全天', '', '', '', '0'],
  ['王五', '活跃', '场地搬运;门口执勤', '', '', '', '', '', '', '', '', ''],
], 'S01_人员_模板头(含空原因+全角分号+显式0).xlsx');

writeXlsx([
  STAFF_BASE_COLS,
  ['含括号人', '', '门(岗)执勤', '门(岗)执勤(力气大)', '', '', '', '', '', '', '', ''],
], 'S02_人员_含括号任务名作擅长.xlsx');

writeXlsx([
  STAFF_BASE_COLS,
  ['状态脏人', '不存在的状态', '', '', '', '', '', '', '', '', '', ''],
  ['上限脏人', '', '', '', '', '', '', '', 'abc', '-5', '3.5', ''],
  ['零限人', '', '', '', '', '', '', '', '0', '0', '0', '0'],
], 'S03_人员_非法状态+超范围上限.xlsx');

writeXlsx([
  STAFF_BASE_COLS,
  ['配置好人', '', '场地搬运', '', '', '', '可用', '周一 09:00-12:00', '', '', '', ''],
  ['缺模式', '', '场地搬运', '', '', '', '', '周一 09:00-12:00', '', '', '', ''],
  ['缺时段', '', '场地搬运', '', '', '', '可用', '', '', '', '', ''],
  ['跨日', '', '场地搬运', '', '', '', '可用', '周日 24:00-25:00', '', '', '', ''],
  ['坏模式', '', '场地搬运', '', '', '', '限制', '周一 09:00-12:00', '', '', '', ''],
], 'S04_人员_时间安排非法行.xlsx');

writeXlsx([
  STAFF_BASE_COLS,
  ['同名一号', '', '', '', '', '', '', '', '', '', '', ''],
  ['同名二号', '', '', '', '', '', '', '', '', '', '', ''],
], 'S05_人员_文件内两行(同名各异).xlsx');

// —— .xls 旧格式（BIFF8）：UI 提示「支持 .xlsx / .xls」，验证导入读取链路等价 .xlsx ——
function writeXls(aoa, name) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  const buf = XLSX.write(wb, { bookType: 'xls', type: 'buffer' });
  writeFileSync(join(OUT, name), buf);
  console.log('生成', name);
}
writeXls([
  PROJECT_BASE_COLS,
  ['巡逻站岗', '1', '3', '2', '7', '早;中', '09:00', '12:00', '', '夜间值勤'],
  ['花草浇水', '', '', '', '', '早', '', '', '', ''],
], 'T05_任务_旧格式.xls');

console.log('完成，输出目录：', OUT);

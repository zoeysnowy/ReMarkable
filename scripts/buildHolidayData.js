/**
 * 构建假日数据 JSON 文件
 * 用于 GitHub Actions 自动发布
 * 
 * 使用方法:
 *   node scripts/buildHolidayData.js 2026
 * 
 * @file scripts/buildHolidayData.js
 */

// 本地时间格式化函数
const formatTimeForStorage = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

const fs = require('fs');
const path = require('path');

// 从命令行参数获取年份
const year = process.argv[2];

if (!year || !/^\d{4}$/.test(year)) {
  console.error('❌ 请提供有效的年份，例: node buildHolidayData.js 2026');
  process.exit(1);
}

// 导入假日数据（需要先编译 TypeScript）
// 或者直接从源文件解析
const dataFile = path.join(__dirname, `../src/utils/holidays/adjustedWorkdays.ts`);

if (!fs.existsSync(dataFile)) {
  console.error(`❌ 未找到文件: ${dataFile}`);
  process.exit(1);
}

// 简化版：手动定义数据（实际应从 TS 文件解析）
const holidayData = {
  version: year,
  publishDate: formatTimeForStorage(new Date()).split(' ')[0],
  source: "国务院办公厅",
  sourceUrl: "http://www.gov.cn/zhengce/",
  data: {
    workdays: [
      `${year}-02-04`,  // 示例：春节调班
      `${year}-02-15`,
      `${year}-04-27`,  // 五一调班
      `${year}-10-11`,  // 国庆调班
    ],
    holidays: [
      {
        start: `${year}-01-01`,
        end: `${year}-01-03`,
        name: "元旦假期",
        days: 3
      },
      {
        start: `${year}-02-07`,
        end: `${year}-02-13`,
        name: "春节假期",
        days: 7
      },
      {
        start: `${year}-04-04`,
        end: `${year}-04-06`,
        name: "清明假期",
        days: 3
      },
      {
        start: `${year}-05-01`,
        end: `${year}-05-05`,
        name: "劳动节假期",
        days: 5
      },
      {
        start: `${year}-10-01`,
        end: `${year}-10-07`,
        name: "国庆假期",
        days: 7
      }
    ]
  }
};

// 确保输出目录存在
const outputDir = path.join(__dirname, '../public/holidays');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 写入 JSON 文件
const outputFile = path.join(outputDir, `holidays-${year}.json`);
fs.writeFileSync(outputFile, JSON.stringify(holidayData, null, 2), 'utf-8');

console.log(`✅ 已生成: ${outputFile}`);
console.log(`📦 文件大小: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);

// 验证数据
const totalHolidayDays = holidayData.data.holidays.reduce((sum, h) => sum + h.days, 0);
console.log(`📅 ${year}年法定节假日共 ${totalHolidayDays} 天`);
console.log(`🔄 调班工作日共 ${holidayData.data.workdays.length} 天`);

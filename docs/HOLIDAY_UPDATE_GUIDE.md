# 假日数据更新指南

> 为开发者和维护者提供的完整操作流程

---

## 📋 目录

1. [每年更新流程](#每年更新流程)
2. [测试验证](#测试验证)
3. [发布流程](#发布流程)
4. [用户端体验](#用户端体验)
5. [故障排查](#故障排查)

---

## 🔄 每年更新流程

### 时间节点

**12月中下旬** - 国务院办公厅通常在此时发布下一年度假日安排

### Step 1: 获取官方数据

访问国务院官网：http://www.gov.cn/zhengce/

查找标题类似：
- "国务院办公厅关于2026年部分节假日安排的通知"
- 文号：国办发明电〔2025〕XX号

### Step 2: 更新代码

编辑文件：`src/utils/holidays/adjustedWorkdays.ts`

```typescript
// 添加新一年的数据
export const ADJUSTED_WORKDAYS_2026 = {
  workdays: [
    "2026-02-04",  // 春节调班（周三上班，调周一）
    "2026-02-15",  // 春节调班（周日上班，调周六）
    "2026-04-26",  // 五一调班
    "2026-10-10",  // 国庆调班
  ],
  holidays: [
    { 
      start: "2026-01-01", 
      end: "2026-01-03", 
      name: "元旦假期",
      days: 3
    },
    { 
      start: "2026-02-07", 
      end: "2026-02-13", 
      name: "春节假期",
      days: 7
    },
    { 
      start: "2026-04-04", 
      end: "2026-04-06", 
      name: "清明假期",
      days: 3
    },
    { 
      start: "2026-05-01", 
      end: "2026-05-05", 
      name: "劳动节假期",
      days: 5
    },
    { 
      start: "2026-06-25", 
      end: "2026-06-27", 
      name: "端午假期",
      days: 3
    },
    { 
      start: "2026-10-01", 
      end: "2026-10-08", 
      name: "国庆中秋假期",
      days: 8
    }
  ]
};

// 更新导出函数
export function getAdjustedWorkdays(year: number): AdjustedWorkday | null {
  switch (year) {
    case 2025:
      return ADJUSTED_WORKDAYS_2025;
    case 2026:
      return ADJUSTED_WORKDAYS_2026;  // 🆕 添加这一行
    default:
      return null;
  }
}
```

**注意事项**：
- ✅ 日期格式必须是 `YYYY-MM-DD`
- ✅ 检查闰年（2月29日）
- ✅ 中秋国庆重合的情况
- ✅ 调休日要精确到星期几

---

## ✅ 测试验证

### Step 3: 运行测试

创建测试脚本：`scripts/testHolidayData.js`

```javascript
const { ADJUSTED_WORKDAYS_2026 } = require('../src/utils/holidays/adjustedWorkdays');

console.log('🧪 测试 2026 年假日数据...\n');

// 1. 验证数据结构
if (!ADJUSTED_WORKDAYS_2026.workdays || !ADJUSTED_WORKDAYS_2026.holidays) {
  console.error('❌ 数据结构错误');
  process.exit(1);
}

// 2. 计算总假期天数
const totalDays = ADJUSTED_WORKDAYS_2026.holidays.reduce((sum, h) => {
  const start = new Date(h.start);
  const end = new Date(h.end);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  
  if (days !== h.days) {
    console.warn(`⚠️ ${h.name} 天数不匹配: 计算${days}天, 标注${h.days}天`);
  }
  
  return sum + h.days;
}, 0);

console.log(`📅 法定节假日共 ${totalDays} 天`);
console.log(`🔄 调班工作日共 ${ADJUSTED_WORKDAYS_2026.workdays.length} 天`);

// 3. 验证日期格式
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

ADJUSTED_WORKDAYS_2026.workdays.forEach(date => {
  if (!datePattern.test(date)) {
    console.error(`❌ 调班日期格式错误: ${date}`);
    process.exit(1);
  }
});

ADJUSTED_WORKDAYS_2026.holidays.forEach(h => {
  if (!datePattern.test(h.start) || !datePattern.test(h.end)) {
    console.error(`❌ ${h.name} 日期格式错误`);
    process.exit(1);
  }
});

// 4. 检查日期顺序
ADJUSTED_WORKDAYS_2026.holidays.forEach(h => {
  if (new Date(h.start) > new Date(h.end)) {
    console.error(`❌ ${h.name} 开始日期晚于结束日期`);
    process.exit(1);
  }
});

console.log('\n✅ 所有测试通过！');
```

运行测试：
```bash
node scripts/testHolidayData.js
```

### Step 4: 本地验证

在应用中手动测试：

```typescript
// 在浏览器控制台运行
import { isWorkday } from '@/utils/holidays';

// 测试调班日（应该返回 true）
console.log(isWorkday(new Date('2026-02-04'))); // true - 调班日

// 测试假期（应该返回 false）
console.log(isWorkday(new Date('2026-02-10'))); // false - 春节

// 测试普通工作日（应该返回 true）
console.log(isWorkday(new Date('2026-03-16'))); // true - 周一

// 测试普通周末（应该返回 false）
console.log(isWorkday(new Date('2026-03-21'))); // false - 周六
```

---

## 🚀 发布流程

### Step 5: 提交代码

```bash
# 添加修改
git add src/utils/holidays/adjustedWorkdays.ts

# 提交
git commit -m "feat: 添加2026年假日安排

- 元旦假期：1月1-3日（3天）
- 春节假期：2月7-13日（7天）
- 清明假期：4月4-6日（3天）
- 劳动节假期：5月1-5日（5天）
- 端午假期：6月25-27日（3天）
- 国庆中秋假期：10月1-8日（8天）
- 调班工作日：2月4日、2月15日、4月26日、10月10日

数据来源：国务院办公厅〔2025〕XX号
"

# 推送到主分支
git push origin master
```

### Step 6: 创建发布标签

```bash
# 创建标签
git tag holidays-2026 -m "2026年假日安排

根据国务院办公厅通知发布

总计法定节假日: 29天
调班工作日: 4天
"

# 推送标签（触发 GitHub Actions）
git push origin holidays-2026
```

### Step 7: 自动发布

GitHub Actions 会自动：
1. ✅ 构建 `holidays-2026.json` 文件
2. ✅ 创建 GitHub Release
3. ✅ 上传 JSON 文件到 Release
4. ✅ 生成发布说明

**查看发布**：
- 访问 https://github.com/zoeysnowy/ReMarkable/releases
- 找到 "2026年假日安排" Release
- 确认 JSON 文件已上传

---

## 👥 用户端体验

### Step 8: 用户自动收到更新

**时间线**：

```
Day 1 (12月20日)
  └─ 开发者推送 holidays-2026 标签
      └─ GitHub Actions 自动发布

Day 2-7 (用户下次启动应用)
  └─ 应用后台检查更新
      └─ 发现新版本
          └─ 显示通知横幅

用户点击"立即更新"
  └─ 下载 holidays-2026.json (约 5KB)
      └─ 合并到 localStorage
          └─ 显示"✅ 2026年假日数据已更新"
```

**用户看到的通知**：

```
┌────────────────────────────────────────┐
│ 🎉  2026年假日安排                      │
│     已发布，点击更新                     │
│                                        │
│  [立即更新]  [稍后提醒]                  │
└────────────────────────────────────────┘
```

**更新后的效果**：

日历中会显示：
- 🧧 春节假期（2月7-13日）
- 🇨🇳 国庆假期（10月1-8日）
- "休" 标记在非工作日
- 调班日没有"休"标记

---

## 🔧 故障排查

### 问题 1: GitHub Actions 失败

**症状**：推送标签后没有创建 Release

**排查**：
1. 访问 GitHub → Actions 标签
2. 查看失败的工作流
3. 检查日志输出

**常见原因**：
- ❌ `scripts/buildHolidayData.js` 语法错误
- ❌ 标签格式不正确（必须是 `holidays-YYYY`）
- ❌ `GITHUB_TOKEN` 权限不足

**解决**：
```bash
# 删除错误的标签
git tag -d holidays-2026
git push origin :refs/tags/holidays-2026

# 修复问题后重新创建
git tag holidays-2026
git push origin holidays-2026
```

### 问题 2: 用户没有收到更新

**症状**：用户报告看不到新年份假日

**排查**：
1. 检查 Release 是否成功发布
2. 检查 JSON 文件是否可访问
3. 查看浏览器控制台是否有错误

**手动触发检查**：
```javascript
// 在控制台运行
import { holidayUpdateManager } from '@/utils/holidays/updateManager';

const update = await holidayUpdateManager.checkForUpdates();
console.log(update);
```

### 问题 3: 数据不准确

**症状**：用户反馈某天显示错误

**排查**：
1. 对比国务院官网通知
2. 检查 `adjustedWorkdays.ts` 数据
3. 运行测试脚本验证

**快速修复**：
```bash
# 修复数据
vim src/utils/holidays/adjustedWorkdays.ts

# 重新发布（使用 -f 强制覆盖）
git tag -f holidays-2026
git push -f origin holidays-2026
```

---

## 📊 发布清单

发布前确认：

- [ ] ✅ 数据来源：国务院办公厅官网
- [ ] ✅ 假期天数：总计29天左右
- [ ] ✅ 调班日期：与通知一致
- [ ] ✅ 日期格式：YYYY-MM-DD
- [ ] ✅ 测试通过：运行 `testHolidayData.js`
- [ ] ✅ 代码提交：commit message 清晰
- [ ] ✅ 标签格式：holidays-YYYY
- [ ] ✅ Actions 成功：绿色勾
- [ ] ✅ Release 可见：文件可下载
- [ ] ✅ 本地测试：手动触发更新检查

---

## 🎉 总结

**开发者工作量**：约 15 分钟
- 5分钟：获取官方数据
- 5分钟：更新代码 + 测试
- 5分钟：提交 + 发布

**用户体验**：
- ✅ 自动收到通知
- ✅ 一键更新（5KB 下载）
- ✅ 无需重启应用
- ✅ 离线继续可用

**维护成本**：
- 每年 1 次更新
- 无需额外服务器
- 完全免费

---

**最后更新**: 2025-11-11  
**维护者**: Zoey

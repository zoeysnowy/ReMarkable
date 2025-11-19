# 自然语言时间词典参考文档
## Natural Language Time Dictionary Reference

> **版本**: v2.10.1  
> **更新**: 2025-11-17  
> **状态**: ✅ 已移除 chrono-node 依赖，使用本地词典

---

## 📋 概述 Overview

ReMarkable 内置完整的中英文自然语言时间解析引擎，支持：

- ✅ **基础相对日期**：今天/明天/后天 & today/tomorrow/day after tomorrow
- ✅ **星期表达**：完整和缩写形式（Monday/Mon, 周一等）
- ✅ **月份+日期表达**：本月15号、下个月3号、上月20号 🆕 v2.10.1
- ✅ **时间段表达**：上午/下午/晚上 & morning/afternoon/evening
- ✅ **日期范围**：周末/本周/下周 & weekend/this week/next week
- ✅ **组合表达**：明天下午2点、下个月3号下午5点 🆕 v2.10.1
- ✅ **精确日期+精确时间**：下周三9点、明天8点半、后天14:30 🆕 v2.10.2

---

## 🌍 全球化支持 Global Markets

### 支持的语言 Supported Languages

| 语言 Language | 状态 Status | 示例 Examples |
|--------------|------------|--------------|
| 简体中文 | ✅ Full | 今天、明天、后天、下周一、上午 |
| English | ✅ Full | today, tomorrow, next Monday, morning |
| 繁体中文 | ⚠️ Partial | 後天、下週 |

---

## 📅 基础相对日期 Basic Relative Dates

### 中文表达

| 词汇 | 含义 | 英文等价 |
|------|------|---------|
| 今天 / 今日 | 当天 | today |
| 明天 / 明日 | 后一天 | tomorrow |
| 后天 / 後天 | 后两天 | day after tomorrow |
| 大后天 | 后三天 | 3 days later |
| 昨天 / 昨日 | 前一天 | yesterday |
| 前天 | 前两天 | day before yesterday |
| 大前天 | 前三天 | 3 days ago |

### 英文表达

| Expression | Meaning | 中文等价 |
|-----------|---------|---------|
| today | Current day | 今天 |
| tomorrow | Next day | 明天 |
| day after tomorrow | 2 days later | 后天 |
| 3 days later | 3 days from now | 大后天 |
| yesterday | Previous day | 昨天 |
| day before yesterday | 2 days ago | 前天 |
| 3 days ago | 3 days before | 大前天 |
| 1 day later | Tomorrow | 明天 |
| 1 day ago | Yesterday | 昨天 |
| 2 days later | Day after tomorrow | 后天 |
| 2 days ago | Day before yesterday | 前天 |

---

## 📆 星期表达 Weekday Expressions

### 下周系列 Next Week Series

| 中文 | 英文完整 | 英文缩写 |
|------|---------|---------|
| 下周一 | next monday | next mon |
| 下周二 | next tuesday | next tue |
| 下周三 | next wednesday | next wed |
| 下周四 | next thursday | next thu |
| 下周五 | next friday | next fri |
| 下周六 | next saturday | next sat |
| 下周日 | next sunday | next sun |

### 本周系列 This Week Series

| 中文 | 英文完整 | 英文缩写 | 单独使用 |
|------|---------|---------|---------|
| 本周一 | this monday | this mon | monday / mon |
| 本周二 | this tuesday | this tue | tuesday / tue |
| 本周三 | this wednesday | this wed | wednesday / wed |
| 本周四 | this thursday | this thu | thursday / thu |
| 本周五 | this friday | this fri | friday / fri |
| 本周六 | this saturday | this sat | saturday / sat |
| 本周日 | this sunday | this sun | sunday / sun |

> **注意**: 单独使用"Monday"时，如果今天不是周一，会解析为下一个周一

### 上周系列 Last Week Series

| 中文 | 英文完整 | 英文缩写 |
|------|---------|---------|
| 上周一 | last monday | last mon |
| 上周二 | last tuesday | last tue |
| 上周三 | last wednesday | last wed |
| 上周四 | last thursday | last thu |
| 上周五 | last friday | last fri |
| 上周六 | last saturday | last sat |
| 上周日 | last sunday | last sun |

---

## ⏰ 时间段表达 Time Period Expressions

### 一天中的时段 Periods of Day

| 中文 | 英文 | 时间范围 Time Range |
|------|------|-------------------|
| 凌晨 | - | 00:00-05:00 |
| 清晨 | - | 05:00-07:00 |
| 早上 / 早晨 | morning | 06:00-09:00 |
| 上午 | morning / am | 06:00-12:00 |
| 中午 / 午间 | noon | 11:00-13:00 |
| 午休 | lunch break | 12:00-13:30 |
| 下午 / 午后 | afternoon / pm | 12:00-18:00 |
| 傍晚 / 黄昏 | - | 17:00-19:00 |
| 晚上 / 今晚 | evening / night | 18:00-22:00 |
| 夜间 | night | 20:00-23:59 |
| 深夜 | - | 22:00-02:00 |

### 组合时间段表达 Combined Expressions

| 中文 | 英文 |
|------|------|
| 今晚 | tonight |
| - | this morning |
| - | this afternoon |
| - | this evening |
| - | tomorrow morning |
| - | tomorrow afternoon |
| - | tomorrow evening |
| - | tomorrow night |

### 特殊时间点 Special Time Points

| 中文 | 英文 | 时间 |
|------|------|------|
| 零点 | midnight | 00:00 |
| - | noon | 12:00 |

---

## 📊 日期范围表达 Date Range Expressions

### 周相关 Week-related

| 中文 | 英文 | 含义 |
|------|------|------|
| 周末 / 这周末 / 本周末 | weekend / this weekend | 本周六日 |
| 下周末 | next weekend | 下周六日 |
| 周中 / 本周中 | - | 本周二三四 |
| 下周中 | - | 下周二三四 |
| 本周 / 这周 | this week / current week | 本周一到周日 |
| 下周 / 下礼拜 | next week / nxt wk | 下周一到周日 |
| - | last week | 上周一到周日 |

### 月相关 Month-related

| 中文 | 英文 | 含义 |
|------|------|------|
| 本月 / 这个月 | this month / current month | 本月1号到月底 |
| 下月 / 下个月 | next month | 下月1号到月底 |
| - | last month | 上月1号到月底 |

### 工作日相关 Workday-related

| 中文 | 英文 | 含义 |
|------|------|------|
| 工作日 / 下个工作日 | weekday / next weekday | 下一个非周末的日期 |
| 上班时间 / 工作时间 | work hours / office hours | 09:00-18:00 |

### 时间范围 Time Ranges

| 中文 | 英文 |
|------|------|
| 三天内 | in 3 days / within 3 days |
| - | next 7 days |

---

## 📌 特殊日期 Special Dates

### 月相关 Month-related

| 中文 | 英文 | 含义 |
|------|------|------|
| 月底 | end of month / eom | 当月最后一天 |
| 月初 | beginning of month / bom | 当月1号 |
| 月中 | middle of month / mom | 当月15号 |

### 年相关 Year-related

| 中文 | 英文 | 含义 |
|------|------|------|
| 今年 | this year | 今年1月1日 |
| 明年 | next year / ny | 明年1月1日 |
| 后年 | year after next | 后年1月1日 |
| 去年 | last year | 去年1月1日 |
| 年底 | end of year / eoy | 今年12月31日 |

### 季度相关 Quarter-related

| 中文 | 英文 | 含义 |
|------|------|------|
| 季末 | end of quarter / eoq | 当季度最后一天 |

### 项目相关 Project-related

| 中文 | 英文 | 含义 |
|------|------|------|
| 周报日 / 周报 | weekly report | 本周或下周五 |
| - | ddl / deadline | 截止时间标识 |

---

## 🔗 组合表达 Combined Expressions

### 🆕 v2.10.1: 月份+日期表达 Month Day Expressions

#### 支持的模式 Supported Patterns

| 模式 Pattern | 示例 Examples | 说明 Description |
|-------------|--------------|-----------------|
| 本月 + 日期号 | 本月3号、本月15号、本月28号 | 当前月份的指定日期 |
| 这个月 + 日期号 | 这个月10号、这个月20号 | 同"本月" |
| 下月 + 日期号 | 下月3号、下月15号 | 下一个月的指定日期 |
| 下个月 + 日期号 | 下个月5号、下个月20号 | 同"下月" |
| 上月 + 日期号 | 上月10号、上月25号 | 上一个月的指定日期 |
| 上个月 + 日期号 | 上个月8号、上个月30号 | 同"上月" |

**日期号支持**：
- 阿拉伯数字：1-31
- 中文数字：一号、三号、十五号、二十八号

**组合使用**（日期 + 时间）：

```
下个月3号下午5点
本月15号上午10点
下月20号晚上8点半
上个月5号中午12点
```

### 🎯 精确日期+精确时间表达 Exact Date + Exact Time 🆕 v2.10.2

#### 支持的模式 Supported Patterns

**基本格式**: `精确日期 + 精确时间点`

| 日期部分 | 时间部分 | 完整示例 |
|----------|----------|----------|
| 下周三 | 9点 | 下周三9点 |
| 明天 | 8点半 | 明天8点半 |
| 后天 | 14:30 | 后天14:30 |
| 大后天 | 22点一刻 | 大后天22点一刻 |
| 下周五 | 10点45分 | 下周五10点45分 |

**时间格式支持**:
- `数字点`: 9点、22点
- `数字点半`: 8点半、14点半
- `数字点一刻`: 9点一刻 (15分)
- `数字点三刻`: 10点三刻 (45分)
- `数字点数字分`: 8点30分
- `数字:数字`: 14:30、22:15

**解析示例** (假设今天是2025-11-19):

| 输入 Input | 解析结果 Result |
|-----------|----------------|
| 下周三9点 | 2025-11-26 09:00 |
| 明天8点半 | 2025-11-20 08:30 |
| 后天14:30 | 2025-11-21 14:30 |
| 大后天22点一刻 | 2025-11-22 22:15 |
| 下周五10点45分 | 2025-11-28 10:45 |

**解析示例**：

| 输入 Input | 今天是 Today | 解析结果 Result |
|-----------|-------------|---------------|
| 下个月3号 | 2025-11-17 | 2025-12-03 00:00 |
| 下个月3号下午5点 | 2025-11-17 | 2025-12-03 17:00 |
| 本月25号 | 2025-11-17 | 2025-11-25 00:00 |
| 上月10号 | 2025-11-17 | 2025-10-10 00:00 |

---

### 示例 Examples

#### 中文组合

```
明天下午
后天上午
周末上午
下周中下午
本周末晚上
工作日中午
后天下午2点
明天晚上8点半
下个月3号下午5点  🆕 v2.10.1
本月15号上午10点  🆕 v2.10.1
下周三9点  🆕 v2.10.2
明天8点
后天10点半  🆕 v2.10.2
大后天14:30  🆕 v2.10.2
```

#### 英文组合

```
tomorrow afternoon
next Monday morning
this weekend evening
next Friday at 3pm
Monday morning
tonight at 8
next week afternoon
```

### 精确时间表达 Precise Time Expressions

| 格式 Format | 示例 Examples |
|------------|--------------|
| [日期] + [时间段] + [精确时间] | 明天下午3点、next Monday at 2pm |
| [日期] + [精确时间] | 后天14:30、Friday 3:00 |
| [时间段] + [精确时间] | 下午3点半、afternoon 3:30 |

---

## 🎯 使用场景 Use Cases

### 1. DateMention 元素

用户在编辑器中输入：
- "明天下午2点开会" → 自动识别并高亮"明天下午2点"
- "next Monday at 3pm review" → 自动识别并高亮"next Monday at 3pm"

### 2. 快速创建事件

用户输入：
- "后天上午团建" → 创建事件，时间为后天09:00
- "Friday afternoon meeting" → 创建事件，时间为本周五14:00
- "下周三9点开会" → 创建事件，时间为下周三09:00
- "明天8点半晨跑" → 创建事件，时间为明天08:30

### 3. TimeHub 时间同步

- 检测到"明天"与 TimeHub 时间不一致时，显示红色提示
- 支持一键更新为当前 TimeHub 时间

---

## 📝 开发者参考 Developer Reference

### API 使用

```typescript
import { parseNaturalLanguage } from './utils/naturalLanguageTimeDictionary';
import { parseNaturalDate } from './utils/dateParser';

// 方式1: 使用本地词典（推荐）
const result = parseNaturalLanguage('明天下午2点');
if (result.matched && result.pointInTime) {
  console.log(result.pointInTime.date); // Dayjs 对象
  console.log(result.pointInTime.displayHint); // "明天"
}

// 方式2: 使用 dateParser（兼容旧代码）
const parsed = parseNaturalDate('next Monday at 3pm');
if (parsed) {
  console.log(parsed.start); // Date 对象
  console.log(parsed.displayText); // "next monday"
  console.log(parsed.timePeriod); // "afternoon"
}
```

### 词典结构

```typescript
// POINT_IN_TIME_DICTIONARY: 精确时间点
{
  '明天': (ref) => ({ date, displayHint, isFuzzyDate }),
  'tomorrow': (ref) => ({ date, displayHint, isFuzzyDate })
}

// DATE_RANGE_DICTIONARY: 日期范围
{
  '周末': (ref) => ({ start, end, displayHint, isFuzzyDate }),
  'weekend': (ref) => ({ start, end, displayHint, isFuzzyDate })
}

// TIME_PERIOD_DICTIONARY: 时间段
{
  '上午': { name, startHour, startMinute, endHour, endMinute, isFuzzyTime },
  'morning': { name, startHour, startMinute, endHour, endMinute, isFuzzyTime }
}
```

---

## 🔄 版本历史 Version History

### v2.8 (2024-11-14)
- ✅ 移除 chrono-node 依赖
- ✅ 添加完整的英文自然语言支持
- ✅ 添加所有星期的完整和缩写形式
- ✅ 添加 last week/month 表达
- ✅ 添加组合时间段表达（tonight, this morning 等）
- ✅ 支持全球化市场

### v2.7 (Previous)
- ✅ 支持截止时间关键词（ddl, deadline）
- ✅ 支持精确时间+模糊时间段组合
- ✅ 优化时间段默认时间映射

---

## 🌟 最佳实践 Best Practices

### 1. 优先使用本地词典
```typescript
// ✅ 推荐
import { parseNaturalLanguage } from './utils/naturalLanguageTimeDictionary';

// ❌ 不推荐（已废弃 chrono-node）
import * as chrono from 'chrono-node';
```

### 2. 处理多语言环境
```typescript
// 自动检测语言并解析
const input = userInput.trim().toLowerCase();
const result = parseNaturalLanguage(input);

if (result.matched) {
  // 成功解析，支持中英文
  console.log('Parsed:', result);
} else {
  // 无法识别，提示用户
  console.log('Unsupported expression');
}
```

### 3. 全球化 UI
```typescript
// 显示文本使用 displayHint
if (result.pointInTime) {
  const displayText = result.pointInTime.displayHint; // "tomorrow" 或 "明天"
  // 直接显示给用户，保持原始语言
}
```

---

## 📞 支持 Support

如需添加更多语言或表达方式，请参考：
- `src/utils/naturalLanguageTimeDictionary.ts`
- `src/utils/dateParser.ts`

**贡献指南**: 欢迎提交 PR 添加更多语言支持！

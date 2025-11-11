# 节日与假期识别功能

> **版本**: v2.2  
> **更新时间**: 2025-11-11  
> **状态**: ✅ 设计完成，包含自动更新机制

---

## 📋 功能概述

为 ReMarkable 时间选择器添加**节日和国定假期智能识别**功能，提升用户体验。

### ✨ 核心特性

- **🎉 节日识别**: 支持中国传统节日、国际节日、特殊日期
- **🏖️ 法定假期**: 内置中国法定节假日和调休日历
- **🌐 离线可用**: 无需外部 API，所有数据本地存储
- **🎨 日历增强**: 日期单元格显示节日标签和假期标记
- **🔍 自然语言**: 支持"春节"、"中秋节"等直接输入
- **🔄 自动更新**: GitHub Actions 自动推送假日安排更新 🆕

---

## 🎯 为什么不需要外部 API？

### 方案对比

| 对比项 | 外部 API 方案 | 混合方案 ✅ |
|-------|-------------|-----------|
| **网络依赖** | ❌ 必须联网 | ✅ 离线可用（可选更新） |
| **响应速度** | ❌ 网络延迟 | ✅ 即时响应 |
| **稳定性** | ❌ API 可能下线 | ✅ 完全可控 |
| **成本** | ❌ 可能需要付费 | ✅ 零成本 |
| **数据准确性** | ⚠️ 依赖第三方 | ✅ 自主更新 |
| **维护成本** | ✅ 无需维护 | ✅ GitHub Actions 自动化 |
| **用户体验** | ⚠️ 数据可能过期 | ✅ 自动推送更新通知 |
| **农历支持** | ⚠️ API 支持度不一 | ✅ lunar-javascript 强大 |

**推荐方案**: 内置数据 + GitHub 自动更新机制

---

## 🔄 假日安排自动更新方案

### 方案概览

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: 国务院发布假日安排（每年12月）                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Step 2: 开发者/自动脚本更新 GitHub 仓库                │
│  - 更新 adjustedWorkdays.ts                             │
│  - 创建新版本 tag (例: holidays-2026)                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3: GitHub Actions 自动构建                         │
│  - 生成 holidays-2026.json                              │
│  - 发布 GitHub Release                                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Step 4: 应用检查更新（可选，后台执行）                  │
│  - 对比本地版本 vs 远程版本                              │
│  - 如有新版本，显示通知                                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Step 5: 用户点击"更新假日数据"                         │
│  - 下载 holidays-2026.json                               │
│  - 合并到本地 localStorage                               │
│  - 显示更新成功提示                                      │
└─────────────────────────────────────────────────────────┘
```

### 关键设计点

✅ **用户无感知** - 后台检查，有更新才通知  
✅ **离线优先** - 即使不更新也能使用旧数据  
✅ **可选更新** - 用户决定是否下载  
✅ **小文件** - JSON 文件仅 5-10KB  
✅ **安全** - 仅下载数据，不执行代码

---

## 🛠️ 技术方案

### 依赖库

```json
{
  "dependencies": {
    "lunar-javascript": "^1.6.12"  // 农历计算（开源、免费、离线）
  }
}
```

安装命令：
```bash
npm install lunar-javascript --save
```

### 核心文件结构

```
src/utils/holidays/
├── types.ts                    # 类型定义
├── fixedHolidays.ts           # 固定阳历节日（元旦、国庆、圣诞等）
├── lunarHolidays.ts           # 农历节日（春节、中秋、端午等）
├── floatingHolidays.ts        # 浮动日期节日（母亲节、父亲节）
├── adjustedWorkdays.ts        # 法定假期和调休日历
└── index.ts                   # 统一导出
```

---

## 📝 支持的节日类型

### 1️⃣ 固定阳历节日（一次配置永久有效）

```typescript
// 示例：fixedHolidays.ts
export const FIXED_SOLAR_HOLIDAYS = {
  "01-01": { name: "元旦", isHoliday: true, days: 1, emoji: "🎊" },
  "10-01": { name: "国庆节", isHoliday: true, days: 7, emoji: "🇨🇳" },
  "12-25": { name: "圣诞节", isHoliday: false, emoji: "🎄" },
  // ...
};
```

**支持节日**：
- 中国法定：元旦、劳动节、国庆节、清明节
- 国际节日：情人节、圣诞节、妇女节、儿童节等

### 2️⃣ 农历节日（lunar-javascript 自动计算）

```typescript
// 示例：lunarHolidays.ts
import { Lunar } from 'lunar-javascript';

export const LUNAR_HOLIDAYS = {
  "01-01": { name: "春节", isHoliday: true, days: 7, emoji: "🧧" },
  "08-15": { name: "中秋节", isHoliday: true, days: 1, emoji: "🥮" },
  "05-05": { name: "端午节", isHoliday: true, days: 1, emoji: "🚣" },
  // ...
};

// 阳历 → 农历节日
export function getLunarHoliday(date: Date): HolidayInfo | null {
  const lunar = Lunar.fromDate(date);
  const key = `${lunar.getMonth()}-${lunar.getDay()}`;
  return LUNAR_HOLIDAYS[key] || null;
}

// 节日名 → 阳历日期
parseLunarHolidayName("春节", 2025) // → Date(2025-02-10)
```

**支持节日**：
- 春节、元宵节、清明节（农历）
- 端午节、七夕节、中秋节
- 重阳节、腊八节等

### 3️⃣ 浮动日期节日（动态计算）

```typescript
// 示例：floatingHolidays.ts

// 母亲节: 5月第二个周日
function getMothersDay(year: number): Date {
  const may = new Date(year, 4, 1);
  const firstSunday = 7 - may.getDay();
  return new Date(year, 4, firstSunday + 7);
}

// 父亲节: 6月第三个周日
function getFathersDay(year: number): Date {
  const june = new Date(year, 5, 1);
  const firstSunday = 7 - june.getDay();
  return new Date(year, 5, firstSunday + 14);
}
```

**支持节日**：
- 母亲节（5月第二个周日）
- 父亲节（6月第三个周日）
- 感恩节（11月第四个周四）

### 4️⃣ 法定假期和调休（每年更新一次）

```typescript
// 示例：adjustedWorkdays.ts
export const ADJUSTED_WORKDAYS_2025 = {
  // 调班工作日
  workdays: [
    "2025-02-04",  // 春节调班
    "2025-04-27",  // 五一调班
  ],
  
  // 假期范围
  holidays: [
    { start: "2025-02-07", end: "2025-02-13", name: "春节假期" },
    { start: "2025-10-01", end: "2025-10-07", name: "国庆假期" },
  ]
};

// 判断是否为工作日（考虑调休）
export function isWorkday(date: Date): boolean {
  // 检查调班日 → 检查假期 → 检查普通周末
}
```

**维护成本**：每年12月更新一次（约5分钟）

---

## 🎨 使用示例

### 日历显示增强

```tsx
// UnifiedDateTimePicker.tsx
import { getHoliday, getLunarHoliday, isWorkday } from '@/utils/holidays';

function renderDayCell(date: Date) {
  const solarHoliday = getHoliday(date);        // 固定节日
  const lunarHoliday = getLunarHoliday(date);   // 农历节日
  const holiday = solarHoliday || lunarHoliday;
  const workday = isWorkday(date);              // 工作日判断
  
  return (
    <div className={`day-cell ${holiday?.isHoliday ? 'holiday' : ''}`}>
      <span className="day-number">{date.getDate()}</span>
      
      {/* 节日标签 */}
      {holiday && (
        <div className="holiday-label">
          <span className="emoji">{holiday.emoji}</span>
          <span className="name">{holiday.name}</span>
        </div>
      )}
      
      {/* 休息日标记 */}
      {!workday && <span className="rest-indicator">休</span>}
    </div>
  );
}
```

**效果预览**：
```
┌──────────────┬──────────────┬──────────────┐
│  2025-02-10  │  2025-10-01  │  2025-12-25  │
│     10       │      1       │      25      │
│  🧧 春节     │  🇨🇳 国庆节  │  🎄 圣诞节   │
│  假期 7天    │  假期 7天    │              │
└──────────────┴──────────────┴──────────────┘
```

### 自然语言识别

```typescript
// dateParser.ts
import { parseLunarHolidayName, getHolidayByName } from '@/utils/holidays';

parseDateFromNaturalLanguage("春节")    // → Date(2025-02-10)
parseDateFromNaturalLanguage("中秋节")  // → Date(2025-10-06)
parseDateFromNaturalLanguage("圣诞节")  // → Date(2025-12-25)
parseDateFromNaturalLanguage("国庆节")  // → Date(2025-10-01)
```

### 假期提示

```tsx
// PlanManager.tsx 或 EventEditModal.tsx
const holiday = getHoliday(eventDate);

if (holiday?.isHoliday) {
  return (
    <div className="holiday-badge">
      {holiday.emoji} {holiday.name} 假期 {holiday.days}天
    </div>
  );
}
```

---

## 📦 实现步骤

### 步骤 1: 安装依赖
```bash
npm install lunar-javascript --save
```

### 步骤 2: 创建节日数据文件

- [x] `src/utils/holidays/types.ts` - 类型定义
- [x] `src/utils/holidays/fixedHolidays.ts` - 固定节日数据
- [ ] `src/utils/holidays/lunarHolidays.ts` - 农历节日
- [ ] `src/utils/holidays/floatingHolidays.ts` - 浮动节日
- [ ] `src/utils/holidays/adjustedWorkdays.ts` - 调休日历
- [ ] `src/utils/holidays/index.ts` - 统一导出

### 步骤 3: 扩展 dateParser

- [ ] 导入节日工具函数
- [ ] 添加节日识别逻辑
- [ ] 支持节日名称输入

### 步骤 4: 日历显示增强

- [ ] 修改 `UnifiedDateTimePicker.tsx` 的 `renderDayCell`
- [ ] 添加节日标签和假期样式
- [ ] 添加"休"标记

### 步骤 5: CSS 样式

- [ ] 添加 `.day-cell.holiday` 样式
- [ ] 添加 `.holiday-label` 样式
- [ ] 添加 `.rest-indicator` 样式

---

## 🔧 假日数据更新机制

### 方案 A: GitHub 自动更新（推荐）✅

#### 架构设计

```
用户设备（Electron App）
    │
    ├─ 内置数据: holidays-2025.json (初始版本)
    │
    ├─ 本地存储: localStorage['holidayUpdates']
    │   └─ { "2026": {...}, "2027": {...} }
    │
    └─ 更新检查器
        │
        ├─ 每周检查一次远程版本
        │   └─ https://github.com/user/ReMarkable/releases/latest
        │
        └─ 发现新版本 → 显示通知
            │
            └─ 用户点击 → 下载并合并
```

#### 实现步骤

##### 1️⃣ 创建假日数据 JSON 格式

```typescript
// public/holidays/holidays-2026.json
{
  "version": "2026",
  "publishDate": "2025-12-15",
  "source": "国务院办公厅",
  "sourceUrl": "http://www.gov.cn/zhengce/...",
  "data": {
    "workdays": [
      "2026-01-31",  // 春节调班
      "2026-02-08",
      "2026-04-26",  // 五一调班
      "2026-10-10"   // 国庆调班
    ],
    "holidays": [
      {
        "start": "2026-01-01",
        "end": "2026-01-03",
        "name": "元旦假期",
        "days": 3
      },
      {
        "start": "2026-02-01",
        "end": "2026-02-07",
        "name": "春节假期",
        "days": 7
      },
      {
        "start": "2026-04-04",
        "end": "2026-04-06",
        "name": "清明假期",
        "days": 3
      },
      {
        "start": "2026-05-01",
        "end": "2026-05-05",
        "name": "劳动节假期",
        "days": 5
      },
      {
        "start": "2026-06-25",
        "end": "2026-06-27",
        "name": "端午假期",
        "days": 3
      },
      {
        "start": "2026-10-01",
        "end": "2026-10-08",
        "name": "国庆中秋假期",
        "days": 8
      }
    ]
  }
}
```

##### 2️⃣ 创建版本管理器

```typescript
// src/utils/holidays/updateManager.ts

interface HolidayVersion {
  version: string;
  publishDate: string;
  source: string;
  sourceUrl: string;
  data: AdjustedWorkday;
}

class HolidayUpdateManager {
  private static GITHUB_RELEASE_URL = 
    'https://api.github.com/repos/zoeysnowy/ReMarkable/releases/latest';
  
  private static LOCAL_STORAGE_KEY = 'holidayUpdates';
  
  /**
   * 检查是否有新版本
   * @returns 新版本信息或 null
   */
  async checkForUpdates(): Promise<HolidayVersion | null> {
    try {
      // 1. 获取远程版本信息
      const response = await fetch(this.GITHUB_RELEASE_URL);
      const release = await response.json();
      
      // 2. 查找假日数据资产
      const asset = release.assets.find((a: any) => 
        a.name.startsWith('holidays-') && a.name.endsWith('.json')
      );
      
      if (!asset) return null;
      
      // 3. 提取版本号（例: holidays-2026.json → 2026）
      const remoteVersion = asset.name.match(/holidays-(\d{4})\.json/)?.[1];
      if (!remoteVersion) return null;
      
      // 4. 对比本地版本
      const localData = this.getLocalData();
      if (localData[remoteVersion]) {
        console.log(`已有 ${remoteVersion} 年假日数据`);
        return null;
      }
      
      // 5. 下载新版本数据
      const dataResponse = await fetch(asset.browser_download_url);
      const newData: HolidayVersion = await dataResponse.json();
      
      return newData;
    } catch (error) {
      console.error('检查更新失败:', error);
      return null;
    }
  }
  
  /**
   * 安装更新
   * @param versionData 新版本数据
   */
  installUpdate(versionData: HolidayVersion): void {
    const localData = this.getLocalData();
    localData[versionData.version] = versionData.data;
    
    localStorage.setItem(
      HolidayUpdateManager.LOCAL_STORAGE_KEY, 
      JSON.stringify(localData)
    );
    
    console.log(`✅ ${versionData.version} 年假日数据已更新`);
  }
  
  /**
   * 获取本地数据
   */
  private getLocalData(): Record<string, AdjustedWorkday> {
    const stored = localStorage.getItem(HolidayUpdateManager.LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }
  
  /**
   * 获取指定年份的假日数据
   */
  getHolidayData(year: number): AdjustedWorkday | null {
    const localData = this.getLocalData();
    
    // 1. 优先从 localStorage 获取（用户已更新）
    if (localData[year]) {
      return localData[year];
    }
    
    // 2. 回退到内置数据
    if (year === 2025) return ADJUSTED_WORKDAYS_2025;
    if (year === 2026) return ADJUSTED_WORKDAYS_2026; // 如果有内置
    
    return null;
  }
}

export const holidayUpdateManager = new HolidayUpdateManager();
```

##### 3️⃣ 定时检查更新

```typescript
// src/services/HolidayUpdateService.ts

import { holidayUpdateManager } from '@/utils/holidays/updateManager';

export class HolidayUpdateService {
  private static CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7天
  private static LAST_CHECK_KEY = 'lastHolidayUpdateCheck';
  
  /**
   * 启动更新检查（应用启动时调用）
   */
  static async start(): Promise<void> {
    // 检查上次检查时间
    const lastCheck = localStorage.getItem(this.LAST_CHECK_KEY);
    const now = Date.now();
    
    if (lastCheck && now - parseInt(lastCheck) < this.CHECK_INTERVAL) {
      console.log('最近已检查过假日更新，跳过');
      return;
    }
    
    // 后台检查更新
    this.checkAndNotify();
    
    // 记录检查时间
    localStorage.setItem(this.LAST_CHECK_KEY, now.toString());
  }
  
  /**
   * 检查并通知用户
   */
  private static async checkAndNotify(): Promise<void> {
    const newVersion = await holidayUpdateManager.checkForUpdates();
    
    if (newVersion) {
      this.showUpdateNotification(newVersion);
    }
  }
  
  /**
   * 显示更新通知（UI 层实现）
   */
  private static showUpdateNotification(version: HolidayVersion): void {
    // 方式 1: 桌面通知
    if (Notification.permission === 'granted') {
      new Notification('假日数据更新', {
        body: `${version.version}年假日安排已发布，点击更新`,
        icon: '/icon.png'
      });
    }
    
    // 方式 2: 应用内通知
    window.dispatchEvent(new CustomEvent('holiday-update-available', {
      detail: version
    }));
  }
  
  /**
   * 手动下载更新
   */
  static async downloadUpdate(version: HolidayVersion): Promise<boolean> {
    try {
      holidayUpdateManager.installUpdate(version);
      
      // 显示成功提示
      alert(`✅ ${version.version}年假日数据已更新`);
      
      return true;
    } catch (error) {
      console.error('更新失败:', error);
      alert('❌ 更新失败，请稍后重试');
      return false;
    }
  }
}
```

##### 4️⃣ UI 通知组件

```tsx
// src/components/HolidayUpdateBanner.tsx

import React, { useState, useEffect } from 'react';
import { HolidayUpdateService } from '@/services/HolidayUpdateService';

export const HolidayUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<HolidayVersion | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  useEffect(() => {
    const handleUpdate = (e: CustomEvent<HolidayVersion>) => {
      setUpdateAvailable(e.detail);
    };
    
    window.addEventListener('holiday-update-available', handleUpdate as any);
    
    return () => {
      window.removeEventListener('holiday-update-available', handleUpdate as any);
    };
  }, []);
  
  const handleDownload = async () => {
    if (!updateAvailable) return;
    
    setIsUpdating(true);
    const success = await HolidayUpdateService.downloadUpdate(updateAvailable);
    
    if (success) {
      setUpdateAvailable(null);
    }
    setIsUpdating(false);
  };
  
  if (!updateAvailable) return null;
  
  return (
    <div className="holiday-update-banner">
      <div className="banner-content">
        <span className="emoji">🎉</span>
        <div className="text">
          <strong>{updateAvailable.version}年假日安排</strong>
          <span>已发布，点击更新</span>
        </div>
      </div>
      
      <div className="banner-actions">
        <button 
          onClick={handleDownload}
          disabled={isUpdating}
          className="btn-primary"
        >
          {isUpdating ? '更新中...' : '立即更新'}
        </button>
        
        <button 
          onClick={() => setUpdateAvailable(null)}
          className="btn-text"
        >
          稍后提醒
        </button>
      </div>
    </div>
  );
};
```

```css
/* HolidayUpdateBanner.css */
.holiday-update-banner {
  position: fixed;
  top: 16px;
  right: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 9999;
  animation: slideIn 0.3s ease-out;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.emoji {
  font-size: 24px;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  background: white;
  color: #667eea;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.btn-text {
  background: transparent;
  color: white;
  padding: 8px 16px;
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 6px;
  cursor: pointer;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

##### 5️⃣ 应用启动时初始化

```typescript
// src/App.tsx

import { HolidayUpdateService } from '@/services/HolidayUpdateService';
import { HolidayUpdateBanner } from '@/components/HolidayUpdateBanner';

function App() {
  useEffect(() => {
    // 启动假日更新检查
    HolidayUpdateService.start();
  }, []);
  
  return (
    <div className="App">
      <HolidayUpdateBanner />
      {/* 其他组件 */}
    </div>
  );
}
```

---

### 方案 B: 应用内设置手动更新

如果不想自动检查，可以提供手动更新入口：

```tsx
// src/components/Settings/HolidaySettings.tsx

export const HolidaySettings: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<string>('');
  
  const handleCheckUpdate = async () => {
    setIsChecking(true);
    const newVersion = await holidayUpdateManager.checkForUpdates();
    
    if (newVersion) {
      setUpdateInfo(`发现 ${newVersion.version} 年假日数据`);
    } else {
      setUpdateInfo('已是最新版本');
    }
    
    setIsChecking(false);
  };
  
  return (
    <div className="holiday-settings">
      <h3>假日数据管理</h3>
      
      <div className="setting-item">
        <label>当前版本</label>
        <span>2025, 2026</span>
      </div>
      
      <div className="setting-item">
        <label>最后检查时间</label>
        <span>2025-11-11 10:30</span>
      </div>
      
      <button 
        onClick={handleCheckUpdate}
        disabled={isChecking}
        className="btn-check-update"
      >
        {isChecking ? '检查中...' : '检查更新'}
      </button>
      
      {updateInfo && <p className="update-info">{updateInfo}</p>}
    </div>
  );
};
```

---

### 方案 C: GitHub Actions 自动发布

创建 `.github/workflows/publish-holidays.yml`：

```yaml
name: Publish Holiday Data

on:
  push:
    tags:
      - 'holidays-*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      
      - name: Extract version
        id: version
        run: echo "YEAR=${GITHUB_REF#refs/tags/holidays-}" >> $GITHUB_OUTPUT
      
      - name: Build holiday JSON
        run: |
          node scripts/buildHolidayData.js ${{ steps.version.outputs.YEAR }}
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            public/holidays/holidays-${{ steps.version.outputs.YEAR }}.json
          body: |
            ## ${{ steps.version.outputs.YEAR }}年假日安排
            
            根据国务院办公厅通知发布
            
            **包含内容**:
            - 法定节假日安排
            - 调休工作日
            - 假期天数统计
          tag_name: holidays-${{ steps.version.outputs.YEAR }}
```

**使用流程**：
1. 国务院发布假日安排
2. 开发者更新 `adjustedWorkdays.ts`
3. 运行 `git tag holidays-2026 && git push --tags`
4. GitHub Actions 自动构建并发布 Release
5. 用户应用自动检查到更新

---

### 三种方案对比

| 方案 | 用户体验 | 开发成本 | 维护成本 |
|------|---------|---------|---------|
| **A. GitHub 自动更新** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **B. 手动更新** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **C. 应用更新捆绑** | ⭐⭐⭐⭐ | ⭐ | ⭐⭐ |

**推荐**: 方案 A（GitHub 自动更新）

---

## 🔧 维护指南（简化版）

### 每年维护任务（约10分钟）

**时间**: 每年12月，国务院发布下一年度假日安排后

**步骤**:
1. 访问国务院官网获取假日安排
2. 更新 `src/utils/holidays/adjustedWorkdays.ts`
3. 运行测试脚本验证数据
4. 创建 Git tag: `git tag holidays-2026`
5. 推送到 GitHub: `git push --tags`
6. GitHub Actions 自动发布
7. 用户自动收到更新通知

**无需做的**:
- ❌ 手动构建应用
- ❌ 分发更新包
- ❌ 通知用户

---
  ]
};
```

### 农历节日（无需维护）

`lunar-javascript` 库自动计算，永久有效。

### 固定节日（一次配置）

初始设置后无需维护，除非：
- 国家新增法定节假日
- 用户反馈需要添加新的国际节日

---

## 🎉 总结

### 优势

✅ **离线可用** - 无需网络，随时可用  
✅ **零成本** - 无需购买 API 服务  
✅ **高性能** - 本地计算，即时响应  
✅ **可控性强** - 数据完全自主管理  
✅ **农历支持** - lunar-javascript 强大可靠  

### 维护成本

⚠️ 每年12月更新调休数据（**约5分钟**）

### 扩展性

🔮 未来可支持：
- 自定义节日（生日、纪念日）
- 多国节日切换
- 节日提醒功能
- 节日倒计时

---

## 📚 参考资料

- [lunar-javascript GitHub](https://github.com/6tail/lunar-javascript)
- [国务院办公厅节假日安排通知](http://www.gov.cn/)
- 完整设计文档: `docs/PRD/TIME_PICKER_AND_DISPLAY_PRD.md` § 0.9

---

**最后更新**: 2025-11-11  
**设计版本**: v2.1  
**实现状态**: 待开发

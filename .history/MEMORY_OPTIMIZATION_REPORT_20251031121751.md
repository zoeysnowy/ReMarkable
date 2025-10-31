# 内存优化报告 - ReMarkable Electron 应用

## 问题概述
应用占用 5GB 内存，远超正常范围。

## 已发现的内存泄漏源

### 1. **大量 Console.log 调试语句** ⚠️ HIGH PRIORITY
**影响**: Console 历史会保存所有日志，无法被垃圾回收
**位置**:
- `src/utils/dateParser.ts` - 已修复 ✅
- `src/services/ActionBasedSyncManager.ts` - 100+ console.log
- `src/pages/DesktopCalendarWidget.tsx` - 50+ console.log  
- `src/services/EventService.ts` - 30+ console.log

**修复建议**:
```typescript
// 创建开发环境日志工具
const isDev = process.env.NODE_ENV === 'development';
const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  warn: (...args: any[]) => isDev && console.warn(...args),
  error: (...args: any[]) => console.error(...args), // 错误总是显示
};

// 使用 logger 替代 console
logger.log('[Sync] Starting...'); // 仅开发环境输出
```

### 2. **定时器未清理** ⚠️ HIGH PRIORITY
**检测到的定时器**:
- `TimeCalendar.tsx` - `setInterval(checkTimer, 2000)` (Line 232)
- `TagManager.tsx` - `setInterval(() => {...}, 100)` (Line 276)
- `UltimateDateTimeRangePicker.tsx` - `setInterval(hijackTimeColumns, 100)` (Line 97)
- `AppLayout.tsx` - `setInterval(updateText, 30000)` (Line 442)

**问题**: 某些 useEffect 可能未正确返回清理函数

**修复模式**:
```typescript
useEffect(() => {
  const intervalId = setInterval(() => {
    // 定时任务
  }, 1000);
  
  // ✅ 必须返回清理函数
  return () => clearInterval(intervalId);
}, [dependencies]);
```

### 3. **事件监听器未移除** ⚠️ MEDIUM PRIORITY  
**检测到的监听器**:
- `window.addEventListener('storage', ...)` - TimeCalendar.tsx:260
- `window.addEventListener('action-sync-completed', ...)` - TimeCalendar.tsx:584
- `document.addEventListener('mousedown', ...)` - 多个组件
- `document.addEventListener('selectionchange', ...)` - TagManager.tsx:1057

**修复模式**:
```typescript
useEffect(() => {
  const handler = (e: Event) => { /* ... */ };
  window.addEventListener('storage', handler);
  
  // ✅ 必须移除监听器
  return () => window.removeEventListener('storage', handler);
}, []);
```

### 4. **LocalStorage 数据累积** ⚠️ MEDIUM PRIORITY
**问题**: 
- 同步队列、事件数据、日志统计不断累积
- 未设置数据过期时间
- 未限制数据量

**诊断脚本**:
```javascript
// 在浏览器控制台运行
let totalSize = 0;
let largestKeys = [];
for (let key in localStorage) {
  if (localStorage.hasOwnProperty(key)) {
    const size = localStorage[key].length;
    totalSize += size + key.length;
    largestKeys.push({ key, size });
  }
}
largestKeys.sort((a, b) => b.size - a.size);
console.log('localStorage总大小:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
console.log('最大的10个键:', largestKeys.slice(0, 10));
```

**修复建议**:
```typescript
// 在 ActionBasedSyncManager.ts 中添加数据清理
private cleanupOldData() {
  // 1. 限制 actionQueue 大小
  if (this.actionQueue.length > 1000) {
    this.actionQueue = this.actionQueue.slice(-1000);
  }
  
  // 2. 清理超过30天的日志
  const logs = JSON.parse(localStorage.getItem('sync_logs') || '[]');
  const now = Date.now();
  const filtered = logs.filter((log: any) => 
    now - new Date(log.timestamp).getTime() < 30 * 24 * 60 * 60 * 1000
  );
  localStorage.setItem('sync_logs', JSON.stringify(filtered));
  
  // 3. 压缩存储
  // 考虑使用 lz-string 库压缩大型 JSON 数据
}
```

### 5. **React 组件未优化** ⚠️ LOW PRIORITY
**问题**:
- TimeCalendar 组件非常复杂，多个 useEffect
- 可能存在不必要的重渲染

**修复建议**:
```typescript
// 1. 使用 React.memo 包装子组件
export const EventCard = React.memo(({ event }: Props) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.event.id === nextProps.event.id &&
         prevProps.event.updatedAt === nextProps.event.updatedAt;
});

// 2. 使用 useMemo 缓存计算结果
const filteredEvents = useMemo(() => {
  return events.filter(e => e.date === selectedDate);
}, [events, selectedDate]);

// 3. 使用 useCallback 稳定函数引用
const handleClick = useCallback((id: string) => {
  // ...
}, []);
```

## 立即行动计划

### Phase 1: 紧急修复 (今天完成)
1. ✅ 移除 dateParser.ts 中的所有 console.log
2. ⬜ 移除生产环境的所有 console.log (使用 logger 工具)
3. ⬜ 检查所有 setInterval/setTimeout 是否有清理函数
4. ⬜ 检查所有 addEventListener 是否有移除函数

### Phase 2: 数据管理 (本周完成)
1. ⬜ 实现 localStorage 数据清理策略
2. ⬜ 限制 actionQueue 和 conflictQueue 大小
3. ⬜ 添加数据压缩 (考虑 lz-string)
4. ⬜ 实现定期清理过期数据的后台任务

### Phase 3: 性能优化 (下周完成)
1. ⬜ 使用 React.memo 优化组件
2. ⬜ 分析并优化 TimeCalendar 组件
3. ⬜ 实现虚拟滚动（如果事件列表很长）
4. ⬜ 使用 Chrome DevTools 的 Memory Profiler 验证修复效果

## 内存监控工具

### 添加到应用中的监控代码:
```typescript
// src/utils/memoryMonitor.ts
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private intervalId?: NodeJS.Timeout;

  static getInstance() {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  start() {
    // 仅在开发环境启用
    if (process.env.NODE_ENV !== 'development') return;

    this.intervalId = setInterval(() => {
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize / 1048576;
        const total = performance.memory.totalJSHeapSize / 1048576;
        console.log(`[Memory] Used: ${used.toFixed(2)}MB / ${total.toFixed(2)}MB`);
        
        // 内存超过阈值时发出警告
        if (used > 500) {
          console.warn(`⚠️ Memory usage is high: ${used.toFixed(2)}MB`);
        }
      }
    }, 30000); // 每30秒检查一次
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

// 在 App.tsx 中启动
useEffect(() => {
  const monitor = MemoryMonitor.getInstance();
  monitor.start();
  return () => monitor.stop();
}, []);
```

## 验证修复效果

### 使用 Chrome DevTools:
1. 打开 DevTools → Memory 标签
2. 执行 "Take heap snapshot"
3. 使用应用 5-10 分钟
4. 再次 "Take heap snapshot"
5. 对比两个快照，查看内存增长

### 关键指标:
- **JS Heap Size**: 应该 < 500MB
- **Detached DOM Nodes**: 应该接近 0
- **Event Listeners**: 应该稳定，不持续增长

## 预期结果
完成所有修复后，内存占用应该降至：
- **空闲状态**: 100-200 MB
- **活跃使用**: 200-400 MB
- **峰值**: < 500 MB

---
**生成时间**: 2025-10-31
**当前状态**: Phase 1 - 部分完成

import * as Y from 'yjs';
import { encodeStateAsUpdate, applyUpdate, encodeStateVector } from 'yjs';
import type { Event } from '../types';
import dayjs from 'dayjs';
import { formatTimeForStorage } from '../utils/timeUtils';

// ==================== 类型定义 ====================

interface BaseSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  items: Event[];
  version: number;
  ydocState?: Uint8Array; // Yjs CRDT 状态（可选，用于协作）
}

interface ChangeRecord {
  id: string;
  date: string;
  timestamp: number;
  userId?: string;
  update: Uint8Array; // Yjs 增量更新（CRDT 格式）
  stateVector?: Uint8Array; // 状态向量（用于合并）
}

interface DailySnapshot {
  date: string;
  items: Event[];
  changes: {
    added: Event[];
    checked: Event[];
    dropped: Event[];
    deleted: string[];
  };
}

// ==================== 存储键名 ====================

const STORAGE_KEYS = {
  BASE_SNAPSHOTS: 'remarkable-plan-base-snapshots',
  CHANGE_RECORDS: 'remarkable-plan-change-records',
  CURRENT_STATE: 'remarkable-plan-items',
  DATE_INDEX: 'remarkable-plan-date-index',
} as const;

// ==================== 快照服务 ====================

class SnapshotService {
  private ydoc: Y.Doc; // Yjs CRDT 文档
  private yarray: Y.Array<Event>; // Event 数组

  constructor() {
    this.ydoc = new Y.Doc();
    this.yarray = this.ydoc.getArray<Event>('planItems');
  }

  /**
   * 创建基准快照
   */
  createBaseSnapshot(items: Event[], date?: string): BaseSnapshot {
    const snapshotDate = date || formatTimeForStorage(new Date()).split(' ')[0];
    
    // 创建新的 Yjs 文档并同步数据
    const ydoc = new Y.Doc();
    const yarray = ydoc.getArray<Event>('planItems');
    
    // 清空并插入新数据
    yarray.delete(0, yarray.length);
    yarray.push(items);
    
    const snapshot: BaseSnapshot = {
      id: `base-${snapshotDate}`,
      date: snapshotDate,
      timestamp: Date.now(),
      items: JSON.parse(JSON.stringify(items)), // 深拷贝
      version: 1,
      ydocState: encodeStateAsUpdate(ydoc), // 保存 CRDT 状态
    };

    // 保存到 localStorage
    const snapshots = this.getBaseSnapshots();
    snapshots.push(snapshot);
    this.saveBaseSnapshots(snapshots);

    return snapshot;
  }

  /**
   * 记录变化（使用 Yjs CRDT 比较差异）
   */
  recordChange(oldItems: Event[], newItems: Event[]): ChangeRecord {
    // 创建两个 Yjs 文档
    const oldDoc = new Y.Doc();
    const newDoc = new Y.Doc();
    
    const oldArray = oldDoc.getArray<Event>('planItems');
    const newArray = newDoc.getArray<Event>('planItems');
    
    // 初始化旧状态
    oldArray.push(oldItems);
    
    // 获取状态向量
    const stateVector = encodeStateVector(oldDoc);
    
    // 初始化新状态
    newArray.push(newItems);
    
    // 计算增量更新（从旧状态到新状态的差异）
    const update = encodeStateAsUpdate(newDoc, stateVector);

    const record: ChangeRecord = {
      id: `change-${Date.now()}`,
      date: formatTimeForStorage(new Date()).split(' ')[0],
      timestamp: Date.now(),
      update: update,
      stateVector: stateVector,
    };

    // 保存到 localStorage
    const records = this.getChangeRecords();
    records.push(record);
    this.saveChangeRecords(records);

    // 更新日期索引
    this.updateDateIndex(record.date, record.id);

    return record;
  }

  /**
   * 恢复指定日期的快照
   */
  restoreSnapshot(date: string): Event[] {
    // 1. 找到最近的基准快照
    const baseSnapshot = this.findNearestBaseSnapshot(date);
    if (!baseSnapshot) {
      return [];
    }

    // 2. 创建 Yjs 文档并恢复基准状态
    const ydoc = new Y.Doc();
    if (baseSnapshot.ydocState) {
      try {
        applyUpdate(ydoc, baseSnapshot.ydocState);
      } catch (error) {
        console.error('❌ [Snapshot] 恢复基准状态失败:', error);
        return baseSnapshot.items; // 降级到 JSON
      }
    } else {
      // 如果没有 CRDT 状态，从 JSON 重建
      const yarray = ydoc.getArray<Event>('planItems');
      yarray.push(baseSnapshot.items);
    }

    // 3. 获取该日期的所有变化记录
    const changeRecords = this.getChangeRecordsForDate(date);

    // 4. 逐个应用增量更新
    for (const record of changeRecords) {
      try {
        applyUpdate(ydoc, record.update);
      } catch (error) {
        console.error('❌ [Snapshot] 应用 CRDT 更新失败:', error, record);
      }
    }

    // 5. 从 Yjs 文档提取最终状态
    const yarray = ydoc.getArray<Event>('planItems');
    return yarray.toArray();
  }

  /**
   * 获取每日快照视图（包含变化分析）
   */
  getDailySnapshot(date: string): DailySnapshot {
    const items = this.restoreSnapshot(date);
    const prevDate = this.getPreviousDate(date);
    const prevItems = prevDate ? this.restoreSnapshot(prevDate) : [];

    // 分析变化
    const changes = this.analyzeChanges(prevItems, items);

    return {
      date,
      items,
      changes,
    };
  }

  /**
   * 分析两个状态之间的变化
   */
  private analyzeChanges(
    oldItems: Event[],
    newItems: Event[]
  ): DailySnapshot['changes'] {
    const oldMap = new Map(oldItems.map((item) => [item.id, item]));
    const newMap = new Map(newItems.map((item) => [item.id, item]));

    const added: Event[] = [];
    const checked: Event[] = [];
    const dropped: Event[] = [];
    const deleted: string[] = [];

    // 检查新增
    newItems.forEach((newItem) => {
      if (!oldMap.has(newItem.id)) {
        added.push(newItem);
      } else {
        const oldItem = oldMap.get(newItem.id)!;
        
        // 检查是否被勾选完成
        if (!oldItem.isCompleted && newItem.isCompleted) {
          checked.push(newItem);
        }
        
        // 检查是否被 drop（未完成但不删除）
        // 这里假设有一个 `isDropped` 字段
        if (!oldItem.isCompleted && (newItem as any).isDropped) {
          dropped.push(newItem);
        }
      }
    });

    // 检查删除
    oldItems.forEach((oldItem) => {
      if (!newMap.has(oldItem.id)) {
        deleted.push(oldItem.id);
      }
    });

    return { added, checked, dropped, deleted };
  }

  /**
   * 获取所有基准快照
   */
  private getBaseSnapshots(): BaseSnapshot[] {
    const data = localStorage.getItem(STORAGE_KEYS.BASE_SNAPSHOTS);
    if (!data) return [];
    
    try {
      const snapshots = JSON.parse(data);
      // 反序列化 Uint8Array
      return snapshots.map((s: any) => ({
        ...s,
        ydocState: s.ydocState ? new Uint8Array(Object.values(s.ydocState)) : undefined,
      }));
    } catch (error) {
      console.error('❌ [Snapshot] 解析基准快照失败:', error);
      return [];
    }
  }

  /**
   * 保存所有基准快照
   */
  private saveBaseSnapshots(snapshots: BaseSnapshot[]): void {
    try {
      // 序列化 Uint8Array 为普通对象
      const serialized = snapshots.map((s) => ({
        ...s,
        ydocState: s.ydocState ? Array.from(s.ydocState) : undefined,
      }));
      localStorage.setItem(STORAGE_KEYS.BASE_SNAPSHOTS, JSON.stringify(serialized));
    } catch (error) {
      console.error('❌ [Snapshot] 保存基准快照失败:', error);
    }
  }

  /**
   * 获取所有变化记录
   */
  private getChangeRecords(): ChangeRecord[] {
    const data = localStorage.getItem(STORAGE_KEYS.CHANGE_RECORDS);
    if (!data) return [];
    
    try {
      const records = JSON.parse(data);
      // 反序列化 Uint8Array
      return records.map((r: any) => ({
        ...r,
        update: new Uint8Array(Object.values(r.update)),
        stateVector: r.stateVector ? new Uint8Array(Object.values(r.stateVector)) : undefined,
      }));
    } catch (error) {
      console.error('❌ [Snapshot] 解析变化记录失败:', error);
      return [];
    }
  }

  /**
   * 保存所有变化记录
   */
  private saveChangeRecords(records: ChangeRecord[]): void {
    try {
      // 序列化 Uint8Array 为普通对象
      const serialized = records.map((r) => ({
        ...r,
        update: Array.from(r.update),
        stateVector: r.stateVector ? Array.from(r.stateVector) : undefined,
      }));
      localStorage.setItem(STORAGE_KEYS.CHANGE_RECORDS, JSON.stringify(serialized));
    } catch (error) {
      console.error('❌ [Snapshot] 保存变化记录失败:', error);
    }
  }

  /**
   * 查找最近的基准快照
   */
  private findNearestBaseSnapshot(date: string): BaseSnapshot | null {
    const snapshots = this.getBaseSnapshots();
    
    // 按日期倒序排列
    const sorted = snapshots
      .filter((s) => s.date <= date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return sorted[0] || null;
  }

  /**
   * 获取指定日期的所有变化记录
   */
  private getChangeRecordsForDate(date: string): ChangeRecord[] {
    const allRecords = this.getChangeRecords();
    return allRecords.filter((r) => r.date === date);
  }

  /**
   * 更新日期索引
   */
  private updateDateIndex(date: string, recordId: string): void {
    const indexData = localStorage.getItem(STORAGE_KEYS.DATE_INDEX);
    const index: Record<string, string[]> = indexData ? JSON.parse(indexData) : {};

    if (!index[date]) {
      index[date] = [];
    }
    index[date].push(recordId);

    localStorage.setItem(STORAGE_KEYS.DATE_INDEX, JSON.stringify(index));
  }

  /**
   * 获取前一天的日期
   */
  private getPreviousDate(date: string): string | null {
    // 🔧 修复：使用 dayjs 避免时区问题
    const d = dayjs(date);
    return d.subtract(1, 'day').format('YYYY-MM-DD');
  }

  /**
   * 清理旧快照（保留最近 N 天）
   */
  cleanupOldSnapshots(daysToKeep: number = 30): void {
    // 🔧 修复：使用 dayjs 避免时区问题
    const cutoffStr = dayjs().subtract(daysToKeep, 'day').format('YYYY-MM-DD');

    // 清理基准快照
    const snapshots = this.getBaseSnapshots();
    const filteredSnapshots = snapshots.filter((s) => s.date >= cutoffStr);
    localStorage.setItem(STORAGE_KEYS.BASE_SNAPSHOTS, JSON.stringify(filteredSnapshots));

    // 清理变化记录
    const records = this.getChangeRecords();
    const filteredRecords = records.filter((r) => r.date >= cutoffStr);
    localStorage.setItem(STORAGE_KEYS.CHANGE_RECORDS, JSON.stringify(filteredRecords));

  }
}

// 导出单例
export const snapshotService = new SnapshotService();

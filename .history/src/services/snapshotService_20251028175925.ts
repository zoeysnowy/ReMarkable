import { produce, enablePatches, Patch as ImmerPatch } from 'immer';
import { applyPatch, compare, Operation } from 'fast-json-patch';
import { PlanItem } from '../components/PlanManager';

// 启用 immer 的 patches 功能
enablePatches();

// ==================== 类型定义 ====================

interface BaseSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  items: PlanItem[];
  version: number;
}

interface ChangeRecord {
  id: string;
  date: string;
  timestamp: number;
  userId?: string;
  patches: Operation[]; // 使用 fast-json-patch 的 Operation 类型
}

interface DailySnapshot {
  date: string;
  items: PlanItem[];
  changes: {
    added: PlanItem[];
    checked: PlanItem[];
    dropped: PlanItem[];
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
  /**
   * 创建基准快照
   */
  createBaseSnapshot(items: PlanItem[], date?: string): BaseSnapshot {
    const snapshotDate = date || new Date().toISOString().split('T')[0];
    const snapshot: BaseSnapshot = {
      id: `base-${snapshotDate}`,
      date: snapshotDate,
      timestamp: Date.now(),
      items: JSON.parse(JSON.stringify(items)), // 深拷贝
      version: 1,
    };

    // 保存到 localStorage
    const snapshots = this.getBaseSnapshots();
    snapshots.push(snapshot);
    localStorage.setItem(STORAGE_KEYS.BASE_SNAPSHOTS, JSON.stringify(snapshots));

    console.log('📸 [Snapshot] 创建基准快照:', snapshot.id);
    return snapshot;
  }

  /**
   * 记录变化（使用 immer 自动生成 patches）
   */
  recordChange(oldItems: PlanItem[], newItems: PlanItem[]): ChangeRecord {
    const patches: ImmerPatch[] = [];
    
    // 使用 immer 的 produce 生成 patches
    produce(
      oldItems,
      (draft) => {
        // 这里不需要真的修改 draft，我们只是用来生成 patches
        // 实际的 patches 通过比较 oldItems 和 newItems 生成
      },
      (p) => {
        patches.push(...p);
      }
    );

    // 使用 fast-json-patch 比较差异
    const jsonPatches = compare(oldItems, newItems);

    const record: ChangeRecord = {
      id: `change-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      patches: jsonPatches as any, // fast-json-patch 格式兼容 ImmerPatch
    };

    // 保存到 localStorage
    const records = this.getChangeRecords();
    records.push(record);
    localStorage.setItem(STORAGE_KEYS.CHANGE_RECORDS, JSON.stringify(records));

    // 更新日期索引
    this.updateDateIndex(record.date, record.id);

    console.log('📝 [Snapshot] 记录变化:', record.id, `${jsonPatches.length} patches`);
    return record;
  }

  /**
   * 恢复指定日期的快照
   */
  restoreSnapshot(date: string): PlanItem[] {
    console.log('🔄 [Snapshot] 恢复快照:', date);

    // 1. 找到最近的基准快照
    const baseSnapshot = this.findNearestBaseSnapshot(date);
    if (!baseSnapshot) {
      console.warn('⚠️ [Snapshot] 未找到基准快照，返回空列表');
      return [];
    }

    // 2. 获取该日期的所有变化记录
    const changeRecords = this.getChangeRecordsForDate(date);

    // 3. 从基准快照开始，逐个应用 patches
    let currentState = JSON.parse(JSON.stringify(baseSnapshot.items));
    
    for (const record of changeRecords) {
      try {
        const result = applyPatch(currentState, record.patches, true);
        currentState = result.newDocument;
      } catch (error) {
        console.error('❌ [Snapshot] 应用 patch 失败:', error, record);
      }
    }

    return currentState;
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
    oldItems: PlanItem[],
    newItems: PlanItem[]
  ): DailySnapshot['changes'] {
    const oldMap = new Map(oldItems.map((item) => [item.id, item]));
    const newMap = new Map(newItems.map((item) => [item.id, item]));

    const added: PlanItem[] = [];
    const checked: PlanItem[] = [];
    const dropped: PlanItem[] = [];
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
    return data ? JSON.parse(data) : [];
  }

  /**
   * 获取所有变化记录
   */
  private getChangeRecords(): ChangeRecord[] {
    const data = localStorage.getItem(STORAGE_KEYS.CHANGE_RECORDS);
    return data ? JSON.parse(data) : [];
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
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  /**
   * 清理旧快照（保留最近 N 天）
   */
  cleanupOldSnapshots(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // 清理基准快照
    const snapshots = this.getBaseSnapshots();
    const filteredSnapshots = snapshots.filter((s) => s.date >= cutoffStr);
    localStorage.setItem(STORAGE_KEYS.BASE_SNAPSHOTS, JSON.stringify(filteredSnapshots));

    // 清理变化记录
    const records = this.getChangeRecords();
    const filteredRecords = records.filter((r) => r.date >= cutoffStr);
    localStorage.setItem(STORAGE_KEYS.CHANGE_RECORDS, JSON.stringify(filteredRecords));

    console.log('🧹 [Snapshot] 清理完成，保留最近', daysToKeep, '天的数据');
  }
}

// 导出单例
export const snapshotService = new SnapshotService();

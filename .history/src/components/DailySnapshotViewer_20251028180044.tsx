import React, { useState, useEffect } from 'react';
import { snapshotService } from '../services/snapshotService';
import { PlanItem } from './PlanManager';
import './DailySnapshotViewer.css';

interface DailySnapshotViewerProps {
  /** 选中的日期 (YYYY-MM-DD) */
  selectedDate: string;
  /** 当前的 PlanItem 列表（用于显示最新状态） */
  currentItems?: PlanItem[];
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

/**
 * 每日快照查看器
 * 显示指定日期的 todo-list 状态和变化
 */
export const DailySnapshotViewer: React.FC<DailySnapshotViewerProps> = ({
  selectedDate,
  currentItems = [],
}) => {
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [showChangesOnly, setShowChangesOnly] = useState(false);

  // 当日期变化时，加载快照
  useEffect(() => {
    loadSnapshot(selectedDate);
  }, [selectedDate]);

  const loadSnapshot = (date: string) => {
    setLoading(true);
    try {
      // 检查是否是今天
      const today = new Date().toISOString().split('T')[0];
      
      if (date === today) {
        // 今天的数据直接显示当前状态，不需要恢复快照
        setSnapshot({
          date,
          items: currentItems,
          changes: {
            added: [],
            checked: [],
            dropped: [],
            deleted: [],
          },
        });
      } else {
        // 历史日期需要恢复快照
        const dailySnapshot = snapshotService.getDailySnapshot(date);
        setSnapshot(dailySnapshot);
      }
    } catch (error) {
      console.error('加载快照失败:', error);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="snapshot-viewer loading">
        <div className="loading-spinner">⏳ 加载中...</div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="snapshot-viewer empty">
        <p>📭 该日期暂无数据</p>
      </div>
    );
  }

  const hasChanges =
    snapshot.changes.added.length > 0 ||
    snapshot.changes.checked.length > 0 ||
    snapshot.changes.dropped.length > 0 ||
    snapshot.changes.deleted.length > 0;

  return (
    <div className="snapshot-viewer">
      {/* 标题栏 */}
      <div className="snapshot-header">
        <h3>📅 {snapshot.date}</h3>
        <div className="header-actions">
          <label className="toggle-changes">
            <input
              type="checkbox"
              checked={showChangesOnly}
              onChange={(e) => setShowChangesOnly(e.target.checked)}
            />
            <span>只显示变化</span>
          </label>
        </div>
      </div>

      {/* 变化统计 */}
      {hasChanges && (
        <div className="changes-summary">
          <div className="stat-item added">
            <span className="icon">➕</span>
            <span className="label">新增</span>
            <span className="count">{snapshot.changes.added.length}</span>
          </div>
          <div className="stat-item checked">
            <span className="icon">✅</span>
            <span className="label">完成</span>
            <span className="count">{snapshot.changes.checked.length}</span>
          </div>
          <div className="stat-item dropped">
            <span className="icon">⏸️</span>
            <span className="label">搁置</span>
            <span className="count">{snapshot.changes.dropped.length}</span>
          </div>
          <div className="stat-item deleted">
            <span className="icon">❌</span>
            <span className="label">删除</span>
            <span className="count">{snapshot.changes.deleted.length}</span>
          </div>
        </div>
      )}

      {/* 变化详情 */}
      {!showChangesOnly && snapshot.items.length > 0 && (
        <section className="all-items">
          <h4>📝 所有任务 ({snapshot.items.length})</h4>
          <div className="items-list">
            {snapshot.items.map((item) => (
              <TaskCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* 新增任务 */}
      {snapshot.changes.added.length > 0 && (
        <section className="changes-section added">
          <h4>➕ 新增任务 ({snapshot.changes.added.length})</h4>
          <div className="items-list">
            {snapshot.changes.added.map((item) => (
              <TaskCard key={item.id} item={item} highlight="added" />
            ))}
          </div>
        </section>
      )}

      {/* 完成任务 */}
      {snapshot.changes.checked.length > 0 && (
        <section className="changes-section checked">
          <h4>✅ 完成任务 ({snapshot.changes.checked.length})</h4>
          <div className="items-list">
            {snapshot.changes.checked.map((item) => (
              <TaskCard key={item.id} item={item} highlight="checked" />
            ))}
          </div>
        </section>
      )}

      {/* 搁置任务 */}
      {snapshot.changes.dropped.length > 0 && (
        <section className="changes-section dropped">
          <h4>⏸️ 搁置任务 ({snapshot.changes.dropped.length})</h4>
          <div className="items-list">
            {snapshot.changes.dropped.map((item) => (
              <TaskCard key={item.id} item={item} highlight="dropped" />
            ))}
          </div>
        </section>
      )}

      {/* 删除任务 */}
      {snapshot.changes.deleted.length > 0 && (
        <section className="changes-section deleted">
          <h4>❌ 删除任务 ({snapshot.changes.deleted.length})</h4>
          <div className="deleted-items">
            {snapshot.changes.deleted.map((id) => (
              <div key={id} className="deleted-item">
                <span className="deleted-icon">🗑️</span>
                <span className="deleted-id">ID: {id}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 无变化提示 */}
      {!hasChanges && snapshot.items.length === 0 && (
        <div className="empty-state">
          <p>📭 该日期暂无任务</p>
        </div>
      )}
    </div>
  );
};

// ==================== 子组件：任务卡片 ====================

interface TaskCardProps {
  item: PlanItem;
  highlight?: 'added' | 'checked' | 'dropped' | 'deleted';
}

const TaskCard: React.FC<TaskCardProps> = ({ item, highlight }) => {
  return (
    <div className={`task-card ${highlight || ''}`}>
      <div className="task-header">
        <input
          type="checkbox"
          checked={item.isCompleted}
          readOnly
          className="task-checkbox"
        />
        <span className={`task-title ${item.isCompleted ? 'completed' : ''}`}>
          {item.title}
        </span>
      </div>

      {item.description && (
        <div className="task-description">{item.description}</div>
      )}

      <div className="task-meta">
        {item.tags && item.tags.length > 0 && (
          <div className="task-tags">
            {item.tags.map((tag, idx) => (
              <span key={idx} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.dueDate && (
          <div className="task-due-date">
            📅 {new Date(item.dueDate).toLocaleDateString()}
          </div>
        )}

        {item.startTime && item.endTime && (
          <div className="task-time">
            🕐 {new Date(item.startTime).toLocaleTimeString()} -{' '}
            {new Date(item.endTime).toLocaleTimeString()}
          </div>
        )}
      </div>

      {highlight && (
        <div className={`highlight-badge ${highlight}`}>
          {highlight === 'added' && '新增'}
          {highlight === 'checked' && '已完成'}
          {highlight === 'dropped' && '已搁置'}
        </div>
      )}
    </div>
  );
};

import { Event, EventLog, EventLogSyncState } from '../types';
import { EventService } from './EventService';
import { formatTimeForStorage } from '../utils/timeUtils';

/**
 * EventLog 字段迁移服务
 * 
 * 功能：
 * - 将旧格式的 eventlog (string) 转换为新格式 (EventLog 对象)
 * - 保留原始 HTML 内容
 * - 自动生成 Slate JSON
 * - 应用启动时自动运行
 */
export class EventLogMigrationService {
  private static readonly BACKUP_KEY = 'events_backup_migration';
  
  /**
   * 迁移单个 Event 的 eventlog 字段
   */
  static migrateEvent(event: Event): Event {
    // 已是新格式，跳过
    if (typeof event.eventlog === 'object' && event.eventlog !== null) {
      return event;
    }
    
    // 旧格式（string）或无 eventlog
    const oldEventlog = event.eventlog || '';
    const now = formatTimeForStorage(new Date());
    
    // 创建新的 EventLog 对象
    const newEventlog: EventLog = {
      content: this.htmlToSlateJSON(oldEventlog), // HTML → Slate JSON
      descriptionHtml: oldEventlog,                // 保留原 HTML
      descriptionPlainText: this.stripHtml(oldEventlog),
      attachments: [],
      versions: [],
      syncState: {
        lastSyncedAt: event.lastSyncTime,
        contentHash: this.hashContent(oldEventlog),
        status: event.syncStatus === 'synced' ? 'synced' : 'pending',
      },
      createdAt: event.createdAt || now,
      updatedAt: event.updatedAt || now,
    };
    
    return {
      ...event,
      eventlog: newEventlog,
      description: oldEventlog, // 保留原 description（Outlook 同步用）
    };
  }
  
  /**
   * 批量迁移所有 Events
   */
  static async migrateAllEvents(): Promise<{
    total: number;
    migrated: number;
    skipped: number;
    failed: number;
  }> {
    const events = EventService.getAllEvents();
    const stats = {
      total: events.length,
      migrated: 0,
      skipped: 0,
      failed: 0,
    };
    
    // 备份数据
    try {
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(events));
      console.log(`✅ [Migration] 已备份 ${events.length} 个 Events`);
    } catch (error) {
      console.error('❌ [Migration] 备份失败:', error);
      throw new Error('无法备份数据，迁移终止');
    }
    
    // 逐个迁移
    for (const event of events) {
      try {
        const original = event.eventlog;
        
        // 跳过已迁移的事件
        if (typeof original === 'object' && original !== null) {
          stats.skipped++;
          continue;
        }
        
        // 执行迁移
        const migrated = this.migrateEvent(event);
        
        // 更新到 localStorage（不触发同步）
        await EventService.updateEvent(event.id, {
          eventlog: migrated.eventlog,
        }, true); // skipSync = true
        
        stats.migrated++;
      } catch (error) {
        console.error(`❌ [Migration] 迁移事件 ${event.id} 失败:`, error);
        stats.failed++;
      }
    }
    
    console.log(`✅ [Migration] 迁移完成:`, stats);
    return stats;
  }
  
  /**
   * 恢复备份数据
   */
  static restoreBackup(): boolean {
    try {
      const backupData = localStorage.getItem(this.BACKUP_KEY);
      if (!backupData) {
        console.warn('⚠️ [Migration] 未找到备份数据');
        return false;
      }
      
      const events: Event[] = JSON.parse(backupData);
      localStorage.setItem('events', JSON.stringify(events));
      console.log(`✅ [Migration] 已恢复 ${events.length} 个 Events`);
      return true;
    } catch (error) {
      console.error('❌ [Migration] 恢复备份失败:', error);
      return false;
    }
  }
  
  /**
   * 清理备份数据
   */
  static clearBackup(): void {
    localStorage.removeItem(this.BACKUP_KEY);
    console.log('🧹 [Migration] 已清理备份数据');
  }
  
  /**
   * HTML → Slate JSON 转换（简化版）
   * 
   * TODO: 使用完整的 html-to-slate 转换器（如 slate-serializers）
   * 当前实现：将 HTML 按行拆分为 paragraph 节点
   */
  private static htmlToSlateJSON(html: string): string {
    if (!html || html.trim() === '') {
      // 空内容：返回单个空段落
      return JSON.stringify([
        { type: 'paragraph', children: [{ text: '' }] }
      ]);
    }
    
    try {
      // 简单实现：移除 HTML 标签，按行拆分
      const plainText = html
        .replace(/<br\s*\/?>/gi, '\n')     // <br> → 换行
        .replace(/<\/p>/gi, '\n')          // </p> → 换行
        .replace(/<[^>]*>/g, '')           // 移除所有标签
        .trim();
      
      const lines = plainText.split('\n').filter(l => l.trim());
      
      if (lines.length === 0) {
        return JSON.stringify([
          { type: 'paragraph', children: [{ text: '' }] }
        ]);
      }
      
      // 每行创建一个 paragraph 节点
      const slateNodes = lines.map(line => ({
        type: 'paragraph',
        children: [{ text: line.trim() }],
      }));
      
      return JSON.stringify(slateNodes);
    } catch (error) {
      console.error('❌ [Migration] HTML → Slate JSON 转换失败:', error);
      // 降级：返回原始 HTML 作为单个段落的文本
      return JSON.stringify([
        { type: 'paragraph', children: [{ text: html }] }
      ]);
    }
  }
  
  /**
   * 移除 HTML 标签，获取纯文本
   */
  private static stripHtml(html: string): string {
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, ' ')    // 移除标签
      .replace(/\s+/g, ' ')        // 压缩空白
      .trim();
  }
  
  /**
   * 计算内容哈希（用于冲突检测）
   * 
   * TODO: 使用 crypto.subtle.digest('SHA-256', data)
   * 当前实现：简化版哈希（内容长度 + 前100字符）
   */
  private static hashContent(content: string): string {
    if (!content) return 'empty';
    
    const length = content.length;
    const prefix = content.substring(0, 100);
    const timestamp = Date.now();
    
    // 简单哈希：length_prefix_timestamp
    return `hash_${length}_${prefix.replace(/\s/g, '').substring(0, 20)}_${timestamp}`;
  }
  
  /**
   * 检查是否需要迁移
   */
  static needsMigration(): boolean {
    const events = EventService.getAllEvents();
    return events.some(event => typeof event.eventlog === 'string');
  }
}

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""添加版本历史方法到 SQLiteService.ts"""

import sys

# 要插入的新方法
NEW_METHODS = '''
  // ==================== EventLog Version History ====================

  /**
   * 插入版本历史记录
   */
  async insertVersion(data: {
    eventId: string;
    version: number;
    deltaCompressed: string;
    deltaSize: number;
    originalSize: number;
    compressionRatio: number;
    createdAt: string;
    createdBy?: string;
    changeSummary?: string;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO eventlog_versions 
        (event_id, version, delta_compressed, delta_size, original_size, 
         compression_ratio, created_at, created_by, change_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run(
      data.eventId,
      data.version,
      data.deltaCompressed,
      data.deltaSize,
      data.originalSize,
      data.compressionRatio,
      data.createdAt,
      data.createdBy || null,
      data.changeSummary || null
    );
  }

  /**
   * 获取最新版本号
   */
  async getLatestVersion(eventId: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT MAX(version) as latest 
      FROM eventlog_versions 
      WHERE event_id = ?
    `);

    const result = await stmt.get(eventId) as any;
    return (result?.latest || 0);
  }

  /**
   * 查询版本历史列表
   */
  async queryVersions(
    eventId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Array<{
    version: number;
    createdAt: string;
    deltaSize: number;
    originalSize: number;
    compressionRatio: number;
    createdBy?: string;
    changeSummary?: string;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const stmt = this.db.prepare(`
      SELECT version, created_at, delta_size, original_size, compression_ratio,
             created_by, change_summary
      FROM eventlog_versions
      WHERE event_id = ?
      ORDER BY version DESC
      LIMIT ? OFFSET ?
    `);

    const rows = await stmt.all(eventId, limit, offset) as any[];
    return rows.map(row => ({
      version: row.version,
      createdAt: row.created_at,
      deltaSize: row.delta_size,
      originalSize: row.original_size,
      compressionRatio: row.compression_ratio,
      createdBy: row.created_by,
      changeSummary: row.change_summary
    }));
  }

  /**
   * 获取指定版本的数据
   */
  async getVersion(eventId: string, version: number): Promise<{
    version: number;
    deltaCompressed: string;
    deltaSize: number;
    originalSize: number;
    compressionRatio: number;
    createdAt: string;
  } | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT version, delta_compressed, delta_size, original_size, 
             compression_ratio, created_at
      FROM eventlog_versions
      WHERE event_id = ? AND version = ?
    `);

    const row = await stmt.get(eventId, version) as any;
    if (!row) return null;

    return {
      version: row.version,
      deltaCompressed: row.delta_compressed,
      deltaSize: row.delta_size,
      originalSize: row.original_size,
      compressionRatio: row.compression_ratio,
      createdAt: row.created_at
    };
  }

  /**
   * 清理旧版本（保留最近 N 个）
   */
  async pruneVersions(eventId: string, keepCount: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM eventlog_versions
      WHERE event_id = ?
        AND version < (
          SELECT MAX(version) - ? FROM eventlog_versions WHERE event_id = ?
        )
    `);

    const result = await stmt.run(eventId, keepCount, eventId);
    return result.changes || 0;
  }

  /**
   * FTS5 全文搜索 EventLog
   */
  async searchEventLogs(
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ items: any[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error('Database not initialized');

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // 搜索匹配的事件
    const searchStmt = this.db.prepare(`
      SELECT e.*
      FROM eventlog_fts fts
      INNER JOIN events e ON fts.event_id = e.id
      WHERE fts.plain_text MATCH ?
      ORDER BY bm25(fts) DESC
      LIMIT ? OFFSET ?
    `);

    const rows = await searchStmt.all(query, limit, offset) as any[];
    const items = rows.map(row => this.rowToEvent(row));

    // 统计总数
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM eventlog_fts
      WHERE plain_text MATCH ?
    `);

    const countRow = await countStmt.get(query) as any;
    const total = countRow?.total || 0;

    return {
      items,
      total,
      hasMore: offset + items.length < total
    };
  }

  /**
   * 更新 EventLog FTS5 索引
   */
  async updateEventLogFTS(eventId: string, plainText: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // 删除旧索引
    const deleteStmt = this.db.prepare(`
      DELETE FROM eventlog_fts WHERE event_id = ?
    `);
    await deleteStmt.run(eventId);

    // 插入新索引
    if (plainText) {
      const insertStmt = this.db.prepare(`
        INSERT INTO eventlog_fts (event_id, plain_text)
        VALUES (?, ?)
      `);
      await insertStmt.run(eventId, plainText);
    }
  }

'''

def main():
    file_path = r'c:\Users\Zoey\ReMarkable\src\services\storage\SQLiteService.ts'
    
    # 读取文件（忽略编码错误）
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    # 查找插入位置（在 clearAll() 方法之前）
    insert_index = None
    for i, line in enumerate(lines):
        if 'async clearAll():' in line or '清空所有数据' in line:
            # 在此方法的注释前插入
            for j in range(i-1, max(0, i-10), -1):
                if lines[j].strip() == '':
                    continue
                if lines[j].strip().startswith('/**') or '/**' in lines[j]:
                    insert_index = j
                    break
            if insert_index is None:
                insert_index = i
            break
    
    if insert_index is None:
        print("❌ Could not find insertion point")
        return 1
    
    print(f"✅ Found insertion point at line {insert_index + 1}")
    
    # 插入新方法
    new_lines = lines[:insert_index] + [NEW_METHODS] + lines[insert_index:]
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8', errors='ignore', newline='') as f:
        f.writelines(new_lines)
    
    print("✅ Version history methods added successfully")
    return 0

if __name__ == '__main__':
    sys.exit(main())

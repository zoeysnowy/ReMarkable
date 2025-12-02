#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""临时脚本：向 SQLiteService.ts 添加新表定义"""

import sys

# 要插入的新表定义
NEW_TABLES = '''
    // 11. EventLog Versions 表（版本历史）
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS eventlog_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        delta_compressed TEXT NOT NULL,
        delta_size INTEGER NOT NULL,
        original_size INTEGER NOT NULL,
        compression_ratio REAL NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT,
        change_summary TEXT,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        UNIQUE(event_id, version)
      );
    `);

    // 12. EventLog FTS5 表（全文搜索）
    await this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS eventlog_fts USING fts5(
        event_id UNINDEXED,
        plain_text,
        tokenize = "unicode61 remove_diacritics 2"
      );
    `);

'''

def main():
    file_path = r'c:\Users\Zoey\ReMarkable\src\services\storage\SQLiteService.ts'
    
    # 读取文件（忽略编码错误）
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    # 查找插入位置（在 "console.log('✅ All tables created');" 之前）
    insert_index = None
    for i, line in enumerate(lines):
        if 'All tables created' in line:
            # 回溯到前一行的 `); 后面
            for j in range(i-1, max(0, i-10), -1):
                if lines[j].strip() == '`);':
                    insert_index = j + 1
                    break
            break
    
    if insert_index is None:
        print("❌ Could not find insertion point")
        return 1
    
    print(f"✅ Found insertion point at line {insert_index + 1}")
    
    # 插入新表定义
    new_lines = lines[:insert_index] + [NEW_TABLES] + lines[insert_index:]
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8', newline='') as f:
        f.writelines(new_lines)
    
    print("✅ New tables added successfully")
    return 0

if __name__ == '__main__':
    sys.exit(main())

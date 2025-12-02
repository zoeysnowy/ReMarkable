const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'test-standalone.db');

// Clean up previous run
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
}

console.log('🧪 Starting standalone SQLite test...');
console.log('📂 Database path:', dbPath);

try {
  const db = new Database(dbPath, { verbose: console.log });
  db.pragma('journal_mode = WAL');

  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        full_title TEXT,
        color_title TEXT,
        simple_title TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        is_all_day BOOLEAN DEFAULT 0,
        description TEXT,
        location TEXT,
        emoji TEXT,
        color TEXT,
        is_completed BOOLEAN DEFAULT 0,
        is_timer BOOLEAN DEFAULT 0,
        is_plan BOOLEAN DEFAULT 0,
        priority TEXT,
        tags TEXT,
        eventlog TEXT,
        source_account_id TEXT,
        source_calendar_id TEXT,
        sync_status TEXT DEFAULT 'local-only',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        is_archived BOOLEAN DEFAULT 0
      );
  `);

  console.log('✅ Table created');

  // INSERT Data
  const insertSql = `
    INSERT INTO events (
        id, full_title, color_title, simple_title,
        start_time, end_time, is_all_day,
        description, location, emoji, color,
        is_completed, is_timer, is_plan, priority,
        tags, eventlog,
        source_account_id, source_calendar_id, sync_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertParams = [
    'event-1764612097238-xobydbg',
    '[{"type":"paragraph","children":[{"type":"tag","tagId":"tag-1","children":[{"text":""}]},{"text":"🧪 CRUD测试事件"}]}]',
    '<p>🧪 CRUD测试事件</p>',
    '🧪 CRUD测试事件',
    '2025-12-01 14:00:00',
    '2025-12-01 15:00:00',
    0,
    '这是一个集成测试事件，验证StorageManager双写机制',
    '测试环境',
    null,
    null,
    0,
    0,
    1,
    null,
    '["test","crud"]',
    '{"slateJson":"[{\\"type\\":\\"paragraph\\",\\"children\\":[{\\"type\\":\\"tag\\",\\"tagId\\":\\"tag-1\\",\\"children\\":[{\\"text\\":\\"\\"}]},{\\"text\\":\\"🧪 CRUD测试事件\\"}]}]","html":"<p>🧪 CRUD测试事件</p>","plainText":"🧪 CRUD测试事件","createdAt":"2025-12-02 02:01:37","updatedAt":"2025-12-02 02:01:37"}',
    null,
    null,
    'pending',
    '2025-12-02 02:01:37',
    '2025-12-02 02:01:37'
  ];

  const insertStmt = db.prepare(insertSql);
  insertStmt.run(...insertParams);
  console.log('✅ Insert successful');

  // UPDATE Data
  const updateSql = `UPDATE events SET simple_title = ?, full_title = ?, color_title = ?, start_time = ?, end_time = ?, is_all_day = ?, description = ?, location = ?, emoji = ?, color = ?, is_completed = ?, is_timer = ?, is_plan = ?, priority = ?, tags = ?, eventlog = ?, source_account_id = ?, source_calendar_id = ?, sync_status = ?, updated_at = ? WHERE id = ?`;

  const updateParams = [
    '🧪 CRUD测试事件 (已修改)',
    '[{"type":"paragraph","children":[{"type":"tag","tagId":"tag-1","children":[{"text":""}]},{"text":"🧪 CRUD测试事件 (已修改)"}]}]',
    '<p>🧪 CRUD测试事件 (已修改)</p>',
    '2025-12-01 14:00:00',
    '2025-12-01 15:00:00',
    0,
    '这个事件已经被更新了，测试双写机制',
    '测试环境',
    null,
    null,
    0,
    0,
    1,
    null,
    '["test","crud"]',
    '{"slateJson":"[{\\"type\\":\\"paragraph\\",\\"children\\":[{\\"type\\":\\"tag\\",\\"tagId\\":\\"tag-1\\",\\"children\\":[{\\"text\\":\\"\\"}]},{\\"text\\":\\"🧪 CRUD测试事件 (已修改)\\"}]}]","html":"<p>🧪 CRUD测试事件 (已修改)</p>","plainText":"🧪 CRUD测试事件 (已修改)","createdAt":"2025-12-02 02:01:37","updatedAt":"2025-12-02 02:01:37"}',
    null,
    null,
    'pending',
    new Date().toISOString(),
    'event-1764612097238-xobydbg'
  ];

  console.log('🔄 Attempting UPDATE...');
  const updateStmt = db.prepare(updateSql);
  updateStmt.run(...updateParams);
  console.log('✅ Update successful');

  db.close();
  console.log('🎉 Test passed!');

} catch (error) {
  console.error('❌ Test failed:', error);
}

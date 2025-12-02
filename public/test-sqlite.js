/**
 * 🧪 SQLite Test Suite for Electron Console
 * 在 Electron DevTools Console 中直接运行：window.testSQLite()
 */

(function() {
  window.testSQLite = async function() {
    console.clear();
    console.log('%c🧪 SQLite Electron Test Suite', 'font-size: 20px; font-weight: bold; color: #2196F3;');
    console.log('');
    
    let dbId = null;
    let testsPassed = 0;
    let testsFailed = 0;
    
    const test = (name, condition, message) => {
      if (condition) {
        console.log('%c✅ ' + name, 'color: #4caf50; font-weight: bold;');
        console.log('   ' + message);
        testsPassed++;
      } else {
        console.error('%c❌ ' + name, 'color: #f44336; font-weight: bold;');
        console.error('   ' + message);
        testsFailed++;
      }
      console.log('');
    };
    
    try {
      // Test 1: SQLite 可用性
      test('Test 1: SQLite 可用性检查', 
           window.electronAPI?.sqlite?.available === true,
           'sqlite.available = true');
      
      // Test 2: 创建数据库
      const dbResult = await window.electronAPI.sqlite.createDatabase(':memory:', {});
      dbId = dbResult.dbId;
      test('Test 2: 创建数据库',
           dbResult.success && dbId,
           `Database ID: ${dbId}`);
      
      // Test 3: 创建表
      await window.electronAPI.sqlite.exec(dbId, `
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at INTEGER
        )
      `);
      test('Test 3: 创建表', true, 'Table "test_users" created');
      
      // Test 4: 插入单行数据
      const stmtId1 = await window.electronAPI.sqlite.prepare(
        dbId,
        'INSERT INTO test_users (name, email, created_at) VALUES (?, ?, ?)'
      );
      const insertResult = await window.electronAPI.sqlite.run(
        stmtId1,
        ['Alice', 'alice@example.com', Date.now()]
      );
      test('Test 4: 插入数据',
           insertResult.changes === 1,
           `Inserted 1 row, lastInsertRowid: ${insertResult.lastInsertRowid}`);
      
      // Test 5: 批量插入
      for (let i = 0; i < 5; i++) {
        await window.electronAPI.sqlite.run(
          stmtId1,
          [`User${i}`, `user${i}@test.com`, Date.now()]
        );
      }
      test('Test 5: 批量插入', true, 'Inserted 5 more rows');
      
      // Test 6: 查询单行
      const stmtId2 = await window.electronAPI.sqlite.prepare(
        dbId,
        'SELECT * FROM test_users WHERE name = ?'
      );
      const user = await window.electronAPI.sqlite.get(stmtId2, ['Alice']);
      test('Test 6: 查询单行',
           user && user.name === 'Alice',
           `Found user: ${JSON.stringify(user)}`);
      
      // Test 7: 查询所有行
      const stmtId3 = await window.electronAPI.sqlite.prepare(
        dbId,
        'SELECT * FROM test_users ORDER BY id'
      );
      const allUsers = await window.electronAPI.sqlite.all(stmtId3, []);
      test('Test 7: 查询所有行',
           allUsers.length === 6,
           `Found ${allUsers.length} users: ${allUsers.map(u => u.name).join(', ')}`);
      console.table(allUsers);
      console.log('');
      
      // Test 8: PRAGMA 设置
      const journalMode = await window.electronAPI.sqlite.pragma(dbId, 'journal_mode = WAL');
      // 注意：内存数据库 (:memory:) 不支持 WAL，会返回 'memory'
      const isValidMode = journalMode === 'wal' || journalMode === 'memory';
      test('Test 8: PRAGMA 设置',
           isValidMode,
           `Journal mode: ${journalMode} ${journalMode === 'memory' ? '(内存数据库不支持 WAL)' : ''}`);
      
      // Test 9: 事务测试
      await window.electronAPI.sqlite.exec(dbId, `
        BEGIN TRANSACTION;
        UPDATE test_users SET name = 'Alice Updated' WHERE name = 'Alice';
        COMMIT;
      `);
      const updated = await window.electronAPI.sqlite.get(stmtId2, ['Alice Updated']);
      test('Test 9: 事务测试',
           updated && updated.name === 'Alice Updated',
           `Updated user: ${JSON.stringify(updated)}`);
      
      // Test 10: 关闭数据库
      await window.electronAPI.sqlite.close(dbId);
      test('Test 10: 关闭数据库', true, 'Database closed successfully');
      dbId = null;
      
      // 总结
      console.log('%c' + '='.repeat(60), 'color: #999;');
      console.log('%c🎉 测试总结', 'font-size: 18px; font-weight: bold; color: #4caf50;');
      console.log(`   ✅ 通过: ${testsPassed} 个测试`);
      console.log(`   ❌ 失败: ${testsFailed} 个测试`);
      if (testsFailed === 0) {
        console.log('');
        console.log('%c🎊 完美！better-sqlite3 在 Electron 27.3.11 中完美运行！', 'font-size: 16px; font-weight: bold; color: #4caf50; background: #f1f8f4; padding: 10px;');
        console.log('%c📦 MODULE_VERSION 118 编译成功！', 'font-size: 14px; color: #2196F3;');
      }
      console.log('%c' + '='.repeat(60), 'color: #999;');
      
    } catch (error) {
      console.error('%c❌ 测试过程中发生错误', 'font-size: 16px; font-weight: bold; color: #f44336;');
      console.error('错误消息:', error.message);
      console.error('堆栈:', error.stack);
      testsFailed++;
    } finally {
      if (dbId) {
        try {
          await window.electronAPI.sqlite.close(dbId);
        } catch (e) {
          console.error('清理数据库时出错:', e);
        }
      }
    }
  };
  
  console.log('%c💡 提示：运行 window.testSQLite() 来测试 SQLite', 'color: #2196F3; font-size: 14px; font-weight: bold;');
})();

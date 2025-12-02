// 🧪 在开发者控制台中运行此脚本来测试 SQLite
// 使用方法：复制粘贴到 Electron DevTools Console

async function testSQLiteInConsole() {
    console.clear();
    console.log('🧪 === SQLite Electron Test Suite ===');
    console.log('');
    
    let dbId = null;
    
    try {
        // Test 1: Check if SQLite is available
        console.log('✅ Test 1: SQLite 可用性检查');
        console.log('   window.electronAPI:', typeof window.electronAPI);
        console.log('   window.electronAPI.sqlite:', typeof window.electronAPI?.sqlite);
        console.log('   window.electronAPI.sqlite.available:', window.electronAPI?.sqlite?.available);
        
        if (!window.electronAPI?.sqlite?.available) {
            throw new Error('SQLite not available in this Electron build');
        }
        console.log('');

        // Test 2: Create database
        console.log('✅ Test 2: 创建数据库');
        const dbPath = ':memory:'; // In-memory database for testing
        const dbResult = await window.electronAPI.sqlite.createDatabase(dbPath, {});
        dbId = dbResult.dbId;
        console.log('   Database ID:', dbId);
        console.log('');

        // Test 3: Create table
        console.log('✅ Test 3: 创建表');
        await window.electronAPI.sqlite.exec(dbId, `
            CREATE TABLE test_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at INTEGER
            )
        `);
        console.log('   Table "test_users" created');
        console.log('');

        // Test 4: Insert data
        console.log('✅ Test 4: 插入数据');
        const stmtId1 = await window.electronAPI.sqlite.prepare(
            dbId,
            'INSERT INTO test_users (name, email, created_at) VALUES (?, ?, ?)'
        );
        
        const insertResult = await window.electronAPI.sqlite.run(
            stmtId1,
            ['Alice', 'alice@example.com', Date.now()]
        );
        console.log('   Inserted 1 row, lastInsertRowid:', insertResult.lastInsertRowid);
        console.log('');

        // Test 5: Insert multiple rows
        console.log('✅ Test 5: 批量插入');
        for (let i = 0; i < 5; i++) {
            await window.electronAPI.sqlite.run(
                stmtId1,
                [`User${i}`, `user${i}@test.com`, Date.now()]
            );
        }
        console.log('   Inserted 5 more rows');
        console.log('');

        // Test 6: Query single row
        console.log('✅ Test 6: 查询单行');
        const stmtId2 = await window.electronAPI.sqlite.prepare(
            dbId,
            'SELECT * FROM test_users WHERE name = ?'
        );
        const user = await window.electronAPI.sqlite.get(stmtId2, ['Alice']);
        console.log('   Found user:', user);
        console.log('');

        // Test 7: Query all rows
        console.log('✅ Test 7: 查询所有行');
        const stmtId3 = await window.electronAPI.sqlite.prepare(
            dbId,
            'SELECT * FROM test_users ORDER BY id'
        );
        const allUsers = await window.electronAPI.sqlite.all(stmtId3, []);
        console.log('   Found', allUsers.length, 'users:');
        console.table(allUsers);
        console.log('');

        // Test 8: Test PRAGMA
        console.log('✅ Test 8: PRAGMA 设置');
        const journalMode = await window.electronAPI.sqlite.pragma(dbId, 'journal_mode = WAL');
        console.log('   Journal mode set to:', journalMode);
        console.log('');

        // Test 9: Test transactions (via exec)
        console.log('✅ Test 9: 事务测试');
        await window.electronAPI.sqlite.exec(dbId, `
            BEGIN TRANSACTION;
            UPDATE test_users SET name = 'Alice Updated' WHERE name = 'Alice';
            COMMIT;
        `);
        const updated = await window.electronAPI.sqlite.get(stmtId2, ['Alice Updated']);
        console.log('   Transaction successful, updated user:', updated);
        console.log('');

        // Test 10: Close database
        console.log('✅ Test 10: 关闭数据库');
        await window.electronAPI.sqlite.close(dbId);
        console.log('   Database closed successfully');
        console.log('');
        dbId = null;

        // Summary
        console.log('🎉 ===================================');
        console.log('🎉 测试总结: All 10 tests passed!');
        console.log('🎉 better-sqlite3 is working perfectly!');
        console.log('🎉 ===================================');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        if (dbId) {
            await window.electronAPI.sqlite.close(dbId);
        }
    }
}

// 自动运行测试
testSQLiteInConsole();

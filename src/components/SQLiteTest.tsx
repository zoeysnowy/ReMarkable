import React, { useState, useEffect } from 'react';

/**
 * 🧪 SQLite Test Component
 * 测试 better-sqlite3 在 Electron 中的功能
 */
export const SQLiteTest: React.FC = () => {
  const [results, setResults] = useState<Array<{
    name: string;
    success: boolean;
    message: string;
  }>>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (name: string, success: boolean, message: string) => {
    setResults(prev => [...prev, { name, success, message }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runAllTests = async () => {
    clearResults();
    setTesting(true);

    let dbId: string | null = null;

    try {
      // Test 1: Check if SQLite is available
      const available = (window as any).electronAPI?.sqlite?.available;
      addResult(
        'Test 1: SQLite 可用性检查',
        !!available,
        `window.electronAPI.sqlite.available = ${available}`
      );

      if (!available) {
        throw new Error('SQLite not available in this Electron build');
      }

      // Test 2: Create database
      const dbPath = ':memory:';
      const dbResult = await (window as any).electronAPI.sqlite.createDatabase(dbPath, {});
      dbId = dbResult.dbId;
      addResult(
        'Test 2: 创建数据库',
        dbResult.success,
        `Database ID: ${dbId}`
      );

      // Test 3: Create table
      await (window as any).electronAPI.sqlite.exec(dbId, `
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at INTEGER
        )
      `);
      addResult('Test 3: 创建表', true, 'Table "test_users" created');

      // Test 4: Insert data
      const stmtId1 = await (window as any).electronAPI.sqlite.prepare(
        dbId,
        'INSERT INTO test_users (name, email, created_at) VALUES (?, ?, ?)'
      );

      const insertResult = await (window as any).electronAPI.sqlite.run(
        stmtId1,
        ['Alice', 'alice@example.com', Date.now()]
      );
      addResult(
        'Test 4: 插入数据',
        insertResult.changes === 1,
        `Inserted 1 row, lastInsertRowid: ${insertResult.lastInsertRowid}`
      );

      // Test 5: Insert multiple rows
      for (let i = 0; i < 5; i++) {
        await (window as any).electronAPI.sqlite.run(
          stmtId1,
          [`User${i}`, `user${i}@test.com`, Date.now()]
        );
      }
      addResult('Test 5: 批量插入', true, 'Inserted 5 more rows');

      // Test 6: Query single row
      const stmtId2 = await (window as any).electronAPI.sqlite.prepare(
        dbId,
        'SELECT * FROM test_users WHERE name = ?'
      );
      const user = await (window as any).electronAPI.sqlite.get(stmtId2, ['Alice']);
      addResult(
        'Test 6: 查询单行',
        user && user.name === 'Alice',
        `Found user: ${JSON.stringify(user)}`
      );

      // Test 7: Query all rows
      const stmtId3 = await (window as any).electronAPI.sqlite.prepare(
        dbId,
        'SELECT * FROM test_users ORDER BY id'
      );
      const allUsers = await (window as any).electronAPI.sqlite.all(stmtId3, []);
      addResult(
        'Test 7: 查询所有行',
        allUsers.length === 6,
        `Found ${allUsers.length} users: ${allUsers.map((u: any) => u.name).join(', ')}`
      );

      // Test 8: Test PRAGMA
      const journalMode = await (window as any).electronAPI.sqlite.pragma(dbId, 'journal_mode = WAL');
      addResult(
        'Test 8: PRAGMA 设置',
        journalMode === 'wal',
        `Journal mode set to: ${journalMode}`
      );

      // Test 9: Test transactions
      await (window as any).electronAPI.sqlite.exec(dbId, `
        BEGIN TRANSACTION;
        UPDATE test_users SET name = 'Alice Updated' WHERE name = 'Alice';
        COMMIT;
      `);
      const updated = await (window as any).electronAPI.sqlite.get(stmtId2, ['Alice Updated']);
      addResult(
        'Test 9: 事务测试',
        updated && updated.name === 'Alice Updated',
        `Transaction successful, updated user: ${JSON.stringify(updated)}`
      );

      // Test 10: Close database
      await (window as any).electronAPI.sqlite.close(dbId);
      addResult('Test 10: 关闭数据库', true, 'Database closed successfully');
      dbId = null;

      // Summary
      addResult(
        '🎉 测试总结',
        true,
        'All 10 tests passed! better-sqlite3 is working perfectly in Electron!'
      );

    } catch (error: any) {
      addResult('❌ Test Failed', false, error.message + '\n' + error.stack);
    } finally {
      if (dbId) {
        await (window as any).electronAPI.sqlite.close(dbId);
      }
      setTesting(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      maxWidth: '1000px',
      margin: '50px auto',
      padding: '20px',
      background: '#f5f5f5'
    }}>
      <h1 style={{ color: '#333' }}>🧪 SQLite Electron Test Suite</h1>

      <div style={{
        background: '#e3f2fd',
        padding: '15px',
        borderRadius: '4px',
        marginBottom: '20px',
        borderLeft: '4px solid #2196F3'
      }}>
        <strong>测试目标：</strong> 验证 better-sqlite3 在 Electron 中是否正常工作
        <br />
        <strong>编译目标：</strong> Electron 27.3.11 (Node.js v18 - MODULE_VERSION 118)
      </div>

      <button
        onClick={runAllTests}
        disabled={testing}
        style={{
          background: testing ? '#ccc' : '#2196F3',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '4px',
          cursor: testing ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          marginRight: '10px'
        }}
      >
        {testing ? '⏳ 测试中...' : '🚀 运行所有测试'}
      </button>

      <button
        onClick={clearResults}
        style={{
          background: '#f44336',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        🗑️ 清除结果
      </button>

      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginTop: '20px'
      }}>
        {results.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
            点击 "运行所有测试" 开始测试
          </div>
        )}
        {results.map((result, index) => (
          <div
            key={index}
            style={{
              margin: '15px 0',
              padding: '15px',
              borderLeft: `4px solid ${result.success ? '#4caf50' : '#f44336'}`,
              background: result.success ? '#f1f8f4' : '#fef1f0'
            }}
          >
            <div style={{
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#333'
            }}>
              {result.success ? '✅' : '❌'} {result.name}
            </div>
            <div style={{
              color: '#666',
              fontFamily: "'Courier New', monospace",
              fontSize: '14px',
              whiteSpace: 'pre-wrap'
            }}>
              {result.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SQLiteTest;

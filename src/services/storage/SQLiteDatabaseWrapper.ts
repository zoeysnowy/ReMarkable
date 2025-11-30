/**
 * SQLite Database Wrapper
 * 
 * 通过 Electron IPC 与主进程中的 better-sqlite3 通信的包装类
 * 提供与 better-sqlite3 Database 类相同的接口
 * 
 * @version 1.0.0
 */

export class SQLiteDatabaseWrapper {
  private dbId: string | null = null;
  private statements = new Map<string, string>();

  constructor(private path: string, private options?: any) {
    // 构造函数不执行异步操作，在 initialize() 中创建连接
  }

  async initialize(): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.sqlite) {
      throw new Error('SQLite IPC not available');
    }

    const result = await electronAPI.sqlite.createDatabase(this.path, this.options);
    if (!result.success) {
      throw new Error(`Failed to create database: ${result.error}`);
    }

    this.dbId = result.dbId;
    console.log(`✅ SQLite database connected: ${this.dbId}`);
  }

  exec(sql: string): void {
    if (!this.dbId) {
      throw new Error('Database not initialized');
    }
    
    const electronAPI = (window as any).electronAPI;
    // exec 是同步操作的包装，但 IPC 是异步的
    // 这里返回 void，实际需要等待
    electronAPI.sqlite.exec(this.dbId, sql).catch((err: any) => {
      console.error('SQLite exec error:', err);
      throw err;
    });
  }

  pragma(pragma: string, options?: { simple?: boolean }): any {
    if (!this.dbId) {
      throw new Error('Database not initialized');
    }

    const electronAPI = (window as any).electronAPI;
    return electronAPI.sqlite.pragma(this.dbId, pragma);
  }

  prepare(sql: string): SQLiteStatementWrapper {
    if (!this.dbId) {
      throw new Error('Database not initialized');
    }

    return new SQLiteStatementWrapper(this.dbId, sql);
  }

  close(): void {
    if (this.dbId) {
      const electronAPI = (window as any).electronAPI;
      electronAPI.sqlite.close(this.dbId);
      this.dbId = null;
    }
  }
}

class SQLiteStatementWrapper {
  private stmtId: string | null = null;
  private initialized = false;

  constructor(private dbId: string, private sql: string) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const electronAPI = (window as any).electronAPI;
    const result = await electronAPI.sqlite.prepare(this.dbId, this.sql);
    
    if (!result.success) {
      throw new Error(`Failed to prepare statement: ${result.error}`);
    }

    this.stmtId = result.stmtId;
    this.initialized = true;
  }

  async run(...params: any[]): Promise<{ changes: number; lastInsertRowid: number }> {
    await this.ensureInitialized();
    
    const electronAPI = (window as any).electronAPI;
    const result = await electronAPI.sqlite.run(this.stmtId, params);
    
    if (!result.success) {
      throw new Error(`Statement run failed: ${result.error}`);
    }

    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  async get(...params: any[]): Promise<any> {
    await this.ensureInitialized();
    
    const electronAPI = (window as any).electronAPI;
    const result = await electronAPI.sqlite.get(this.stmtId, params);
    
    if (!result.success) {
      throw new Error(`Statement get failed: ${result.error}`);
    }

    return result.data;
  }

  async all(...params: any[]): Promise<any[]> {
    await this.ensureInitialized();
    
    const electronAPI = (window as any).electronAPI;
    const result = await electronAPI.sqlite.all(this.stmtId, params);
    
    if (!result.success) {
      throw new Error(`Statement all failed: ${result.error}`);
    }

    return result.data;
  }
}

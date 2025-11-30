/**
 * Storage Module - 统一导出
 * @version 1.0.0
 * @date 2025-12-01
 */

// 类型
export * from './types';

// 服务
export { StorageManager, storageManager } from './StorageManager';
export { IndexedDBService, indexedDBService } from './IndexedDBService';

// ⚠️ SQLiteService 不在此处导出，因为 better-sqlite3 是 Node.js 原生模块
// 在 Electron 环境中，通过 StorageManager 动态导入使用
// 如需直接访问：import { sqliteService } from './storage/SQLiteService';

// TODO: 添加其他服务导出
// export { FileSystemService, fileSystemService } from './FileSystemService';

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

// TODO: 添加其他服务导出
// export { SQLiteService, sqliteService } from './SQLiteService';
// export { FileSystemService, fileSystemService } from './FileSystemService';

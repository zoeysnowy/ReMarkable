import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 🔧 检测 Electron 环境并添加 class 标识
if ((window as any).electronAPI?.isElectron) {
  document.body.classList.add('is-electron');
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// 🧪 加载测试模块（开发环境）
if (process.env.NODE_ENV === 'development') {
  // 加载开发环境重置工具
  import('./utils/dev-reset').catch(err => {
    console.warn('Failed to load dev reset tools:', err);
  });
  
  // 🔧 暂时禁用旧测试模块（需要修复异步调用）
  // import('./tests/test-storage-indexeddb').catch(err => {
  //   console.warn('Failed to load IndexedDB test module:', err);
  // });
  
  // if ((window as any).electronAPI) {
  //   import('./tests/test-storage-sqlite').catch(err => {
  //     console.warn('Failed to load SQLite test module:', err);
  //   });
  // }
  
  // import('./tests/test-storage-manager').catch(err => {
  //   console.warn('Failed to load StorageManager test module:', err);
  // });
  
  // 加载 CRUD 集成测试
  import('./tests/test-crud-integration').catch(err => {
    console.warn('Failed to load CRUD integration test module:', err);
  });
  
  // 加载 IndexedDB 修复测试
  import('./tests/test-indexeddb-fix').catch(err => {
    console.warn('Failed to load IndexedDB fix test module:', err);
  });
}

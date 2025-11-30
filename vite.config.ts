import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tsconfigPaths(),
  ],
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['antd', '@headlessui/react'],
          'vendor-editor': ['slate', 'slate-react', 'slate-history', '@tiptap/react'],
          'vendor-calendar': ['dayjs', 'chrono-node'],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'antd',
      'dayjs',
      '@microsoft/microsoft-graph-client',
    ],
    exclude: [
      'better-sqlite3', // Node.js 原生模块，排除预构建
    ],
  },
  // 外部化 Node.js 模块（仅 Electron 环境需要）
  ssr: {
    noExternal: [], // 保持默认
  },
});

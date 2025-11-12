/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORT: string
  // 添加更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

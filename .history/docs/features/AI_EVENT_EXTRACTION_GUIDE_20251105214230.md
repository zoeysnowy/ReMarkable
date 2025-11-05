# AI 事件提取功能 - 开发指南

## 📖 概述

本功能通过 AI 模型自动从邀请函（PDF/图片/文本）中提取事件信息，并创建到日历中。

### 核心特性
- ✅ 支持 PDF、图片、文本文件
- 🤖 多 AI 模型自动降级（Ollama → OpenAI → Azure → Gemini）
- 🌍 地区自适应（中国大陆优先本地模型）
- 🔐 隐私保护（优先本地 Ollama，无需上传文件）
- 💰 成本优化（优先免费模型）

---

## 🏗️ 技术架构

### 分层设计
```
UI Layer (AIEventImporter.tsx)
    ↓
Service Layer
    ├── PDFParserService (文件→文本)
    ├── AIService (统一接口)
    │   └── Providers (Ollama/OpenAI/Azure/Gemini)
    └── EventExtractionService (业务编排)
    ↓
Data Layer (EventService)
```

---

## 📝 开发步骤

### Step 1: 安装依赖

```bash
npm install pdfjs-dist openai
# 可选：Azure 和 Gemini SDK
npm install @azure/openai @google/generative-ai
```

### Step 2: 配置 PDF.js Worker

在 `public/index.html` 中添加：
```html
<script>
  window.pdfjsWorkerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
</script>
```

### Step 3: 创建目录结构

```bash
mkdir -p src/services/ai/providers
mkdir -p src/components/ai
mkdir -p src/constants/ai
```

### Step 4: 实现核心服务

#### 4.1 创建 AI Provider 接口

```typescript
// src/services/ai/AIProvider.interface.ts
export interface ExtractedEventInfo {
  title: string;
  startTime: string; // ISO 8601 格式
  endTime: string;
  location?: string;
  attendees?: Array<{
    name: string;
    email?: string;
  }>;
  agenda?: string;
  confidence: number; // 0-1
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  extractEventInfo(text: string, prompt: string): Promise<ExtractedEventInfo>;
}
```

#### 4.2 实现 Ollama Provider（本地免费）

```typescript
// src/services/ai/providers/OllamaProvider.ts
import { AIProvider, ExtractedEventInfo } from '../AIProvider.interface';

export class OllamaProvider implements AIProvider {
  name = 'Ollama (本地)';
  baseUrl: string;
  model: string;

  constructor(config?: { baseUrl?: string; model?: string }) {
    this.baseUrl = config?.baseUrl || 'http://localhost:11434';
    this.model = config?.model || 'llama3.2';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async extractEventInfo(text: string, prompt: string): Promise<ExtractedEventInfo> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `${prompt}\n\n文档内容：\n${text}`,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.3, // 降低随机性，提高准确性
          num_predict: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API 失败: ${response.statusText}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.response);

    // 校验返回数据
    if (!parsed.title || !parsed.startTime || !parsed.endTime) {
      throw new Error('AI 返回数据不完整');
    }

    return {
      ...parsed,
      confidence: parsed.confidence || 0.8
    };
  }
}
```

#### 4.3 实现 OpenAI Provider

```typescript
// src/services/ai/providers/OpenAIProvider.ts
import OpenAI from 'openai';
import { AIProvider, ExtractedEventInfo } from '../AIProvider.interface';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL, // 支持自定义代理
      dangerouslyAllowBrowser: true // 允许浏览器调用
    });
    this.model = config.model || 'gpt-4o-mini';
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async extractEventInfo(text: string, prompt: string): Promise<ExtractedEventInfo> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI 返回空响应');
    }

    const parsed = JSON.parse(content);
    return {
      ...parsed,
      confidence: parsed.confidence || 0.9
    };
  }
}
```

#### 4.4 创建 AI 服务管理器

```typescript
// src/services/ai/AIService.ts
import { AIProvider, ExtractedEventInfo } from './AIProvider.interface';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AIConfigManager } from './AIConfig';
import { PDFParserService } from '../PDFParserService';
import { EVENT_EXTRACTION_PROMPT } from '../../constants/ai/prompts';

export class AIService {
  private providers: AIProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const config = AIConfigManager.getConfig();

    // 1. Ollama（本地优先）
    this.providers.push(new OllamaProvider({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel
    }));

    // 2. OpenAI（需要 API Key）
    if (config.openaiApiKey) {
      this.providers.push(new OpenAIProvider({
        apiKey: config.openaiApiKey,
        model: config.openaiModel,
        baseURL: config.openaiBaseURL
      }));
    }

    // 3. 其他提供商（Azure、Gemini）...
  }

  async detectBestProvider(): Promise<AIProvider> {
    for (const provider of this.providers) {
      console.log(`🔍 检测 AI 提供商: ${provider.name}`);
      if (await provider.isAvailable()) {
        console.log(`✅ 使用 AI 提供商: ${provider.name}`);
        return provider;
      }
    }
    throw new Error('没有可用的 AI 提供商，请配置 API Key 或安装 Ollama');
  }

  async extractEventFromDocument(file: File): Promise<ExtractedEventInfo> {
    // 1. 解析文件
    let text: string;
    if (file.type === 'application/pdf') {
      text = await PDFParserService.extractText(file);
    } else if (file.type.startsWith('text/')) {
      text = await file.text();
    } else {
      throw new Error('不支持的文件类型');
    }

    // 2. 检测最佳 AI 提供商
    const provider = await this.detectBestProvider();

    // 3. 调用 AI 提取
    const prompt = EVENT_EXTRACTION_PROMPT;
    return await provider.extractEventInfo(text, prompt);
  }
}
```

#### 4.5 创建 PDF 解析服务

```typescript
// src/services/PDFParserService.ts
import * as pdfjsLib from 'pdfjs-dist';

// 配置 worker（必须）
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
}

export class PDFParserService {
  static async extractText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }
}
```

#### 4.6 创建配置管理器

```typescript
// src/services/ai/AIConfig.ts
export interface AIConfig {
  // Ollama 配置
  ollamaBaseUrl: string;
  ollamaModel: string;

  // OpenAI 配置
  openaiApiKey?: string;
  openaiModel: string;
  openaiBaseURL?: string; // 代理地址

  // Azure 配置（可选）
  azureApiKey?: string;
  azureEndpoint?: string;
  azureDeployment?: string;

  // 用户偏好
  preferredProvider: 'auto' | 'ollama' | 'openai' | 'azure';
}

export class AIConfigManager {
  private static STORAGE_KEY = 'remarkable-ai-config';

  static getDefaultConfig(): AIConfig {
    return {
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.2',
      openaiModel: 'gpt-4o-mini',
      preferredProvider: 'auto'
    };
  }

  static getConfig(): AIConfig {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return { ...this.getDefaultConfig(), ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('读取 AI 配置失败:', error);
    }
    return this.getDefaultConfig();
  }

  static saveConfig(config: Partial<AIConfig>): void {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }
}
```

#### 4.7 创建提示词模板

```typescript
// src/constants/ai/prompts.ts
export const EVENT_EXTRACTION_PROMPT = `你是一个专业的会议信息提取助手。请从以下文档中提取会议信息，并严格按照 JSON 格式返回。

要求：
1. **会议名称**：提取会议的正式名称
2. **时间**：必须转换为 ISO 8601 格式（如 2024-10-28T14:00:00+08:00）
   - 如果没有明确时区，默认使用 +08:00（北京时间）
   - 如果只有日期没有具体时间，默认使用 09:00 作为开始时间
3. **地点**：提取会议地点（包括城市、酒店、会议室）
4. **参与方**：提取所有提到的公司、机构或个人名称
5. **议程**：提取会议的详细议程安排

返回格式（必须是合法的 JSON）：
{
  "title": "会议名称",
  "startTime": "2024-10-28T14:00:00+08:00",
  "endTime": "2024-10-28T17:00:00+08:00",
  "location": "会议地点",
  "attendees": [
    { "name": "参与方1", "email": "" },
    { "name": "参与方2", "email": "" }
  ],
  "agenda": "详细议程内容（多行文本）",
  "confidence": 0.95
}

注意事项：
- 如果文档中没有某个字段，可以设为 null 或空字符串
- confidence 表示你对提取结果的信心程度（0-1）
- 时间格式必须严格遵守 ISO 8601 标准
`;
```

### Step 5: 创建 UI 组件

#### 5.1 AI 事件导入器

```typescript
// src/components/ai/AIEventImporter.tsx
import React, { useState } from 'react';
import { AIService } from '../../services/ai/AIService';
import { EventService } from '../../services/EventService';
import { Event } from '../../types';
import { ExtractedEventInfo } from '../../services/ai/AIProvider.interface';
import './AIEventImporter.css';

export const AIEventImporter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedEvent, setExtractedEvent] = useState<ExtractedEventInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setError(null);

    try {
      const aiService = new AIService();
      const result = await aiService.extractEventFromDocument(uploadedFile);
      setExtractedEvent(result);
    } catch (err: any) {
      setError(err.message || '提取失败');
      console.error('AI 提取失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!extractedEvent) return;

    const event: Event = {
      id: `ai-${Date.now()}`,
      title: extractedEvent.title,
      startTime: extractedEvent.startTime,
      endTime: extractedEvent.endTime,
      location: extractedEvent.location,
      description: extractedEvent.agenda,
      attendees: extractedEvent.attendees,
      isAllDay: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['AI导入'],
      remarkableSource: true,
      syncStatus: 'pending'
    };

    const result = await EventService.createEvent(event);
    if (result.success) {
      alert('✅ 事件创建成功！');
      // 重置状态
      setFile(null);
      setExtractedEvent(null);
    } else {
      alert('❌ 创建失败: ' + result.error);
    }
  };

  const handleEdit = (field: keyof ExtractedEventInfo, value: any) => {
    if (!extractedEvent) return;
    setExtractedEvent({ ...extractedEvent, [field]: value });
  };

  return (
    <div className="ai-event-importer">
      <h3>🤖 智能事件导入</h3>

      {/* 文件上传 */}
      <div className="upload-section">
        <label htmlFor="file-upload" className="upload-button">
          📄 选择文件（PDF/文本）
        </label>
        <input
          id="file-upload"
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        {file && <span className="file-name">{file.name}</span>}
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>AI 正在分析文档...</p>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="error">
          <p>❌ {error}</p>
          <a href="https://ollama.ai/download" target="_blank" rel="noopener">
            📥 安装 Ollama（本地免费）
          </a>
        </div>
      )}

      {/* 提取结果预览 */}
      {extractedEvent && (
        <div className="preview">
          <h4>
            提取结果（置信度：{(extractedEvent.confidence * 100).toFixed(0)}%）
          </h4>

          <div className="field">
            <label>会议名称：</label>
            <input
              type="text"
              value={extractedEvent.title}
              onChange={(e) => handleEdit('title', e.target.value)}
            />
          </div>

          <div className="field">
            <label>开始时间：</label>
            <input
              type="datetime-local"
              value={extractedEvent.startTime.slice(0, 16)}
              onChange={(e) => handleEdit('startTime', e.target.value + ':00+08:00')}
            />
          </div>

          <div className="field">
            <label>结束时间：</label>
            <input
              type="datetime-local"
              value={extractedEvent.endTime.slice(0, 16)}
              onChange={(e) => handleEdit('endTime', e.target.value + ':00+08:00')}
            />
          </div>

          <div className="field">
            <label>地点：</label>
            <input
              type="text"
              value={extractedEvent.location || ''}
              onChange={(e) => handleEdit('location', e.target.value)}
            />
          </div>

          <div className="field">
            <label>参与方：</label>
            <p>{extractedEvent.attendees?.map(a => a.name).join(', ')}</p>
          </div>

          <div className="field">
            <label>议程：</label>
            <textarea
              rows={6}
              value={extractedEvent.agenda || ''}
              onChange={(e) => handleEdit('agenda', e.target.value)}
            />
          </div>

          <button className="confirm-button" onClick={handleConfirmCreate}>
            ✅ 确认创建事件
          </button>
        </div>
      )}
    </div>
  );
};
```

#### 5.2 AI 配置面板

```typescript
// src/components/ai/AIConfigPanel.tsx
import React, { useState, useEffect } from 'react';
import { AIConfigManager } from '../../services/ai/AIConfig';
import type { AIConfig } from '../../services/ai/AIConfig';

export const AIConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<AIConfig>(AIConfigManager.getConfig());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    AIConfigManager.saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="ai-config-panel">
      <h3>⚙️ AI 配置</h3>

      {/* Ollama 配置 */}
      <section>
        <h4>Ollama（本地免费）</h4>
        <label>
          服务地址：
          <input
            type="text"
            value={config.ollamaBaseUrl}
            onChange={(e) => setConfig({ ...config, ollamaBaseUrl: e.target.value })}
            placeholder="http://localhost:11434"
          />
        </label>
        <label>
          模型：
          <select
            value={config.ollamaModel}
            onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
          >
            <option value="llama3.2">Llama 3.2</option>
            <option value="mistral">Mistral</option>
            <option value="qwen2.5">Qwen 2.5</option>
          </select>
        </label>
        <p className="hint">
          📥 未安装？
          <a href="https://ollama.ai/download" target="_blank" rel="noopener">
            点击下载 Ollama
          </a>
        </p>
      </section>

      {/* OpenAI 配置 */}
      <section>
        <h4>OpenAI（付费）</h4>
        <label>
          API Key：
          <input
            type="password"
            value={config.openaiApiKey || ''}
            onChange={(e) => setConfig({ ...config, openaiApiKey: e.target.value })}
            placeholder="sk-..."
          />
        </label>
        <label>
          模型：
          <select
            value={config.openaiModel}
            onChange={(e) => setConfig({ ...config, openaiModel: e.target.value })}
          >
            <option value="gpt-4o-mini">GPT-4o Mini（推荐）</option>
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        </label>
        <label>
          代理地址（可选）：
          <input
            type="text"
            value={config.openaiBaseURL || ''}
            onChange={(e) => setConfig({ ...config, openaiBaseURL: e.target.value })}
            placeholder="https://your-proxy.com/v1"
          />
        </label>
      </section>

      <button onClick={handleSave}>
        {saved ? '✅ 已保存' : '💾 保存配置'}
      </button>
    </div>
  );
};
```

### Step 6: 集成到 Plan 页面

在 `PlanManager.tsx` 中添加按钮：

```typescript
// src/components/PlanManager.tsx（部分修改）
import { AIEventImporter } from './ai/AIEventImporter';
import { AIConfigPanel } from './ai/AIConfigPanel';

// 在组件中添加状态
const [showAIImporter, setShowAIImporter] = useState(false);
const [showAIConfig, setShowAIConfig] = useState(false);

// 在工具栏添加按钮
<div className="toolbar">
  {/* 现有按钮... */}
  <button onClick={() => setShowAIImporter(true)}>
    🤖 AI 导入
  </button>
  <button onClick={() => setShowAIConfig(true)}>
    ⚙️ AI 设置
  </button>
</div>

// 添加模态框
{showAIImporter && (
  <Modal onClose={() => setShowAIImporter(false)}>
    <AIEventImporter />
  </Modal>
)}

{showAIConfig && (
  <Modal onClose={() => setShowAIConfig(false)}>
    <AIConfigPanel />
  </Modal>
)}
```

---

## 🧪 测试步骤

### 1. 安装 Ollama（本地测试）

```bash
# Windows
winget install Ollama.Ollama

# Mac
brew install ollama

# 启动服务
ollama serve

# 拉取模型
ollama pull llama3.2
```

### 2. 测试 AI 提取

```typescript
// 在浏览器控制台测试
const aiService = new AIService();
const testText = `
并购策略会
时间：2024年10月28日 14:00-17:00
地点：上海浦东丽思卡尔顿酒店 3楼会议室
参与方：XX公司、YY投资
议程：
1. 14:00-15:00 市场分析
2. 15:00-16:00 财务尽调
3. 16:00-17:00 交易结构讨论
`;

const provider = await aiService.detectBestProvider();
const result = await provider.extractEventInfo(testText, EVENT_EXTRACTION_PROMPT);
console.log(result);
```

### 3. 集成测试

1. 上传测试 PDF
2. 查看提取结果
3. 修改字段
4. 确认创建事件
5. 在日历中查看

---

## 🌍 地区适配建议

### 中国大陆用户
- **推荐模型**：Ollama（本地，完全免费）
- **备选方案**：OpenAI（需要代理）

### 海外用户
- **推荐模型**：OpenAI GPT-4o-mini（性价比高）
- **备选方案**：Google Gemini（免费额度）

---

## 💰 成本估算

| 模型 | 价格 | 1000次提取成本 |
|------|------|---------------|
| Ollama (本地) | ✅ 免费 | $0 |
| GPT-4o-mini | $0.15/1M tokens | ~$3 |
| GPT-4 | $30/1M tokens | ~$60 |
| Gemini Flash | ✅ 免费层 | $0 |

**推荐配置**：优先 Ollama，需要更高准确性时切换到 GPT-4o-mini。

---

## 🔐 安全注意事项

1. **API Key 存储**：使用 localStorage 加密存储
2. **隐私保护**：优先使用本地 Ollama，避免上传敏感文档
3. **错误处理**：AI 提取结果需要用户二次确认
4. **数据验证**：必须校验时间格式、必填字段

---

## 📚 参考资料

- [Ollama 官方文档](https://github.com/ollama/ollama)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [PDF.js 文档](https://mozilla.github.io/pdf.js/)
- [ISO 8601 时间格式](https://en.wikipedia.org/wiki/ISO_8601)

---

## ❓ FAQ

### Q: 为什么 Ollama 无法连接？
A: 确保 Ollama 服务已启动（`ollama serve`）并且端口 11434 未被占用。

### Q: OpenAI 在中国如何使用？
A: 需要配置代理地址（在 AI 配置面板的"代理地址"字段）。

### Q: 提取结果不准确怎么办？
A: 1) 尝试更换模型；2) 手动修正后保存；3) 优化提示词。

### Q: 支持图片格式吗？
A: 目前仅支持 PDF 和文本，图片需要使用支持 Vision 的模型（如 GPT-4V）。

---

## 🎉 完成检查清单

- [ ] 安装依赖（pdfjs-dist、openai）
- [ ] 创建目录结构
- [ ] 实现 AIService 和 Providers
- [ ] 创建 UI 组件（AIEventImporter、AIConfigPanel）
- [ ] 集成到 PlanManager
- [ ] 安装并测试 Ollama
- [ ] 测试完整流程（上传→提取→创建）
- [ ] 编写用户文档

完成以上步骤后，功能即可上线！🚀

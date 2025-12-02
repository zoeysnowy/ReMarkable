# 🤖 AI Demo 快速启动指南

## 📋 已完成的工作

### 1. 核心服务层 ✅
- ✅ **AIProvider 接口** (`src/services/ai/AIProvider.interface.ts`) - 60 行
- ✅ **OllamaProvider** (`src/services/ai/providers/OllamaProvider.ts`) - 170 行
- ✅ **AIConfig** (`src/services/ai/AIConfig.ts`) - 180 行
- ✅ **PDFParserService** (`src/services/PDFParserService.ts`) - 120 行
- ✅ **AI Prompts** (`src/constants/ai/prompts.ts`) - 80 行
- ✅ **AIService** (`src/services/ai/AIService.ts`) - 180 行

### 2. UI 组件 ✅
- ✅ **AIDemo 页面** (`src/components/AIDemo.tsx`) - 完整的测试界面
- ✅ **样式文件** (`src/components/AIDemo.css`) - 现代化渐变设计

### 3. 应用集成 ✅
- ✅ **路由配置** - 在 `App.tsx` 中添加 `ai-demo` 页面
- ✅ **侧边栏菜单** - 在 `AppLayout.tsx` 中添加 "AI Demo" 入口
- ✅ **依赖安装** - `pdfjs-dist@4.0.379` 已安装

---

## 🚀 启动步骤

### Step 1: 安装 Ollama

#### Windows (推荐 Winget)
```powershell
winget install Ollama.Ollama
```

或者手动下载：https://ollama.ai/download/windows

#### macOS
```bash
brew install ollama
```

或者下载 DMG：https://ollama.ai/download/mac

### Step 2: 启动 Ollama 服务

打开新的终端窗口：
```bash
ollama serve
```

**验证服务运行**：
访问 http://localhost:11434，应该看到 "Ollama is running"

### Step 3: 下载 AI 模型

#### 中国用户（推荐 Qwen 2.5）
```bash
ollama pull qwen2.5:7b
```

**模型大小**: 约 4.7GB  
**下载时间**: 视网络速度，约 10-30 分钟

#### 海外用户（可选 Gemma 2）
```bash
ollama pull gemma2:9b
```

**模型大小**: 约 5.4GB

### Step 4: 启动应用

```bash
cd "c:\Users\Zoey Gong\Github\ReMarkable"
npm start
```

### Step 5: 访问 AI Demo 页面

1. 应用启动后，点击左侧边栏的 **"AI Demo"** 菜单
2. 页面会自动加载

---

## 🧪 测试流程

### 1️⃣ 检测 AI 可用性

点击 **"🔍 检测 AI 可用性"** 按钮，应该看到：

✅ **成功**:
```
状态: ✅ qwen2.5:7b 可用
```

❌ **失败** (如果 Ollama 未运行):
```
状态: ❌ 不可用
错误信息: fetch failed
```

**解决方案**：确保 `ollama serve` 正在运行

### 2️⃣ 上传测试文档

#### 方式 A: 拖拽上传
- 将 PDF 或 TXT 文件拖到虚线框区域

#### 方式 B: 点击选择
- 点击虚线框，选择文件

**支持格式**：
- `.pdf` - PDF 文档（推荐）
- `.txt` - 纯文本文件

### 3️⃣ 提取事件信息

点击 **"🚀 开始提取"** 按钮，AI 将：

1. 解析 PDF 内容（PDF.js）
2. 调用 Ollama API 进行分析
3. 返回结构化事件信息

**处理时间**：约 3-10 秒（取决于文档长度和硬件性能）

### 4️⃣ 编辑提取结果

AI 返回的信息会自动填充到表单：

- **会议名称** - 可编辑
- **开始时间** - datetime-local 控件
- **结束时间** - datetime-local 控件
- **地点** - 可编辑
- **参与方** - 只读标签列表
- **议程** - 多行文本框

**置信度显示**：绿色徽章显示 AI 的置信度评分（0-100%）

### 5️⃣ 创建事件

点击 **"✅ 确认创建事件"**：

- 事件会保存到 localStorage
- 自动添加 `["AI导入"]` 标签
- 可在 **TimeCalendar** 页面中查看

---

## 📝 测试用例

### 测试用例 1: 中文会议邀请函

**创建测试文件** (`test_meeting.txt`):
```
会议通知

主题：ReMarkable v1.0 产品评审会
时间：2025年11月10日 14:00 - 16:00
地点：北京市朝阳区办公楼 3 楼会议室
参会人员：张三、李四、王五

会议议程：
1. 产品功能演示（30分钟）
2. 技术架构讨论（40分钟）
3. 发布计划确认（30分钟）
4. Q&A 环节（20分钟）

请准时参加。
```

**预期输出**：
```json
{
  "title": "ReMarkable v1.0 产品评审会",
  "startTime": "2025-11-10T14:00:00+08:00",
  "endTime": "2025-11-10T16:00:00+08:00",
  "location": "北京市朝阳区办公楼 3 楼会议室",
  "attendees": [
    { "name": "张三", "email": null },
    { "name": "李四", "email": null },
    { "name": "王五", "email": null }
  ],
  "agenda": "1. 产品功能演示（30分钟）\n2. 技术架构讨论（40分钟）\n3. 发布计划确认（30分钟）\n4. Q&A 环节（20分钟）",
  "confidence": 0.95
}
```

### 测试用例 2: 英文会议邀请

**创建测试文件** (`test_meeting_en.txt`):
```
Meeting Invitation

Subject: Q4 Planning Meeting
Date & Time: November 15, 2025, 10:00 AM - 12:00 PM (GMT+8)
Location: Zoom Meeting Room (Link: https://zoom.us/j/12345)
Attendees: John Smith, Emily Chen, Michael Wang

Agenda:
1. Review Q3 achievements
2. Set Q4 OKRs
3. Budget allocation discussion

Please confirm your attendance.
```

**预期输出**：
```json
{
  "title": "Q4 Planning Meeting",
  "startTime": "2025-11-15T10:00:00+08:00",
  "endTime": "2025-11-15T12:00:00+08:00",
  "location": "Zoom Meeting Room",
  "attendees": [
    { "name": "John Smith", "email": null },
    { "name": "Emily Chen", "email": null },
    { "name": "Michael Wang", "email": null }
  ],
  "agenda": "1. Review Q3 achievements\n2. Set Q4 OKRs\n3. Budget allocation discussion",
  "confidence": 0.92
}
```

---

## 🐛 常见问题

### Q1: 提示 "Cannot find module 'pdfjs-dist'"
**解决方案**：
```bash
npm install pdfjs-dist@4.0.379 --legacy-peer-deps
```

### Q2: "❌ 不可用" - fetch failed
**原因**: Ollama 服务未运行  
**解决方案**:
```bash
# 启动 Ollama 服务
ollama serve

# 验证服务
curl http://localhost:11434
```

### Q3: 模型下载速度慢
**解决方案**:
- 中国用户：使用魔法上网或 Ollama 国内镜像
- 或者使用代理：
```bash
export https_proxy=http://127.0.0.1:7890
ollama pull qwen2.5:7b
```

### Q4: AI 提取结果不准确
**可能原因**：
1. 文档格式不规范（缺少关键字段）
2. 模型幻觉（hallucination）
3. 时间格式解析失败

**改进方案**：
- 调整 `src/constants/ai/prompts.ts` 中的 prompt
- 增加样本数据训练
- 使用更大的模型（如 `qwen2.5:14b`）

### Q5: 内存不足 / 模型加载慢
**系统要求**：
- **RAM**: 最低 8GB，推荐 16GB
- **GPU**: 可选（CUDA/Metal 会加速）
- **磁盘**: 至少 10GB 可用空间

**优化方案**：
```bash
# 使用量化版本（更小，稍快）
ollama pull qwen2.5:7b-q4_0
```

---

## 📊 性能指标

### 首次加载（冷启动）
- **模型加载**: 2-5 秒
- **PDF 解析**: 0.5-2 秒
- **AI 推理**: 3-8 秒
- **总计**: 约 5-15 秒

### 后续调用（热启动）
- **PDF 解析**: 0.5-2 秒
- **AI 推理**: 2-5 秒
- **总计**: 约 2-7 秒

### 资源占用
- **内存**: 约 4-6GB（模型加载后）
- **CPU**: 推理时 50-80%（多核）
- **GPU**: 如果可用，显存约 4GB

---

## 🔗 相关文档

- **完整实现文档**: [AI_EVENT_EXTRACTION_IMPLEMENTATION.md](./AI_EVENT_EXTRACTION_IMPLEMENTATION.md)
- **服务层源码**: `src/services/ai/`
- **UI 组件源码**: `src/components/AIDemo.tsx`

---

## 🎯 下一步计划

### ✅ 已完成
- [x] 服务层开发
- [x] AI Demo 页面
- [x] 依赖安装
- [x] 应用集成

### 🚧 待实现（未来）
- [ ] 集成到 PlanManager（拖拽上传）
- [ ] Before/After 预览模态框
- [ ] FloatingBar 上传按钮
- [ ] 批量文档处理
- [ ] 云端 API 支持（Dashscope/Google AI Studio）

---

## 💡 使用技巧

### 技巧 1: 提高准确率
在文档中明确标注：
```
✅ 推荐格式：
时间：2025-11-10 14:00-16:00
地点：会议室 A
参会：张三、李四

❌ 避免模糊表述：
时间：明天下午
地点：老地方
```

### 技巧 2: 快速测试
使用浏览器控制台直接调用：
```javascript
// 测试 AI 可用性
const aiService = new AIService();
await aiService.testAvailability();

// 测试文本提取
const text = "会议主题：测试\n时间：2025-11-10 14:00-16:00";
await aiService.extractEventFromText(text);
```

### 技巧 3: 切换模型
修改 `src/services/ai/AIConfig.ts`:
```typescript
// 强制使用 Gemma
currentModel: 'gemma',

// 或使用自定义模型
getModelConfig() {
  return {
    model: 'llama2:13b', // 你自己下载的模型
    temperature: 0.1
  };
}
```

---

**✨ 现在，点击侧边栏的 "AI Demo"，开始测试吧！**

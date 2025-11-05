
# **Slate 时间轴编辑器：生产级架构设计文档 v2.0**

> **目标受众**: 开发团队、未来的维护者、架构评审者  
> **最后更新**: 2025-11-03  
> **基础框架**: Slate.js 0.102+  
> **项目愿景**: 个人时空叙事引擎 - 情境感知的富文本编辑器

---

## **目录**

1. [架构总览](#1-架构总览)
2. [分层设计](#2-分层设计)
3. [核心模块详细设计](#3-核心模块详细设计)
4. [跨平台适配策略](#4-跨平台适配策略)
5. [性能优化方案](#5-性能优化方案)
6. [测试策略](#6-测试策略)
7. [部署与监控](#7-部署与监控)
8. [未来扩展路径](#8-未来扩展路径)

---

## **1. 架构总览**

### **1.1 设计原则**

本架构遵循以下核心原则，确保系统的可维护性、可扩展性和稳定性：

| 原则 | 说明 | 实践 |
|------|------|------|
| **关注点分离** | 数据、逻辑、UI 严格解耦 | 数据层、业务层、渲染层独立 |
| **平台中立** | 核心逻辑不依赖特定平台 | 平台适配通过插件系统实现 |
| **渐进增强** | 基础功能优先，高级功能可选 | 核心编辑器 + 可插拔的功能模块 |
| **可测试性** | 每个模块都可独立测试 | 纯函数 + 依赖注入 |
| **性能优先** | 避免不必要的重渲染 | React.memo + useMemo + 虚拟化 |

### **1.2 系统架构图**

```
┌─────────────────────────────────────────────────────────────┐
│                        应用层 (App Layer)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  用户界面组件    │  │   工具栏/菜单    │  │  设置面板     │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
└───────────┼────────────────────┼──────────────────┼─────────┘
            │                    │                  │
┌───────────┼────────────────────┼──────────────────┼─────────┐
│           ▼                    ▼                  ▼          │
│                    编辑器层 (Editor Layer)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SlateEditor (统一接口)                    │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │        Editor Factory (useAppEditor)           │  │   │
│  │  │   - 根据平台动态组装增强器                        │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                    │                  │          │
│           ▼                    ▼                  ▼          │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐    │
│  │ withHistory │  │  withReact      │  │  withPlugins │    │
│  └─────────────┘  └─────────────────┘  └──────────────┘    │
└───────────┼────────────────────┼──────────────────┼─────────┘
            │                    │                  │
┌───────────┼────────────────────┼──────────────────┼─────────┐
│           ▼                    ▼                  ▼          │
│               平台适配层 (Platform Layer)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  withDesktop    │  │  withMobile     │  │  withWeb    │ │
│  │  - Composition  │  │  - Touch        │  │  - Paste    │ │
│  │  - Keyboard     │  │  - IME          │  │  - Drag     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└───────────┼────────────────────┼──────────────────┼─────────┘
            │                    │                  │
┌───────────┼────────────────────┼──────────────────┼─────────┐
│           ▼                    ▼                  ▼          │
│                 数据层 (Data Layer)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            统一数据模型 (Unified Schema)               │   │
│  │  - SlateDocument (标准 JSON)                          │   │
│  │  - 序列化/反序列化器                                    │   │
│  │  - 数据验证器                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                    │                  │          │
│           ▼                    ▼                  ▼          │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐    │
│  │  LocalDB    │  │  RemoteSync     │  │  Analytics   │    │
│  │  (IndexedDB)│  │  (WebSocket)    │  │  (Telemetry) │    │
│  └─────────────┘  └─────────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
            │                    │                  │
┌───────────┼────────────────────┼──────────────────┼─────────┐
│           ▼                    ▼                  ▼          │
│               服务层 (Service Layer)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ ActivityService │  │  MediaService   │  │ FileService │ │
│  │ - Desktop Track │  │  - Audio        │  │ - Upload    │ │
│  │ - Mobile Merge  │  │  - Video        │  │ - Storage   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## **2. 分层设计**

### **2.1 数据层 (Data Layer)**

#### **2.1.1 核心数据模型**

```typescript
// file: ./types/document.ts

/**
 * 文档根节点
 * 所有编辑器内容的顶层数组
 */
export type SlateDocument = EditorElement[];

/**
 * 编辑器元素联合类型
 */
export type EditorElement =
  | ParagraphElement
  | ContextMarkerElement
  | HeadingElement
  | ListElement
  | TableElement
  | ImageElement
  | AudioElement
  | VideoElement;

/**
 * 基础段落元素
 */
export interface ParagraphElement {
  type: 'paragraph';
  align?: 'left' | 'center' | 'right';
  children: CustomText[];
}

/**
 * 情境标记元素 - 项目的核心创新
 */
export interface ContextMarkerElement {
  type: 'context-marker';
  id: string; // 唯一标识符
  timestamp: ISODateTimeString; // ISO 8601 格式
  activities: ActivitySpan[];
  metadata?: {
    location?: GeoLocation;
    weather?: WeatherData;
    mood?: string; // 未来扩展：用户情绪标记
  };
  children: [{ text: '' }]; // Slate Void 节点要求
}

/**
 * 活动片段
 */
export interface ActivitySpan {
  id: string;
  appId: string; // 唯一应用标识
  appName: string; // 显示名称
  appIcon?: string; // 图标 URL
  appColor: HexColor; // 主题色
  title: string | null; // 窗口/内容标题
  duration: number; // 持续时长（秒）
  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
  isCompressed?: boolean; // 是否为压缩显示
  importance?: number; // 0-1，用于未来的智能过滤
}

/**
 * 表格元素
 */
export interface TableElement {
  type: 'table';
  rows: number;
  columns: number;
  children: TableRowElement[];
}

export interface TableRowElement {
  type: 'table-row';
  children: TableCellElement[];
}

export interface TableCellElement {
  type: 'table-cell';
  colspan?: number;
  rowspan?: number;
  children: (ParagraphElement | ListElement)[];
}

/**
 * 列表元素
 */
export interface ListElement {
  type: 'bulleted-list' | 'numbered-list';
  children: ListItemElement[];
}

export interface ListItemElement {
  type: 'list-item';
  children: CustomText[];
}

/**
 * 媒体元素
 */
export interface ImageElement {
  type: 'image';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
  children: [{ text: '' }];
}

export interface AudioElement {
  type: 'audio';
  url: string;
  duration?: number;
  waveform?: number[]; // 波形数据
  transcript?: string; // 语音转文字
  children: [{ text: '' }];
}

export interface VideoElement {
  type: 'video';
  url: string;
  thumbnail?: string;
  duration?: number;
  children: [{ text: '' }];
}

/**
 * 自定义文本及格式
 */
export interface CustomText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  highlight?: HexColor;
  link?: string;
}

// 工具类型
export type ISODateTimeString = string; // "2025-11-03T10:30:00Z"
export type HexColor = string; // "#FF5733"
```

#### **2.1.2 数据验证器**

```typescript
// file: ./data/validators.ts

import { z } from 'zod';

/**
 * 使用 Zod 进行运行时类型验证
 * 防止数据损坏、注入攻击等风险
 */

const ActivitySpanSchema = z.object({
  id: z.string().uuid(),
  appId: z.string().min(1),
  appName: z.string().min(1),
  appIcon: z.string().url().optional(),
  appColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  title: z.string().nullable(),
  duration: z.number().positive(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isCompressed: z.boolean().optional(),
  importance: z.number().min(0).max(1).optional()
});

const ContextMarkerSchema = z.object({
  type: z.literal('context-marker'),
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  activities: z.array(ActivitySpanSchema),
  metadata: z.object({
    location: z.any().optional(),
    weather: z.any().optional(),
    mood: z.string().optional()
  }).optional(),
  children: z.array(z.object({ text: z.literal('') }))
});

// ... 其他 Schema

/**
 * 验证完整文档
 */
export function validateDocument(doc: unknown): SlateDocument {
  const DocumentSchema = z.array(
    z.discriminatedUnion('type', [
      ParagraphSchema,
      ContextMarkerSchema,
      HeadingSchema,
      TableSchema,
      ImageSchema,
      AudioSchema,
      VideoSchema
    ])
  );

  return DocumentSchema.parse(doc);
}
```

#### **2.1.3 序列化/反序列化**

```typescript
// file: ./data/serializers.ts

/**
 * 将 Slate 文档序列化为多种格式
 */

export class DocumentSerializer {
  /**
   * 导出为 JSON（存储、同步）
   */
  static toJSON(doc: SlateDocument): string {
    return JSON.stringify(doc, null, 2);
  }

  /**
   * 从 JSON 导入
   */
  static fromJSON(json: string): SlateDocument {
    const parsed = JSON.parse(json);
    return validateDocument(parsed);
  }

  /**
   * 导出为 Markdown（只包含文本内容，丢失活动轴）
   */
  static toMarkdown(doc: SlateDocument): string {
    return doc
      .filter(node => node.type !== 'context-marker')
      .map(node => {
        if (node.type === 'paragraph') {
          return node.children.map(child => child.text).join('');
        }
        // ... 处理其他节点类型
        return '';
      })
      .join('\n\n');
  }

  /**
   * 导出为 HTML（用于博客发布等场景）
   */
  static toHTML(doc: SlateDocument): string {
    // 实现逻辑
  }

  /**
   * 导出为 PDF（通过 puppeteer 或类似工具）
   */
  static async toPDF(doc: SlateDocument): Promise<Buffer> {
    // 实现逻辑
  }
}
```

---

### **2.2 编辑器层 (Editor Layer)**

#### **2.2.1 编辑器工厂（核心组装逻辑）**

```typescript
// file: ./editor/useAppEditor.ts

import { useMemo } from 'react';
import { createEditor, Editor } from 'slate';
import { withReact } from 'slate-react';
import { withHistory } from 'slate-history';

// 增强器导入
import { withTables } from './plugins/withTables';
import { withImages } from './plugins/withImages';
import { withLinks } from './plugins/withLinks';
import { withAutoCorrect } from './plugins/withAutoCorrect';
import { withContextMarkers } from './plugins/withContextMarkers';

// 平台适配器
import { withDesktopOptimizations } from './platform/desktop';
import { withMobileOptimizations } from './platform/mobile';
import { withWebOptimizations } from './platform/web';

// 平台检测
import { detectPlatform, PlatformType } from '../utils/platform';

export interface EditorConfig {
  enableTables?: boolean;
  enableImages?: boolean;
  enableAudio?: boolean;
  enableVideo?: boolean;
  enableAutoCorrect?: boolean;
  maxFileSize?: number; // MB
}

/**
 * 编辑器工厂 Hook
 * 根据平台和配置动态组装编辑器实例
 */
export const useAppEditor = (config: EditorConfig = {}) => {
  const platform = detectPlatform();

  const editor = useMemo(() => {
    // 1. 创建基础编辑器
    let editor: Editor = createEditor();

    // 2. 添加必需的核心增强器
    editor = withHistory(editor);
    editor = withReact(editor);

    // 3. 添加功能增强器（基于配置）
    if (config.enableTables !== false) {
      editor = withTables(editor);
    }

    if (config.enableImages !== false) {
      editor = withImages(editor, { maxFileSize: config.maxFileSize || 10 });
    }

    if (config.enableAutoCorrect !== false) {
      editor = withAutoCorrect(editor);
    }

    // 4. 添加核心业务逻辑：Context Markers
    editor = withContextMarkers(editor);

    // 5. 添加链接支持
    editor = withLinks(editor);

    // 6. 根据平台添加适配层
    switch (platform) {
      case PlatformType.Desktop:
        editor = withDesktopOptimizations(editor);
        break;
      case PlatformType.Mobile:
        editor = withMobileOptimizations(editor);
        break;
      case PlatformType.Web:
        editor = withWebOptimizations(editor);
        break;
    }

    // 7. 返回最终组装好的编辑器
    return editor;
  }, [platform, JSON.stringify(config)]); // config 变化时重新创建

  return editor;
};
```

#### **2.2.2 核心插件：Context Markers 自动注入**

```typescript
// file: ./editor/plugins/withContextMarkers.ts

import { Editor, Transforms, Path, Node } from 'slate';
import { v4 as uuidv4 } from 'uuid';
import { ActivityService } from '../../services/ActivityService';
import { ContextMarkerElement } from '../../types/document';

// 配置常量
const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 分钟无操作
const MIN_ACTIVITY_DURATION = 10; // 最小活动时长（秒），过滤噪音

export const withContextMarkers = (editor: Editor) => {
  const { onChange } = editor;

  // 维护最后修改时间
  let lastModifiedTimestamp = Date.now();
  let isUserTyping = false;

  // 监听编辑器变化
  editor.onChange = () => {
    const now = Date.now();
    const inactivityDuration = now - lastModifiedTimestamp;

    // 判断是否需要插入 Context Marker
    if (
      inactivityDuration > INACTIVITY_THRESHOLD &&
      isUserTyping &&
      editor.selection
    ) {
      insertContextMarker(editor, lastModifiedTimestamp, now);
    }

    // 更新时间戳
    lastModifiedTimestamp = now;

    // 调用原始的 onChange
    onChange();
  };

  // 监听键盘输入事件
  const { insertText, insertBreak } = editor;

  editor.insertText = (text) => {
    isUserTyping = true;
    insertText(text);
  };

  editor.insertBreak = () => {
    isUserTyping = true;
    insertBreak();
  };

  return editor;
};

/**
 * 插入 Context Marker 的核心逻辑
 */
async function insertContextMarker(
  editor: Editor,
  startTime: number,
  endTime: number
) {
  try {
    // 1. 获取活动数据
    const activities = await ActivityService.getActivitiesSince(
      new Date(startTime).toISOString(),
      new Date(endTime).toISOString()
    );

    // 2. 过滤无效活动
    const validActivities = activities.filter(
      (activity) => activity.duration >= MIN_ACTIVITY_DURATION
    );

    if (validActivities.length === 0) {
      return; // 没有有效活动，不插入
    }

    // 3. 创建 Context Marker 节点
    const contextMarker: ContextMarkerElement = {
      type: 'context-marker',
      id: uuidv4(),
      timestamp: new Date(startTime).toISOString(),
      activities: validActivities,
      children: [{ text: '' }]
    };

    // 4. 确定插入位置
    const { selection } = editor;
    if (!selection) return;

    const [currentNode] = Editor.node(editor, selection);
    const currentPath = selection.anchor.path;

    // 在当前段落的上方插入
    const insertPath = Path.parent(currentPath);

    // 5. 执行插入
    Transforms.insertNodes(editor, contextMarker, {
      at: insertPath,
      select: false // 不改变当前选区
    });

    // 6. 确保光标位置正确
    Transforms.move(editor, { unit: 'line', distance: 1 });

  } catch (error) {
    console.error('Failed to insert context marker:', error);
    // 静默失败，不中断用户编辑流程
  }
}
```

#### **2.2.3 表格插件**

```typescript
// file: ./editor/plugins/withTables.ts

import { Editor, Transforms, Range, Point, Element as SlateElement } from 'slate';
import { TableElement, TableRowElement, TableCellElement } from '../../types/document';

export const withTables = (editor: Editor) => {
  const { deleteBackward, deleteForward, insertBreak } = editor;

  // 1. 定义表格节点的判定方法
  editor.isVoid = (element) => {
    return element.type === 'table' ? false : editor.isVoid(element);
  };

  // 2. 覆盖删除行为（在表格内时特殊处理）
  editor.deleteBackward = (unit) => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      const [cell] = Editor.nodes(editor, {
        match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'table-cell'
      });

      if (cell) {
        const [, cellPath] = cell;
        const start = Editor.start(editor, cellPath);

        if (Point.equals(selection.anchor, start)) {
          // 在单元格开头，不执行默认删除
          return;
        }
      }
    }

    deleteBackward(unit);
  };

  // 3. 覆盖回车行为（在表格内创建新段落，而非新单元格）
  editor.insertBreak = () => {
    const { selection } = editor;

    if (selection) {
      const [cell] = Editor.nodes(editor, {
        match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'table-cell'
      });

      if (cell) {
        // 在单元格内，插入新段落
        Transforms.insertNodes(editor, {
          type: 'paragraph',
          children: [{ text: '' }]
        });
        return;
      }
    }

    insertBreak();
  };

  return editor;
};

/**
 * 命令：插入表格
 */
export const insertTable = (
  editor: Editor,
  rows: number = 3,
  columns: number = 3
) => {
  const table: TableElement = {
    type: 'table',
    rows,
    columns,
    children: Array.from({ length: rows }, () => ({
      type: 'table-row',
      children: Array.from({ length: columns }, () => ({
        type: 'table-cell',
        children: [{ type: 'paragraph', children: [{ text: '' }] }]
      }))
    }))
  };

  Transforms.insertNodes(editor, table);
};

/**
 * 命令：合并单元格
 */
export const mergeCells = (editor: Editor) => {
  // 实现单元格合并逻辑
};

/**
 * 命令：拆分单元格
 */
export const splitCell = (editor: Editor) => {
  // 实现单元格拆分逻辑
};
```

---

## **3. 核心模块详细设计**

### **3.1 ActivityService（活动监听服务）**

```typescript
// file: ./services/ActivityService.ts

import { ActivitySpan } from '../types/document';

/**
 * 活动提供者接口
 * 支持多个数据源
 */
export interface ActivityProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  getActivities(startTime: string, endTime: string): Promise<ActivitySpan[]>;
}

/**
 * 桌面端活动提供者
 */
class DesktopActivityProvider implements ActivityProvider {
  name = 'Desktop';
  private isTracking = false;
  private activityLog: RawActivity[] = [];
  private currentActivity: RawActivity | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  async isAvailable(): Promise<boolean> {
    // 检测是否在 Electron 环境或有权限访问系统 API
    return typeof window !== 'undefined' && window.electron !== undefined;
  }

  async startTracking(): Promise<void> {
    if (this.isTracking) return;

    this.isTracking = true;
    this.pollingInterval = setInterval(() => {
      this.captureCurrentActivity();
    }, 1000); // 每秒采样一次

    console.log('Desktop activity tracking started');
  }

  async stopTracking(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isTracking = false;
    console.log('Desktop activity tracking stopped');
  }

  private async captureCurrentActivity() {
    try {
      // 调用 Electron 主进程的 API
      const activeWindow = await window.electron.getActiveWindow();

      if (!activeWindow) return;

      const { owner, title } = activeWindow;

      // 如果应用切换了，保存上一个活动
      if (this.currentActivity && this.currentActivity.appId !== owner.bundleId) {
        this.currentActivity.endTime = new Date().toISOString();
        this.activityLog.push(this.currentActivity);
      }

      // 开始新的活动或延续当前活动
      if (!this.currentActivity || this.currentActivity.appId !== owner.bundleId) {
        this.currentActivity = {
          appId: owner.bundleId,
          appName: owner.name,
          title: title,
          startTime: new Date().toISOString(),
          endTime: null
        };
      }
    } catch (error) {
      console.error('Failed to capture activity:', error);
    }
  }

  async getActivities(startTime: string, endTime: string): Promise<ActivitySpan[]> {
    // 结束当前活动
    if (this.currentActivity) {
      this.currentActivity.endTime = new Date().toISOString();
      this.activityLog.push(this.currentActivity);
      this.currentActivity = null;
    }

    // 过滤时间范围内的活动
    const filtered = this.activityLog.filter((activity) => {
      const activityStart = new Date(activity.startTime).getTime();
      const activityEnd = new Date(activity.endTime!).getTime();
      const rangeStart = new Date(startTime).getTime();
      const rangeEnd = new Date(endTime).getTime();

      return activityStart >= rangeStart && activityEnd <= rangeEnd;
    });

    // 转换为 ActivitySpan 格式
    return filtered.map((activity) => ({
      id: generateId(),
      appId: activity.appId,
      appName: activity.appName,
      appIcon: getAppIcon(activity.appId),
      appColor: getAppColor(activity.appId),
      title: activity.title,
      duration: (new Date(activity.endTime!).getTime() - new Date(activity.startTime).getTime()) / 1000,
      startTime: activity.startTime,
      endTime: activity.endTime!,
      importance: calculateImportance(activity)
    }));
  }
}

/**
 * 移动端活动提供者（未来实现）
 */
class MobileActivityProvider implements ActivityProvider {
  name = 'Mobile';

  async isAvailable(): Promise<boolean> {
    // 检测是否有移动端 API
    return false; // 暂未实现
  }

  async startTracking(): Promise<void> {
    // 从后端 API 拉取移动端活动数据
  }

  async stopTracking(): Promise<void> {}

  async getActivities(startTime: string, endTime: string): Promise<ActivitySpan[]> {
    // 从后端获取
    return [];
  }
}

/**
 * ActivityService 主类
 * 统一管理所有活动提供者
 */
export class ActivityService {
  private static providers: ActivityProvider[] = [];
  private static isInitialized = false;

  /**
   * 初始化服务
   */
  static async initialize() {
    if (this.isInitialized) return;

    // 注册所有可用的提供者
    const desktopProvider = new DesktopActivityProvider();
    const mobileProvider = new MobileActivityProvider();

    if (await desktopProvider.isAvailable()) {
      this.providers.push(desktopProvider);
      await desktopProvider.startTracking();
    }

    if (await mobileProvider.isAvailable()) {
      this.providers.push(mobileProvider);
      await mobileProvider.startTracking();
    }

    this.isInitialized = true;
    console.log(`ActivityService initialized with ${this.providers.length} provider(s)`);
  }

  /**
   * 获取指定时间范围内的活动
   * 合并所有提供者的数据
   */
  static async getActivitiesSince(
    startTime: string,
    endTime: string
  ): Promise<ActivitySpan[]> {
    const allActivities = await Promise.all(
      this.providers.map((provider) =>
        provider.getActivities(startTime, endTime)
      )
    );

    // 合并并按时间排序
    const merged = allActivities.flat().sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    // 去重和压缩
    return this.compressActivities(merged);
  }

  /**
   * 压缩活动数据
   * 将长时间的、低重要性的活动标记为"压缩"
   */
  private static compressActivities(activities: ActivitySpan[]): ActivitySpan[] {
    const LONG_DURATION_THRESHOLD = 1800; // 30 分钟
    const LOW_IMPORTANCE_THRESHOLD = 0.3;

    return activities.map((activity) => {
      if (
        activity.duration > LONG_DURATION_THRESHOLD &&
        (activity.importance || 1) < LOW_IMPORTANCE_THRESHOLD
      ) {
        return { ...activity, isCompressed: true };
      }
      return activity;
    });
  }

  /**
   * 停止所有跟踪
   */
  static async shutdown() {
    await Promise.all(this.providers.map((provider) => provider.stopTracking()));
    this.isInitialized = false;
  }
}

// 工具函数
interface RawActivity {
  appId: string;
  appName: string;
  title: string;
  startTime: string;
  endTime: string | null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getAppIcon(appId: string): string {
  // 从本地缓存或 API 获取应用图标
  return `/icons/${appId}.png`;
}

function getAppColor(appId: string): string {
  // 预定义的应用颜色映射
  const colorMap: Record<string, string> = {
    'com.google.Chrome': '#4285F4',
    'com.microsoft.VSCode': '#007ACC',
    'com.figma.Desktop': '#F24E1E',
    'com.spotify.client': '#1DB954'
  };
  return colorMap[appId] || '#6B7280'; // 默认灰色
}

function calculateImportance(activity: RawActivity): number {
  // 基于规则计算活动的重要性
  // 例如：编辑器、IDE > 浏览器 > 音乐播放器
  const importanceMap: Record<string, number> = {
    'com.microsoft.VSCode': 0.9,
    'com.figma.Desktop': 0.85,
    'com.google.Chrome': 0.7,
    'com.spotify.client': 0.3
  };
  return importanceMap[activity.appId] || 0.5;
}
```

---

## **4. 跨平台适配策略**

### **4.1 平台检测**

```typescript
// file: ./utils/platform.ts

export enum PlatformType {
  Desktop = 'desktop',
  Mobile = 'mobile',
  Web = 'web'
}

export function detectPlatform(): PlatformType {
  // 1. 检测是否为 Electron
  if (typeof window !== 'undefined' && window.electron) {
    return PlatformType.Desktop;
  }

  // 2. 检测是否为移动设备
  const userAgent = navigator.userAgent || navigator.vendor;
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase()
  );

  if (isMobile) {
    return PlatformType.Mobile;
  }

  // 3. 默认为 Web
  return PlatformType.Web;
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function getOS(): 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown' {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';

  return 'unknown';
}
```

### **4.2 移动端优化器（重点）**

```typescript
// file: ./editor/platform/mobile.ts

import { Editor, Transforms } from 'slate';

export const withMobileOptimizations = (editor: Editor) => {
  // 1. 输入法组字支持
  editor = withComposition(editor);

  // 2. Android 兼容性补丁
  editor = withAndroidPolyfill(editor);

  // 3. iOS 选区修复
  editor = withIOSSelection(editor);

  // 4. 虚拟键盘适配
  editor = withVirtualKeyboard(editor);

  // 5. 触摸手势
  editor = withTouchGestures(editor);

  return editor;
};

/**
 * 输入法组字锁
 */
function withComposition(editor: Editor) {
  const { onChange, apply } = editor;

  let isComposing = false;
  let compositionData = '';
  const pendingOps: any[] = [];

  // 绑定事件到编辑器实例
  editor.composition = {
    start: () => {
      isComposing = true;
      compositionData = '';
    },
    update: (e: CompositionEvent) => {
      compositionData = e.data;
    },
    end: (e: CompositionEvent) => {
      isComposing = false;
      compositionData = e.data;

      // 批量应用暂存的操作
      if (pendingOps.length > 0) {
        pendingOps.forEach((op) => apply(op));
        pendingOps.length = 0;
      }

      // 确保最终的组字结果被正确插入
      if (editor.selection && compositionData) {
        Transforms.insertText(editor, compositionData);
      }
    }
  };

  // 拦截 onChange
  editor.onChange = () => {
    if (isComposing) {
      return; // 组字期间冻结状态更新
    }
    onChange();
  };

  // 拦截 apply
  editor.apply = (op) => {
    if (isComposing) {
      pendingOps.push(op); // 暂存操作
      return;
    }
    apply(op);
  };

  return editor;
}

/**
 * Android Polyfill
 */
function withAndroidPolyfill(editor: Editor) {
  const isAndroid = /Android/.test(navigator.userAgent);

  if (!isAndroid) return editor;

  // 检测 beforeinput 支持
  const supportsBeforeInput = 'onbeforeinput' in document.createElement('div');

  if (!supportsBeforeInput) {
    // 使用 input 事件作为 fallback
    const originalInsertText = editor.insertText;

    editor.insertText = (text) => {
      // 在这里手动处理 input 事件的数据
      originalInsertText(text);
    };
  }

  return editor;
}

/**
 * iOS 选区修复
 */
function withIOSSelection(editor: Editor) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (!isIOS) return editor;

  // iOS 的选区手柄有时会"跳跃"，需要在选区变化时进行修正
  let lastSelection = editor.selection;

  const { onChange } = editor;

  editor.onChange = () => {
    const currentSelection = editor.selection;

    // 检测选区是否发生了异常跳跃
    if (lastSelection && currentSelection) {
      const distance = calculateSelectionDistance(lastSelection, currentSelection);

      if (distance > 100) {
        // 如果跳跃超过 100 个字符，认为是异常，恢复到上一个选区
        editor.selection = lastSelection;
        return;
      }
    }

    lastSelection = currentSelection;
    onChange();
  };

  return editor;
}

/**
 * 虚拟键盘适配
 */
function withVirtualKeyboard(editor: Editor) {
  // 监听 visualViewport 变化
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const selection = editor.selection;
      if (!selection) return;

      // 获取光标的 DOM 位置
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) return;

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 计算键盘高度
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;

      // 如果光标被键盘遮挡，滚动页面
      if (rect.bottom > viewportHeight) {
        window.scrollBy({
          top: rect.bottom - viewportHeight + 20, // 20px 缓冲
          behavior: 'smooth'
        });
      }
    });
  }

  return editor;
}

/**
 * 触摸手势支持
 */
function withTouchGestures(editor: Editor) {
  // 实现双击选中单词、三击选中段落等手势
  // 这里省略具体实现，可以使用 Hammer.js 等手势库

  return editor;
}

// 工具函数
function calculateSelectionDistance(sel1: any, sel2: any): number {
  // 计算两个选区之间的"距离"
  // 简化实现：比较 anchor 和 focus 的 offset
  const offset1 = sel1.anchor.offset;
  const offset2 = sel2.anchor.offset;
  return Math.abs(offset2 - offset1);
}
```

### **4.3 桌面端优化器**

```typescript
// file: ./editor/platform/desktop.ts

import { Editor } from 'slate';

export const withDesktopOptimizations = (editor: Editor) => {
  // 1. 快捷键增强
  editor = withKeyboardShortcuts(editor);

  // 2. 拖拽上传
  editor = withDragAndDrop(editor);

  // 3. 粘贴优化
  editor = withSmartPaste(editor);

  return editor;
};

function withKeyboardShortcuts(editor: Editor) {
  // 实现 Cmd/Ctrl + K 插入链接等快捷键
  return editor;
}

function withDragAndDrop(editor: Editor) {
  // 实现拖拽文件到编辑器上传
  return editor;
}

function withSmartPaste(editor: Editor) {
  const { insertData } = editor;

  editor.insertData = (data) => {
    const html = data.getData('text/html');

    if (html) {
      // 清洗 HTML，移除不必要的样式和脚本
      const cleanedHTML = sanitizeHTML(html);
      // 转换为 Slate 节点
      const fragment = deserializeHTML(cleanedHTML);
      Transforms.insertFragment(editor, fragment);
      return;
    }

    insertData(data);
  };

  return editor;
}

function sanitizeHTML(html: string): string {
  // 使用 DOMPurify 或类似库清洗 HTML
  return html;
}

function deserializeHTML(html: string): any[] {
  // 将 HTML 转换为 Slate 节点数组
  return [];
}
```

---

## **5. 性能优化方案**

### **5.1 长文档优化：虚拟滚动**

```typescript
// file: ./components/VirtualizedEditor.tsx

import { useVirtualizer } from '@tanstack/react-virtual';
import { Editable, Slate } from 'slate-react';
import { useRef } from 'react';

export const VirtualizedEditor = ({ editor, value, onChange }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // 只有当文档节点数超过阈值时才启用虚拟滚动
  const VIRTUALIZATION_THRESHOLD = 500;
  const shouldVirtualize = value.length > VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: value.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // 估算每个节点的高度
    enabled: shouldVirtualize
  });

  if (!shouldVirtualize) {
    // 正常渲染
    return (
      <Slate editor={editor} initialValue={value} onChange={onChange}>
        <Editable />
      </Slate>
    );
  }

  // 虚拟滚动渲染
  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <Slate editor={editor} initialValue={value} onChange={onChange}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const node = value[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <Element element={node} />
              </div>
            );
          })}
        </div>
      </Slate>
    </div>
  );
};
```

### **5.2 渲染优化：React.memo**

```typescript
// file: ./components/Element.tsx

import React from 'react';

export const Element = React.memo(
  ({ element, attributes, children }) => {
    switch (element.type) {
      case 'paragraph':
        return <p {...attributes}>{children}</p>;

      case 'context-marker':
        return <ContextMarker element={element} attributes={attributes} children={children} />;

      // ... 其他类型
    }
  },
  (prevProps, nextProps) => {
    // 自定义比较逻辑：只有当节点内容真正变化时才重新渲染
    return (
      prevProps.element === nextProps.element &&
      prevProps.children === nextProps.children
    );
  }
);
```

### **5.3 图片懒加载**

```typescript
// file: ./components/ImageElement.tsx

import { useState, useRef, useEffect } from 'react';

export const ImageElement = ({ element, attributes, children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // 提前 200px 开始加载
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div {...attributes}>
      <div contentEditable={false}>
        <div ref={imgRef} className="relative">
          {isInView ? (
            <img
              src={element.url}
              alt={element.alt || ''}
              className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setIsLoaded(true)}
            />
          ) : (
            <div className="w-full h-64 bg-gray-200 animate-pulse" />
          )}
        </div>
      </div>
      {children}
    </div>
  );
};
```

---

## **6. 测试策略**

### **6.1 单元测试**

```typescript
// file: ./tests/editor/plugins/withContextMarkers.test.ts

import { createEditor } from 'slate';
import { withReact } from 'slate-react';
import { withContextMarkers } from '../../../editor/plugins/withContextMarkers';
import { ActivityService } from '../../../services/ActivityService';

// Mock ActivityService
jest.mock('../../../services/ActivityService');

describe('withContextMarkers', () => {
  let editor;

  beforeEach(() => {
    editor = withContextMarkers(withReact(createEditor()));
  });

  test('should insert context marker after inactivity threshold', async () => {
    // 模拟 5 分钟的不活动
    jest.useFakeTimers();

    // 模拟用户输入
    editor.insertText('Hello');

    // 快进 6 分钟
    jest.advanceTimersByTime(6 * 60 * 1000);

    // 再次输入
    editor.insertText('World');

    // 等待异步操作
    await jest.runAllTimersAsync();

    // 断言：应该插入了一个 context-marker
    const markers = editor.children.filter(
      (node) => node.type === 'context-marker'
    );

    expect(markers.length).toBe(1);
    expect(markers[0].activities).toBeDefined();

    jest.useRealTimers();
  });

  test('should not insert marker if no activities', async () => {
    // Mock ActivityService 返回空数组
    (ActivityService.getActivitiesSince as jest.Mock).mockResolvedValue([]);

    editor.insertText('Test');
    jest.advanceTimersByTime(6 * 60 * 1000);
    editor.insertText('Test2');

    await jest.runAllTimersAsync();

    const markers = editor.children.filter(
      (node) => node.type === 'context-marker'
    );

    expect(markers.length).toBe(0);
  });
});
```

### **6.2 E2E 测试（移动端重点）**

```javascript
// file: ./tests/e2e/mobile-input.spec.js

const { test, expect, devices } = require('@playwright/test');

test.describe('Mobile Input Tests', () => {
  test.use(devices['iPhone 13']);

  test('Chinese IME composition', async ({ page }) => {
    await page.goto('http://localhost:3000/editor');

    const editable = page.locator('[data-slate-editor]');

    // 模拟中文输入
    await editable.click();
    await page.keyboard.type('nihao');

    // 等待候选词出现
    await page.waitForTimeout(500);

    // 选择第一个候选词
    await page.keyboard.press('1');

    // 断言：编辑器内容应该是 "你好"
    const content = await editable.textContent();
    expect(content).toContain('你好');
  });

  test('Virtual keyboard viewport adjustment', async ({ page }) => {
    await page.goto('http://localhost:3000/editor');

    const editable = page.locator('[data-slate-editor]');

    // 点击编辑器底部，触发键盘
    const box = await editable.boundingBox();
    await page.tap({
      x: box.x + box.width / 2,
      y: box.y + box.height - 10
    });

    // 等待键盘动画
    await page.waitForTimeout(500);

    // 断言：编辑器仍然在可视区域内
    const newBox = await editable.boundingBox();
    const viewport = page.viewportSize();

    expect(newBox.y + newBox.height).toBeLessThanOrEqual(viewport.height);
  });

  test('Fast typing does not drop characters', async ({ page }) => {
    await page.goto('http://localhost:3000/editor');

    const editable = page.locator('[data-slate-editor]');
    await editable.click();

    // 快速输入
    const testString = 'abcdefghijklmnopqrstuvwxyz';
    await page.keyboard.type(testString, { delay: 30 });

    const content = await editable.textContent();
    expect(content).toBe(testString);
  });
});
```

---

## **7. 部署与监控**

### **7.1 错误监控**

```typescript
// file: ./utils/monitoring.ts

import * as Sentry from '@sentry/react';

export function initializeMonitoring() {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true
      })
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    beforeSend(event, hint) {
      // 添加编辑器状态的上下文
      if (hint.originalException instanceof Error) {
        const editor = window.__SLATE_EDITOR__; // 全局引用

        if (editor) {
          event.contexts = {
            ...event.contexts,
            slate: {
              documentLength: editor.children.length,
              selection: JSON.stringify(editor.selection),
              lastOperation: editor.operations[editor.operations.length - 1]
            }
          };
        }
      }

      return event;
    }
  });
}
```

### **7.2 性能监控**

```typescript
// file: ./utils/performance.ts

export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  measure(name: string, fn: () => void) {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(duration);

    // 如果超过阈值，上报
    if (duration > 100) {
      this.reportSlow(name, duration);
    }
  }

  private reportSlow(name: string, duration: number) {
    // 上报到分析服务
    fetch('/api/metrics', {
      method: 'POST',
      body: JSON.stringify({
        metric: name,
        duration,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      })
    });
  }

  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;

    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values)
    };
  }
}

// 全局实例
export const perfMonitor = new PerformanceMonitor();
```

---

## **8. 未来扩展路径**

### **8.1 协同编辑（Collaborative Editing）**

基于 Yjs 或 Automerge 实现 CRDT（无冲突复制数据类型）：

```typescript
// file: ./collaboration/useYjsSync.ts

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { withYjs, YjsEditor } from '@slate-yjs/core';

export const useCollaboration = (editor, documentId) => {
  const yDoc = useMemo(() => new Y.Doc(), []);

  const provider = useMemo(() => {
    return new WebsocketProvider(
      'wss://your-collaboration-server.com',
      documentId,
      yDoc
    );
  }, [documentId, yDoc]);

  const collaborativeEditor = useMemo(() => {
    return withYjs(editor, yDoc.getArray('content'));
  }, [editor, yDoc]);

  return { editor: collaborativeEditor, provider };
};
```

### **8.2 AI 辅助写作**

集成 GPT-4 等 LLM：

```typescript
// file: ./ai/AIAssistant.ts

export class AIAssistant {
  async suggest(context: string, userInput: string): Promise<string> {
    const response = await fetch('/api/ai/suggest', {
      method: 'POST',
      body: JSON.stringify({ context, userInput })
    });

    const { suggestion } = await response.json();
    return suggestion;
  }

  async summarize(document: SlateDocument): Promise<string> {
    // 总结文档
  }

  async extractKeywords(document: SlateDocument): Promise<string[]> {
    // 提取关键词
  }
}
```

### **8.3 多模态扩展**

- **语音输入**：集成 Web Speech API
- **手绘草图**：使用 Canvas 或 SVG
- **公式编辑**：集成 KaTeX 或 MathQuill
- **图表/思维导图**：集成 Mermaid 或 D3.js

---

## **附录 A：项目结构**

```
project-root/
├── src/
│   ├── components/          # React 组件
│   │   ├── Editor/
│   │   │   ├── SlateEditor.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── FloatingMenu.tsx
│   │   │   └── elements/    # 自定义元素渲染器
│   │   │       ├── Paragraph.tsx
│   │   │       ├── ContextMarker.tsx
│   │   │       ├── Table.tsx
│   │   │       ├── Image.tsx
│   │   │       └── Audio.tsx
│   │   └── Timeline/        # 时间轴 UI
│   │       ├── TimelineAxis.tsx
│   │       ├── ActivitySpan.tsx
│   │       └── Breakout.tsx
│   ├── editor/              # 编辑器核心
│   │   ├── useAppEditor.ts  # 编辑器工厂
│   │   ├── plugins/         # 插件
│   │   │   ├── withContextMarkers.ts
│   │   │   ├── withTables.ts
│   │   │   ├── withImages.ts
│   │   │   ├── withLinks.ts
│   │   │   └── withAutoCorrect.ts
│   │   └── platform/        # 平台适配
│   │       ├── desktop.ts
│   │       ├── mobile.ts
│   │       └── web.ts
│   ├── services/            # 业务服务
│   │   ├── ActivityService.ts
│   │   ├── FileUploadService.ts
│   │   ├── SyncService.ts
│   │   └── AnalyticsService.ts
│   ├── data/                # 数据层
│   │   ├── validators.ts
│   │   ├── serializers.ts
│   │   └── schema/
│   ├── types/               # TypeScript 类型
│   │   ├── document.ts
│   │   ├── editor.ts
│   │   └── platform.ts
│   ├── utils/               # 工具函数
│   │   ├── platform.ts
│   │   ├── monitoring.ts
│   │   └── performance.ts
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── useKeyboardShortcuts.ts
│   └── tests/               # 测试
│       ├── unit/
│       ├── integration/
│       └── e2e/
├── electron/                # Electron 主进程（桌面端）
│   ├── main.ts
│   ├── preload.ts
│   └── native/
│       └── activity-tracker.ts
├── docs/                    #
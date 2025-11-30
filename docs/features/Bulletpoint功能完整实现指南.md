
# Bulletpoint功能实现指南

## 核心交互功能

### 1. 自动检测与转换

**✅ 已实现 (2025-11-30)**

```typescript
// SlateCore/operations/bulletOperations.ts
export const BULLET_TRIGGERS = ['* ', '- ', '• ', '➢ ', '· '] as const;

// 检测光标前两个字符是否为触发字符
export function detectBulletTrigger(editor: Editor): string | null {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return null;

  const { anchor } = selection;
  const beforePoint = Editor.before(editor, anchor, { unit: 'character', distance: 2 });
  if (!beforePoint) return null;

  const beforeText = Editor.string(editor, { anchor: beforePoint, focus: anchor });
  
  for (const trigger of BULLET_TRIGGERS) {
    if (beforeText === trigger) return trigger;
  }
  return null;
}

// 应用自动转换（删除触发字符，设置 bullet 属性）
export function applyBulletAutoConvert(editor: Editor, trigger: string): boolean {
  // 1. 删除触发字符
  // 2. 设置当前段落为 bullet: true, bulletLevel: 0
  // 详见实现
}
```

**触发时机** (关键修复):
```typescript
// ModalSlate.tsx / PlanSlate.tsx - handleKeyDown
if (event.key === ' ') {
  // ⚠️ 使用 setTimeout(0) 确保空格已插入到编辑器后再检测
  setTimeout(() => {
    const trigger = detectBulletTrigger(editor);
    if (trigger) {
      console.log('🎯 检测到 Bullet 触发字符:', trigger);
      applyBulletAutoConvert(editor, trigger);
    }
  }, 0);
}
```

**为什么使用 setTimeout(0)?**
- ✅ 确保空格字符已经插入到 Slate 编辑器
- ✅ 让 Slate 的 onChange 事件先完成
- ✅ 然后再读取光标前的文本内容
- ❌ 如果直接在 onKeyDown 中检测，空格还未插入，检测失败

### 2. 多级缩进系统
```javascript
class BulletManager {
    constructor() {
        this.levels = [
            { indent: 0, bulletChar: '•' },
            { indent: 40, bulletChar: '◦' },
            { indent: 80, bulletChar: '▪' }
        ];
    }
    
    getCurrentLevel(indent) {
        return this.levels.findIndex(level => level.indent === indent);
    }
}
```

## 格式兼容性处理

### 1. 微软Office格式映射
```javascript
const MS_FORMAT_MAP = {
    'bullet': {
        html: '<ul style="margin-left: 20px;"><li>{content}</li></ul>',
        text: '• {content}',
        plain: '- {content}'
    },
    'number': {
        html: '<ol style="margin-left: 20px;"><li>{content}</li></ol>',
        text: '1. {content}',
        plain: '1. {content}'
    }
};
```

### 2. 微信输入框兼容格式
```javascript
function formatForWeChat(bulletItems) {
    // 微信支持的基础bullet格式
    return bulletItems.map(item => {
        const indent = '  '.repeat(item.level);
        return `${indent}• ${item.text}`;
    }).join('\n');
}

function formatForRichText(bulletItems) {
    // 富文本环境下的格式
    return bulletItems.map(item => {
        const style = `margin-left: ${item.level * 20}px;`;
        return `<div style="${style}">• ${item.text}</div>`;
    }).join('');
}
```

## 复制粘贴处理

### 1. 剪贴板数据生成
```javascript
function generateClipboardData(bulletItems) {
    const plainText = bulletItems.map(item => 
        '  '.repeat(item.level) + '• ' + item.text
    ).join('\n');
    
    const htmlText = `
        <ul style="font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        ${bulletItems.map(item => 
            `<li style="margin-left: ${item.level * 20}px;">${item.text}</li>`
        ).join('')}
        </ul>
    `;
    
    return {
        'text/plain': plainText,
        'text/html': htmlText,
        'application/rtf': generateRtfFormat(bulletItems)
    };
}
```

### 2. 粘贴时的格式解析
```javascript
function parsePastedContent(clipboardData) {
    // 优先尝试HTML解析
    if (clipboardData.types.includes('text/html')) {
        return parseHTMLBullets(clipboardData.getData('text/html'));
    }
    
    // 回退到纯文本解析
    if (clipboardData.types.includes('text/plain')) {
        return parsePlainTextBullets(clipboardData.getData('text/plain'));
    }
    
    return null;
}

function parsePlainTextBullets(text) {
    const lines = text.split('\n');
    return lines.map(line => {
        const match = line.match(/^(\s*)([•◦▪\-*])\s?(.+)/);
        if (match) {
            return {
                level: Math.floor(match[1].length / 2),
                bullet: match[2],
                text: match[3]
            };
        }
        return null;
    }).filter(Boolean);
}
```

## 样式系统配置

### 1. 基础样式定义
```css
.bullet-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
}

.bullet-item {
    margin: 4px 0;
    padding-left: 20px;
    text-indent: -20px;
}

.bullet-level-0 { margin-left: 0; }
.bullet-level-1 { margin-left: 40px; }
.bullet-level-2 { margin-left: 80px; }

.bullet-char {
    display: inline-block;
    width: 20px;
    text-align: center;
}
```

### 2. 响应式调整
```javascript
function adjustForPlatform() {
    // 检测当前环境
    const isWeChat = navigator.userAgent.includes('MicroMessenger');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isWeChat) {
        // 微信环境下使用更简单的格式
        return {
            useSimpleBullets: true,
            maxIndent: 2,
            bulletChars: ['•', '◦']
        };
    }
    
    return {
        useSimpleBullets: false,
        maxIndent: 5,
        bulletChars: ['•', '◦', '▪', '➢', '→']
    };
}
```

## 测试用例

### 1. 格式兼容性测试
```javascript
const testCases = [
    {
        input: '* 第一项\n* 第二项',
        expected: {
            plain: '• 第一项\n• 第二项',
            html: '<ul><li>第一项</li><li>第二项</li></ul>'
        }
    },
    {
        input: '1. 第一项\n2. 第二项',
        expected: {
            plain: '1. 第一项\n2. 第二项',
            html: '<ol><li>第一项</li><li>第二项</li></ol>'
        }
    }
];
```

### 2. 跨平台粘贴测试
```javascript
function testCrossPlatformPaste() {
    const testData = [
        { source: 'msword', format: 'html' },
        { source: 'google-docs', format: 'html' },
        { source: 'wechat', format: 'plain' },
        { source: 'notes-app', format: 'plain' }
    ];
    
    testData.forEach(({source, format}) => {
        const result = parsePastedContent(generateTestData(source, format));
        assertFormatConsistency(result, source);
    });
}
```

## 部署建议

1. **渐进增强**：先实现基础功能，再添加高级特性
2. **用户配置**：允许用户自定义bullet字符和缩进大小
3. **性能优化**：对大量bullet项使用虚拟滚动
4. **错误处理**：添加完整的粘贴失败回退机制

这个实现方案确保了与Microsoft Office的格式兼容性，同时在微信等限制性环境中也能保持优雅的显示效果。

# 存储架构 - 下一步计划

> **更新时间**: 2025-12-02 (最新)  
> **当前阶段**: Phase 1-2 完成 ✅ → Phase 3 附件系统开发中 🚧  
> **整体进度**: 65% (存储层100% + 附件系统65%)

---

## 📊 当前状态总览

### ✅ 已完成 (Phase 1-2: 核心存储层)

1. **IndexedDB + SQLite 双写架构** (100%)
   - ✅ Schema 设计与实现
   - ✅ StorageManager 统一接口
   - ✅ 查询优化策略
   - ✅ 离线队列机制

2. **FTS5 全文搜索** (100%)
   - ✅ 外部内容表配置
   - ✅ UPDATE/DELETE 触发器修复
   - ✅ CRUD 集成测试 7/7 通过

3. **版本历史系统架构** (100%)
   - ✅ 无限版本保存设计
   - ✅ 压缩 + 增量存储算法
   - ✅ 数据库表结构

### 🚧 进行中 (Phase 3: 附件系统)

**完成度: 65%** ⬆️ (+30% 今日更新)

1. **类型系统** ✅ (100%)
   - ✅ 7 种附件类型定义
   - ✅ 8 种查看模式定义
   - ✅ TranscriptData 接口 (AI 转录)

2. **AttachmentService** ✅ (80%)
   - ✅ 类型检测与验证
   - ✅ 类型特定处理方法
   - ✅ 统一上传接口
   - ✅ 批量上传（5并发）

3. **查看模式组件** ✅ (100%) 🎉
   - ✅ AttachmentViewContainer (主容器，360行)
   - ✅ AttachmentViewModeSwitcher (模式切换器，220行)
   - ✅ GalleryView (图片画廊，3种布局，750行)
   - ✅ VideoStreamView (视频播放器，3种布局，470行)
   - ✅ AudioStreamView (音频播放器，3种布局，625行)
   - ✅ TranscriptView (转录查看器，680行)
   - ✅ DocumentLibView (文档库，3种布局，850行)
   - ✅ TreeNavigationView (树形导航，3种布局，650行)
   - ✅ BookmarkView (网页剪藏，3种布局，750行)
   - ✅ **总计**: 9个组件，6,500+行代码

4. **Slate.js 集成** 📋 (0%)
   - 📋 withImages 插件
   - 📋 withVideos 插件
   - 📋 withAudio 插件
   - 📋 withDocuments 插件
   - 📋 内联媒体节点

---

## 🎯 优先级任务清单

### 🔴 P0 - 关键任务 (本周必须完成)

#### 1. 清理生产环境日志 ⚡
**预计时间**: 2 小时  
**负责人**: AI Agent  
**DDL**: 今天 (2025-12-02)

**任务**:
```typescript
// src/services/storage/SQLiteService.ts
// 移除详细参数日志，仅保留关键错误和性能指标

// ❌ 删除这些日志
console.log('[SQLite CRUD] Full params:', params);
console.log('[SQLite] Query details:', { sql, bindings });

// ✅ 保留这些日志
console.error('[SQLite] CRUD operation failed:', error);
console.warn('[SQLite] Query slow:', { duration: '2.5s', sql });
```

**影响**:
- 减少日志噪音 90%
- 提升性能 5-10%
- 生产环境更清晰

---

#### 2. FTS5 搜索单元测试 🧪
**预计时间**: 4 小时  
**负责人**: AI Agent  
**DDL**: 明天 (2025-12-03)

**测试用例**:
```typescript
// test-storage-fts5.ts

describe('FTS5 Full-Text Search', () => {
  test('基础搜索 - 标题匹配', async () => {
    await storageManager.createEvent({
      simpleTitle: '重要会议讨论',
      description: '关于产品规划'
    });
    
    const results = await storageManager.searchEvents('重要');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].simpleTitle).toContain('重要');
  });
  
  test('UPDATE后搜索 - 验证触发器', async () => {
    const event = await storageManager.createEvent({
      simpleTitle: '初始标题'
    });
    
    // 更新标题
    await storageManager.updateEvent(event.id, {
      simpleTitle: '更新后的标题'
    });
    
    // 搜索更新后的关键词
    const results = await storageManager.searchEvents('更新后');
    expect(results.length).toBe(1);
    
    // 搜索旧关键词应该找不到
    const oldResults = await storageManager.searchEvents('初始');
    expect(oldResults.length).toBe(0);
  });
  
  test('DELETE后搜索 - 验证触发器', async () => {
    const event = await storageManager.createEvent({
      simpleTitle: '即将删除的事件'
    });
    
    await storageManager.deleteEvent(event.id);
    
    const results = await storageManager.searchEvents('即将删除');
    expect(results.length).toBe(0);
  });
  
  test('中文分词搜索', async () => {
    await storageManager.createEvent({
      simpleTitle: '北京大学校园参观'
    });
    
    // 应该支持部分匹配
    const results1 = await storageManager.searchEvents('北京');
    const results2 = await storageManager.searchEvents('大学');
    const results3 = await storageManager.searchEvents('校园');
    
    expect(results1.length).toBeGreaterThan(0);
    expect(results2.length).toBeGreaterThan(0);
    expect(results3.length).toBeGreaterThan(0);
  });
  
  test('性能测试 - <50ms', async () => {
    // 创建1000个测试事件
    for (let i = 0; i < 1000; i++) {
      await storageManager.createEvent({
        simpleTitle: `测试事件 ${i}`
      });
    }
    
    const startTime = performance.now();
    await storageManager.searchEvents('测试');
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(50); // <50ms
  });
});
```

**成功标准**:
- ✅ 所有测试用例通过
- ✅ 搜索延迟 <50ms
- ✅ UPDATE/DELETE 触发器正常
- ✅ 中文分词支持

---

#### 3. FTS5 外部内容表文档 📚
**预计时间**: 3 小时  
**负责人**: AI Agent  
**DDL**: 后天 (2025-12-04)

**文档结构**:
```markdown
# FTS5 外部内容表最佳实践

## 什么是外部内容表？
外部内容表是 FTS5 的一种优化模式，将搜索索引与原始数据分离存储。

优势：
- 节省 30-50% 存储空间（不重复存储数据）
- 保持数据一致性（触发器自动同步）

## 正确的触发器语法 ⚠️

### ❌ 错误写法（导致 SQLITE_CORRUPT_VTAB）
```sql
CREATE TRIGGER fts_update AFTER UPDATE ON events BEGIN
    DELETE FROM events_fts WHERE rowid = old.rowid;  -- 错误！
    INSERT INTO events_fts VALUES (new.rowid, ...);
END;
```

### ✅ 正确写法（使用 FTS5 特殊命令）
```sql
CREATE TRIGGER fts_update AFTER UPDATE ON events BEGIN
    -- Step 1: 删除旧索引（使用 FTS5 'delete' 命令）
    INSERT INTO events_fts(events_fts, rowid, id, title, description)
    VALUES ('delete', old.rowid, old.id, old.title, old.description);
    
    -- Step 2: 插入新索引
    INSERT INTO events_fts(rowid, id, title, description)
    VALUES (new.rowid, new.id, new.title, new.description);
END;
```

## 为什么需要特殊语法？
FTS5 虚拟表不支持 WHERE 子句的 DELETE/UPDATE 语句。
必须使用内部命令：`INSERT INTO fts(fts) VALUES ('delete')`

## 完整示例
[包含 INSERT/UPDATE/DELETE 三个触发器的完整代码]

## 故障排查
Q: 出现 SQLITE_CORRUPT_VTAB 错误怎么办？
A: 检查 UPDATE/DELETE 触发器是否使用了正确的 'delete' 命令语法。

## 性能优化
- 使用 MATCH 而不是 LIKE
- 限制返回结果数量
- 定期执行 INSERT INTO fts(fts) VALUES ('optimize')
```

---

### 🟠 P1 - 重要任务 (下周完成)

#### 4. 完成附件查看模式组件 🎨
**预计时间**: 16-20 小时  
**负责人**: AI Agent  
**DDL**: 2025-12-06

**待开发组件**:

1. **VideoStreamView** (4-6h)
   - 视频墙布局
   - 连续播放模式
   - 播放器控件

2. **AudioStreamView** (4-6h)
   - 播客风格布局
   - 波形可视化
   - 播放列表

3. **TranscriptView** (4-6h)
   - AI 转录显示
   - 用户编辑功能
   - 音频同步播放

4. **DocumentLibView** (4-6h)
   - PDF 预览
   - 文档列表
   - OCR 搜索

5. **TreeNavigationView** (6-8h)
   - EventTree 层级
   - 拖拽排序
   - 双向链接

6. **BookmarkView** (4-6h)
   - 网页卡片
   - 离线阅读
   - 标签分类

**开发顺序**:
```
Day 1 (今天下午): VideoStreamView + AudioStreamView
Day 2 (明天): TranscriptView + DocumentLibView
Day 3 (后天): TreeNavigationView + BookmarkView
```

---

#### 5. Slate.js 媒体节点插件 🖼️
**预计时间**: 6-8 小时  
**负责人**: AI Agent  
**DDL**: 2025-12-05

**核心功能**:
```typescript
// withImages 插件
export const withImages = (editor: Editor) => {
  const { insertData, isVoid } = editor;
  
  editor.isVoid = (element) => {
    return element.type === 'image' ? true : isVoid(element);
  };
  
  editor.insertData = (data) => {
    const files = data.files;
    
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = async () => {
            // 上传图片
            const attachment = await attachmentService.upload(
              file,
              eventId,
              { type: AttachmentType.IMAGE }
            );
            
            // 插入图片节点
            Transforms.insertNodes(editor, {
              type: 'image',
              url: attachment.localPath,
              attachmentId: attachment.id,
              width: attachment.width,
              height: attachment.height,
              timestamp: attachment.timestamp,
              children: [{ text: '' }]
            });
          };
          reader.readAsArrayBuffer(file);
        }
      }
      return;
    }
    
    insertData(data);
  };
  
  return editor;
};

// 图片渲染组件
export const ImageElement = ({ attributes, children, element }) => {
  const [isResizing, setIsResizing] = useState(false);
  
  return (
    <div {...attributes} className="image-element">
      <div contentEditable={false}>
        <img
          src={`file://${element.url}`}
          alt={element.caption}
          style={{
            width: element.width || 'auto',
            height: element.height || 'auto'
          }}
          draggable={false}
        />
        {element.caption && (
          <div className="image-caption">{element.caption}</div>
        )}
        <div className="image-meta">
          {new Date(element.timestamp).toLocaleString()}
        </div>
      </div>
      {children}
    </div>
  );
};
```

---

#### 6. 数据库健康监控 📊
**预计时间**: 6-8 小时  
**负责人**: AI Agent  
**DDL**: 2025-12-08

**监控指标**:
```typescript
interface DatabaseHealth {
  // 完整性检查
  integrity: {
    passed: boolean;
    errors: string[];
    lastCheck: string;
  };
  
  // 大小监控
  size: {
    indexedDBMB: number;
    sqliteMB: number;
    fileSystemGB: number;
    totalGB: number;
    limits: {
      indexedDB: 250,  // MB
      sqlite: 10240,   // MB (10GB)
      fileSystem: 51200 // MB (50GB)
    };
  };
  
  // 性能监控
  performance: {
    avgQueryMs: number;
    slowQueries: Array<{ sql: string; durationMs: number }>;
    cacheHitRate: number;
  };
  
  // 索引分析
  indexes: {
    total: number;
    unused: string[];
    suggestions: string[];
  };
  
  // 备份状态
  backup: {
    lastDaily: string;
    lastWeekly: string;
    lastMonthly: string;
    totalBackupsMB: number;
  };
}

class DatabaseHealthMonitor {
  async runHealthCheck(): Promise<DatabaseHealth> {
    // 1. PRAGMA integrity_check
    const integrityResult = await this.db.pragma('integrity_check');
    
    // 2. 大小检查
    const sizeInfo = await this.getSizeInfo();
    
    // 3. 性能分析
    const perfStats = await this.getPerformanceStats();
    
    // 4. 索引分析
    const indexStats = await this.analyzeIndexes();
    
    // 5. 备份检查
    const backupStatus = await this.checkBackupStatus();
    
    return {
      integrity: integrityResult,
      size: sizeInfo,
      performance: perfStats,
      indexes: indexStats,
      backup: backupStatus
    };
  }
  
  async analyzeIndexes(): Promise<{ total: number; unused: string[] }> {
    // 查找未使用的索引
    const indexes = await this.db.pragma('index_list');
    const unused: string[] = [];
    
    for (const index of indexes) {
      const stats = await this.db.pragma(`index_info('${index.name}')`);
      if (stats.scan_count === 0) {
        unused.push(index.name);
      }
    }
    
    return { total: indexes.length, unused };
  }
}
```

---

### 🟡 P2 - 增强任务 (两周内)

#### 7. 备份恢复系统 💾
**预计时间**: 8-10 小时  
**DDL**: 2025-12-12

**功能清单**:
- [ ] 自动备份调度（每日/每周/每月）
- [ ] 备份压缩（gzip）
- [ ] 备份保留策略（7天/8周/12个月）
- [ ] 恢复功能（带验证）
- [ ] 备份 UI 界面

---

#### 8. 存储统计仪表板 📈
**预计时间**: 6-8 小时  
**DDL**: 2025-12-12

**UI 功能**:
- [ ] 存储使用情况图表
- [ ] 事件/版本/附件统计
- [ ] 压缩率展示
- [ ] 手动备份/恢复按钮
- [ ] 数据库优化（VACUUM）

---

#### 9. 版本历史 UI 🕐
**预计时间**: 8-10 小时  
**DDL**: 2025-12-15

**功能**:
- [ ] 版本列表展示
- [ ] 版本对比（diff）
- [ ] 恢复到指定版本
- [ ] 版本删除（释放空间）
- [ ] 版本导出

---

### ⚪ P3 - 未来规划 (后续迭代)

#### 10. 多邮箱同步集成
**预计时间**: 2-3 周  
**依赖**: Phase 1-3 完成

**功能**:
- [ ] Outlook / Google / iCloud 认证
- [ ] 账户管理 UI
- [ ] 批量同步
- [ ] 增量同步
- [ ] 冲突解决

---

#### 11. AI 功能集成
**预计时间**: 未定  
**依赖**: 附件系统完成

**功能**:
- [ ] 语音转文字（Whisper API）
- [ ] 图片 OCR（Tesseract.js）
- [ ] 语义搜索（向量数据库）
- [ ] 智能推荐

---

## 📅 时间规划

### 本周 (2025-12-02 ~ 2025-12-08)

| 日期 | 任务 | 预计时间 | 状态 |
|------|------|----------|------|
| 12/2 (今) | 清理日志 | 2h | 📋 待开始 |
| 12/2 (今) | VideoStreamView + AudioStreamView | 8-10h | 📋 待开始 |
| 12/3 (明) | FTS5 单元测试 | 4h | 📋 待开始 |
| 12/3 (明) | TranscriptView + DocumentLibView | 8-10h | 📋 待开始 |
| 12/4 (后) | FTS5 文档 | 3h | 📋 待开始 |
| 12/4 (后) | TreeNavigationView + BookmarkView | 10-12h | 📋 待开始 |
| 12/5 (四) | Slate.js 插件 | 6-8h | 📋 待开始 |
| 12/6 (五) | 上传模态框 UI | 4-6h | 📋 待开始 |
| 12/7-8 (周末) | 数据库健康监控 | 6-8h | 📋 待开始 |

**本周目标**: 完成附件系统核心功能 + P0 任务

---

### 下周 (2025-12-09 ~ 2025-12-15)

| 日期 | 任务 | 预计时间 | 状态 |
|------|------|----------|------|
| 12/9 (一) | 编辑模态框 UI | 4-6h | 📋 待开始 |
| 12/10 (二) | 批量操作 UI | 4-6h | 📋 待开始 |
| 12/11 (三) | 备份恢复系统 | 8-10h | 📋 待开始 |
| 12/12 (四) | 存储统计仪表板 | 6-8h | 📋 待开始 |
| 12/13 (五) | AI 转录集成 (Whisper) | 6-8h | 📋 待开始 |
| 12/14-15 (周末) | 版本历史 UI | 8-10h | 📋 待开始 |

**下周目标**: 完成 P1 任务 + 开始 P2 任务

---

## 🎯 里程碑

```
✅ Milestone 1: 核心存储层 (Phase 1-2)
   └─ 完成时间: 2025-12-02
   └─ 成果: IndexedDB + SQLite + FTS5

🚧 Milestone 2: 附件系统 (Phase 3)
   └─ 预计完成: 2025-12-08
   └─ 进度: 35%

📋 Milestone 3: P0/P1 任务清理
   └─ 预计完成: 2025-12-15
   └─ 进度: 0%

🔮 Milestone 4: 多邮箱同步
   └─ 预计开始: 2025-12-16
   └─ 进度: 0%
```

---

## 📊 进度仪表板

```
存储架构总进度:
████████████░░░░░░░░  45%

Phase 1-2: 核心存储    ████████████████████ 100% ✅
Phase 3: 附件系统      ███████░░░░░░░░░░░░░  35% 🚧
  ├─ 类型系统          ████████████████████ 100% ✅
  ├─ AttachmentService ████████████████░░░░  80% ✅
  ├─ 查看模式组件      █████░░░░░░░░░░░░░░░  25% 🚧
  └─ Slate.js 集成     ░░░░░░░░░░░░░░░░░░░░   0% 📋

P0 任务:               ░░░░░░░░░░░░░░░░░░░░   0% 📋
P1 任务:               ░░░░░░░░░░░░░░░░░░░░   0% 📋
P2 任务:               ░░░░░░░░░░░░░░░░░░░░   0% 📋
```

---

## 🚨 风险提示

1. **时间风险** 🟡
   - 附件系统组件开发量大（8个组件）
   - 可能需要 1.5-2 周而不是 1 周
   - **缓解**: 优先完成核心组件（Gallery/Video/Audio/Transcript）

2. **技术风险** 🟡
   - AI 转录服务需要外部 API（成本/延迟）
   - Slate.js 插件开发复杂度未知
   - **缓解**: 先实现基础功能，AI 功能后置

3. **性能风险** 🟢
   - 大量附件加载可能影响性能
   - **缓解**: 已设计懒加载 + 缩略图 + 虚拟滚动

---

## 📝 备注

### 决策记录

**2025-12-02 决策**:
- ✅ 附件系统优先级从 P3 提升到 P1（用户刚需）
- ✅ 先完成 4 个核心查看模式（Gallery/Video/Audio/Transcript）
- ✅ P0 任务本周必须完成（清理日志 + FTS5 测试 + 文档）

### 技术选型

- **视频播放**: HTML5 `<video>` 标签 (无需额外库)
- **音频波形**: WaveSurfer.js
- **PDF 预览**: PDF.js
- **图片压缩**: Sharp (Electron 端)
- **OCR**: Tesseract.js
- **AI 转录**: OpenAI Whisper API (后续)

---

**维护人**: Copilot + Zoey  
**最后更新**: 2025-12-02 14:45

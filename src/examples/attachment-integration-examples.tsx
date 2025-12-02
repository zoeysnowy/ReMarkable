/**
 * 附件系统集成示例
 * 
 * 演示如何在 ReMarkable 应用中集成附件查看系统
 * 
 * @version 1.0.0
 * @date 2025-12-02
 */

import React, { useState, useEffect } from 'react';
import { AttachmentViewContainer } from '../components/AttachmentViewContainer';
import { attachmentService } from '../services/AttachmentService';
import { Attachment, AttachmentViewMode, Event } from '../types';

// ============================================================================
// 示例 1: 基础集成 - 事件详情页中的附件展示
// ============================================================================

export const EventDetailWithAttachments: React.FC<{ event: Event }> = ({ event }) => {
  const [attachments, setAttachments] = useState<Attachment[]>(
    event.eventlog.attachments || []
  );

  // 处理附件删除
  const handleAttachmentDelete = async (attachmentId: string) => {
    try {
      await attachmentService.deleteAttachment(attachmentId);
      
      // 从状态中移除
      setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
      
      // 可选：刷新事件数据
      // await eventService.refreshEvent(event.id);
    } catch (error) {
      console.error('删除附件失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 处理转录更新
  const handleTranscriptUpdate = async (attachmentId: string, editedSummary: string) => {
    try {
      // 更新附件的转录数据
      const attachment = attachments.find((a) => a.id === attachmentId);
      if (!attachment?.transcriptData) return;

      const updatedTranscriptData = {
        ...attachment.transcriptData,
        editedSummary,
        status: 'completed' as const,
      };

      // 调用服务更新
      await attachmentService.updateAttachment(attachmentId, {
        transcriptData: updatedTranscriptData,
      });

      // 更新本地状态
      setAttachments((prev) =>
        prev.map((att) =>
          att.id === attachmentId
            ? { ...att, transcriptData: updatedTranscriptData }
            : att
        )
      );
    } catch (error) {
      console.error('更新转录失败:', error);
      alert('保存失败，请重试');
    }
  };

  return (
    <div className="event-detail-page">
      {/* 事件基本信息 */}
      <div className="event-header">
        <h1>{event.title}</h1>
        <p>{event.eventlog.description}</p>
      </div>

      {/* 附件系统 */}
      <div className="event-attachments">
        <AttachmentViewContainer
          eventId={event.id}
          attachments={attachments}
          initialMode={AttachmentViewMode.EDITOR}
          onAttachmentDelete={handleAttachmentDelete}
          onTranscriptUpdate={handleTranscriptUpdate}
        />
      </div>
    </div>
  );
};

// ============================================================================
// 示例 2: 智能初始模式选择
// ============================================================================

export const SmartAttachmentView: React.FC<{ event: Event }> = ({ event }) => {
  const attachments = event.eventlog.attachments || [];

  // 根据附件类型智能选择初始模式
  const getInitialMode = (): AttachmentViewMode => {
    if (attachments.length === 0) return AttachmentViewMode.EDITOR;

    const types = attachments.map((a) => a.type);
    
    // 优先级：图片 > 视频 > 音频 > 文档
    if (types.includes('image')) return AttachmentViewMode.GALLERY;
    if (types.includes('video')) return AttachmentViewMode.VIDEO_STREAM;
    if (types.includes('audio')) return AttachmentViewMode.AUDIO_STREAM;
    if (types.includes('voice-recording')) return AttachmentViewMode.TRANSCRIPT;
    if (types.includes('document')) return AttachmentViewMode.DOCUMENT_LIB;
    if (types.includes('sub-event')) return AttachmentViewMode.TREE_NAV;
    if (types.includes('web-clip')) return AttachmentViewMode.BOOKMARK;

    return AttachmentViewMode.EDITOR;
  };

  return (
    <AttachmentViewContainer
      eventId={event.id}
      attachments={attachments}
      initialMode={getInitialMode()}
      onAttachmentDelete={async (id) => {
        await attachmentService.deleteAttachment(id);
        // 刷新事件
      }}
    />
  );
};

// ============================================================================
// 示例 3: 带上传功能的完整页面
// ============================================================================

export const AttachmentManagementPage: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 加载附件列表
  useEffect(() => {
    const loadAttachments = async () => {
      try {
        const list = await attachmentService.getAttachmentsByEvent(eventId);
        setAttachments(list);
      } catch (error) {
        console.error('加载附件失败:', error);
      }
    };

    loadAttachments();
  }, [eventId]);

  // 处理文件上传
  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      // 批量上传（5个并发）
      const results = await attachmentService.batchUpload(eventId, Array.from(files));
      
      // 更新附件列表
      setAttachments((prev) => [...prev, ...results.filter(r => r.success).map(r => r.attachment!)]);
      
      // 显示结果
      const successCount = results.filter(r => r.success).length;
      alert(`成功上传 ${successCount} 个文件`);
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="attachment-management-page">
      {/* 上传区域 */}
      <div className="upload-section">
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          disabled={isUploading}
        />
        {isUploading && <p>上传中...</p>}
      </div>

      {/* 附件查看 */}
      <AttachmentViewContainer
        eventId={eventId}
        attachments={attachments}
        onAttachmentDelete={async (id) => {
          await attachmentService.deleteAttachment(id);
          setAttachments((prev) => prev.filter((a) => a.id !== id));
        }}
      />
    </div>
  );
};

// ============================================================================
// 示例 4: 只读模式（不可删除）
// ============================================================================

export const ReadOnlyAttachmentView: React.FC<{ event: Event }> = ({ event }) => {
  return (
    <AttachmentViewContainer
      eventId={event.id}
      attachments={event.eventlog.attachments || []}
      initialMode={AttachmentViewMode.GALLERY}
      // 不传 onAttachmentDelete，组件会隐藏删除按钮
      onAttachmentClick={(attachment, index) => {
        console.log('Clicked:', attachment, 'at index:', index);
        // 可以打开全屏预览等
      }}
    />
  );
};

// ============================================================================
// 示例 5: 集成到 Slate.js 编辑器
// ============================================================================

export const EventEditorWithAttachments: React.FC<{ event: Event }> = ({ event }) => {
  const [showAttachments, setShowAttachments] = useState(false);

  return (
    <div className="event-editor-container">
      {/* Slate.js 编辑器 */}
      <div className="slate-editor">
        {/* SlateEditor 组件 */}
      </div>

      {/* 附件切换按钮 */}
      <button
        className="toggle-attachments-btn"
        onClick={() => setShowAttachments(!showAttachments)}
      >
        📎 {showAttachments ? '隐藏' : '显示'}附件 ({event.eventlog.attachments?.length || 0})
      </button>

      {/* 附件面板（可折叠） */}
      {showAttachments && (
        <div className="attachments-panel">
          <AttachmentViewContainer
            eventId={event.id}
            attachments={event.eventlog.attachments || []}
            initialMode={AttachmentViewMode.GALLERY}
            onAttachmentDelete={async (id) => {
              await attachmentService.deleteAttachment(id);
              // 刷新事件数据
            }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 示例 6: 自定义回调 - 跳转到子事件
// ============================================================================

export const EventTreeWithNavigation: React.FC<{ event: Event }> = ({ event }) => {
  const navigate = (targetEventId: string) => {
    // 跳转逻辑（React Router 或自定义路由）
    window.location.href = `/event/${targetEventId}`;
    // 或者: history.push(`/event/${targetEventId}`);
  };

  return (
    <AttachmentViewContainer
      eventId={event.id}
      attachments={event.eventlog.attachments || []}
      initialMode={AttachmentViewMode.TREE_NAV}
      onNavigate={navigate}  // 处理子事件跳转
    />
  );
};

// ============================================================================
// 工具函数：批量操作
// ============================================================================

/**
 * 批量删除附件
 */
export const batchDeleteAttachments = async (attachmentIds: string[]) => {
  const results = await Promise.allSettled(
    attachmentIds.map((id) => attachmentService.deleteAttachment(id))
  );

  const successCount = results.filter((r) => r.status === 'fulfilled').length;
  const failCount = results.filter((r) => r.status === 'rejected').length;

  console.log(`批量删除完成: 成功 ${successCount}, 失败 ${failCount}`);
  return { successCount, failCount };
};

/**
 * 导出附件列表为 JSON
 */
export const exportAttachments = (attachments: Attachment[]) => {
  const data = JSON.stringify(attachments, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `attachments-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
};

/**
 * 统计附件类型分布
 */
export const getAttachmentStats = (attachments: Attachment[]) => {
  const stats = attachments.reduce((acc, att) => {
    acc[att.type] = (acc[att.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return stats;
};

// 使用示例
/*
const stats = getAttachmentStats(event.eventlog.attachments);
console.log('附件统计:', stats);
// { image: 10, video: 3, audio: 2, document: 5 }
*/

/**
 * 🌲 EditableEventTree - 可编辑的事件树
 * 
 * 基于 Slate 编辑器的树形事件管理器
 * 
 * 功能：
 * - Tab / Shift+Tab: 调整层级（自动创建/更新 parentEventId/childEventIds）
 * - Enter: 创建同级事件
 * - Alt+Shift+↑/↓: 移动事件
 * - 双向数据绑定：编辑器 ↔ EventService
 * 
 * 架构：
 * - 刚性骨架：bullet list 的缩进层级 = parentEventId/childEventIds
 * - 实时同步：每次调整层级都更新数据库
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement, Node, Path } from 'slate';
import { Slate, Editable, withReact, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { Event } from '../../types';
import { EventService } from '../../services/EventService';
import './EditableEventTree.css';

interface EditableEventTreeProps {
  rootEventId: string;              // 根事件 ID
  onEventClick?: (event: Event) => void;  // 点击事件回调
}

// Slate 节点类型
interface EventTreeNode {
  type: 'event-item';
  eventId: string;
  level: number;                    // 缩进层级 (0, 1, 2, ...)
  children: Array<{ text: string }>;
}

export const EditableEventTree: React.FC<EditableEventTreeProps> = ({
  rootEventId,
  onEventClick,
}) => {
  const [editor] = useState(() => withHistory(withReact(createEditor())));
  const [initialValue, setInitialValue] = useState<Descendant[]>([
    {
      type: 'event-item',
      eventId: rootEventId,
      level: 0,
      children: [{ text: '加载中...' }],
    } as any,
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // 从 EventService 加载事件树
  const loadEventTree = useCallback(async () => {
    try {
      const rootEvent = await EventService.getEventById(rootEventId);
      if (!rootEvent) {
        console.error('根事件不存在:', rootEventId);
        return;
      }

      // 递归构建树形结构
      const buildTree = async (event: Event, level: number): Promise<EventTreeNode[]> => {
        const title = typeof event.title === 'string' 
          ? event.title 
          : (event.title?.simpleTitle || event.title?.colorTitle || '无标题');

        const node: EventTreeNode = {
          type: 'event-item',
          eventId: event.id,
          level,
          children: [{ text: title }],
        };

        const nodes: EventTreeNode[] = [node];

        // 递归加载子事件
        if (event.childEventIds && event.childEventIds.length > 0) {
          for (const childId of event.childEventIds) {
            const child = await EventService.getEventById(childId);
            if (child && EventService.shouldShowInEventTree(child)) {
              const childNodes = await buildTree(child, level + 1);
              nodes.push(...childNodes);
            }
          }
        }

        return nodes;
      };

      const treeNodes = await buildTree(rootEvent, 0);
      setInitialValue(treeNodes as any);
      setIsLoading(false);
    } catch (error) {
      console.error('加载事件树失败:', error);
      setIsLoading(false);
    }
  }, [rootEventId]);

  useEffect(() => {
    loadEventTree();
  }, [loadEventTree]);

  // 处理键盘事件
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      
      const { selection } = editor;
      if (!selection) return;

      const [node, path] = Editor.node(editor, selection);
      if (!SlateElement.isElement(node) || node.type !== 'event-item') return;

      const currentLevel = (node as any).level || 0;

      if (event.shiftKey) {
        // Shift+Tab: 减少缩进（提升层级）
        if (currentLevel > 0) {
          Transforms.setNodes(
            editor,
            { level: currentLevel - 1 } as any,
            { at: path }
          );
          updateParentRelation(editor, path, currentLevel - 1);
        }
      } else {
        // Tab: 增加缩进（降低层级）
        Transforms.setNodes(
          editor,
          { level: currentLevel + 1 } as any,
          { at: path }
        );
        updateParentRelation(editor, path, currentLevel + 1);
      }
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      // Enter: 创建同级新事件
      const { selection } = editor;
      if (!selection) return;

      const [node, path] = Editor.node(editor, selection);
      if (!SlateElement.isElement(node) || node.type !== 'event-item') return;

      const currentLevel = (node as any).level || 0;
      
      // 创建新事件
      createNewEvent(editor, path, currentLevel);
    } else if (event.altKey && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      
      // Alt+Shift+↑/↓: 移动节点
      const { selection } = editor;
      if (!selection) return;

      const [, path] = Editor.node(editor, selection);
      
      if (event.key === 'ArrowUp' && path[0] > 0) {
        // 向上移动
        Transforms.moveNodes(editor, {
          at: path,
          to: [path[0] - 1],
        });
      } else if (event.key === 'ArrowDown') {
        // 向下移动
        const nextPath = [path[0] + 1];
        if (Editor.hasPath(editor, nextPath)) {
          Transforms.moveNodes(editor, {
            at: path,
            to: [path[0] + 2],
          });
        }
      }
    }
  }, [editor]);

  // 更新父子关系
  const updateParentRelation = async (editor: Editor, path: Path, newLevel: number) => {
    const [node] = Editor.node(editor, path);
    if (!SlateElement.isElement(node) || node.type !== 'event-item') return;

    const eventId = (node as any).eventId;
    if (!eventId) return;

    // 查找新的父事件（向上查找同级或上级）
    let parentEventId: string | null = null;
    
    if (newLevel > 0) {
      // 向上遍历，找到第一个 level = newLevel - 1 的节点
      for (let i = path[0] - 1; i >= 0; i--) {
        const [prevNode] = Editor.node(editor, [i]);
        if (SlateElement.isElement(prevNode) && prevNode.type === 'event-item') {
          const prevLevel = (prevNode as any).level || 0;
          if (prevLevel === newLevel - 1) {
            parentEventId = (prevNode as any).eventId;
            break;
          } else if (prevLevel < newLevel - 1) {
            break; // 跨层级，停止查找
          }
        }
      }
    }

    // 更新数据库
    try {
      const event = await EventService.getEventById(eventId);
      if (event) {
        const oldParentId = event.parentEventId;
        
        // 从旧父事件移除
        if (oldParentId) {
          const oldParent = await EventService.getEventById(oldParentId);
          if (oldParent && oldParent.childEventIds) {
            await EventService.updateEvent(oldParentId, {
              childEventIds: oldParent.childEventIds.filter(id => id !== eventId),
            });
          }
        }

        // 添加到新父事件
        if (parentEventId) {
          const newParent = await EventService.getEventById(parentEventId);
          if (newParent) {
            const newChildIds = [...(newParent.childEventIds || []), eventId];
            await EventService.updateEvent(parentEventId, {
              childEventIds: newChildIds,
            });
          }
        }

        // 更新当前事件的 parentEventId
        await EventService.updateEvent(eventId, {
          parentEventId: parentEventId || undefined,
        });

        console.log('✅ 更新父子关系:', {
          eventId,
          oldParentId,
          newParentId: parentEventId,
          newLevel,
        });
      }
    } catch (error) {
      console.error('❌ 更新父子关系失败:', error);
    }
  };

  // 创建新事件
  const createNewEvent = async (editor: Editor, currentPath: Path, level: number) => {
    try {
      // 查找父事件 ID
      let parentEventId: string | null = null;
      if (level > 0) {
        for (let i = currentPath[0] - 1; i >= 0; i--) {
          const [prevNode] = Editor.node(editor, [i]);
          if (SlateElement.isElement(prevNode) && prevNode.type === 'event-item') {
            const prevLevel = (prevNode as any).level || 0;
            if (prevLevel === level - 1) {
              parentEventId = (prevNode as any).eventId;
              break;
            }
          }
        }
      }

      // 创建新事件
      const newEvent = await EventService.createEvent({
        title: { simpleTitle: '' },
        parentEventId: parentEventId || undefined,
        isTask: false,
      } as any);

      // 更新父事件的 childEventIds
      if (parentEventId) {
        const parent = await EventService.getEventById(parentEventId);
        if (parent) {
          await EventService.updateEvent(parentEventId, {
            childEventIds: [...(parent.childEventIds || []), newEvent.id],
          });
        }
      }

      // 插入新节点到编辑器
      const newNode: EventTreeNode = {
        type: 'event-item',
        eventId: newEvent.id,
        level,
        children: [{ text: '' }],
      };

      Transforms.insertNodes(editor, newNode as any, {
        at: [currentPath[0] + 1],
      });

      // 聚焦到新节点
      Transforms.select(editor, {
        anchor: { path: [currentPath[0] + 1, 0], offset: 0 },
        focus: { path: [currentPath[0] + 1, 0], offset: 0 },
      });

      console.log('✅ 创建新事件:', newEvent.id);
    } catch (error) {
      console.error('❌ 创建新事件失败:', error);
    }
  };

  // 渲染事件节点
  const renderElement = useCallback((props: any) => {
    const { attributes, children, element } = props;

    if (element.type === 'event-item') {
      const level = element.level || 0;
      const paddingLeft = level * 24; // 每层缩进 24px

      return (
        <div
          {...attributes}
          className="event-tree-item"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {/* Bullet Point */}
          <span className="event-bullet" contentEditable={false}>
            •
          </span>
          
          {/* 事件标题（可编辑） */}
          <span className="event-title-editable">{children}</span>
        </div>
      );
    }

    return <div {...attributes}>{children}</div>;
  }, []);

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>加载中...</div>;
  }

  return (
    <div className="editable-event-tree">
      <Slate
        editor={editor}
        initialValue={initialValue}
        onChange={(value) => {
          // 实时保存标题变更
          // TODO: 防抖优化
        }}
      >
        <Editable
          renderElement={renderElement}
          onKeyDown={handleKeyDown}
          placeholder="按 Enter 创建事件，Tab 调整层级..."
        />
      </Slate>

      {/* 快捷键提示 */}
      <div className="keyboard-hints">
        <span>Enter: 新建同级</span>
        <span>Tab: 降级</span>
        <span>Shift+Tab: 升级</span>
        <span>Alt+Shift+↑↓: 移动</span>
      </div>
    </div>
  );
};

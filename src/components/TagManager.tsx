import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './TagManager.css';
import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';
import { TagService, HierarchicalTag as BaseHierarchicalTag } from '../services/TagService';

// 扩展TagService的类型，添加UI需要的属性
export interface HierarchicalTag extends BaseHierarchicalTag {
  level?: number;
  isExpanded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  microsoftService?: any; // MicrosoftCalendarService实例
  onTagsUpdated?: (tags: HierarchicalTag[]) => void; // 标签更新回调
}

const TagManager: React.FC<TagManagerProps> = ({
  isOpen,
  onClose,
  microsoftService,
  onTagsUpdated
}) => {
  const [tags, setTags] = useState<HierarchicalTag[]>([]);
  const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<HierarchicalTag | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTag, setEditingTag] = useState<HierarchicalTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTag, setNewTag] = useState({
    name: '',
    color: '#3b82f6',
    parentId: '',
    calendarId: ''
  });
  const [editTag, setEditTag] = useState({
    name: '',
    color: '#3b82f6',
    calendarId: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadTags();
      if (microsoftService) {
        loadCalendars();
      }
    }
  }, [isOpen, microsoftService]);

  // 🔄 监听TagService变化
  useEffect(() => {
    const handleTagsUpdate = (updatedTags: HierarchicalTag[]) => {
      console.log('🔄 [TagManager] TagService updated, reloading tags');
      setTags(updatedTags);
    };

    TagService.addListener(handleTagsUpdate);
    
    return () => {
      TagService.removeListener(handleTagsUpdate);
    };
  }, []);

  const loadTags = () => {
    // 使用TagService获取标签
    if (TagService.isInitialized()) {
      const hierarchicalTags = TagService.getTags();
      console.log('🔍 [TagManager] Loading tags from TagService:', hierarchicalTags.length);
      // TagService.getTags()已经返回层级结构，直接使用
      setTags(hierarchicalTags);
    } else {
      console.log('🔍 [TagManager] TagService not initialized yet');
      setTags([]);
    }
  };

  const loadCalendars = async () => {
    try {
      const calendars = await microsoftService.getAllCalendars();
      setAvailableCalendars(calendars);
    } catch (error) {
      console.error('加载日历列表失败:', error);
    }
  };

  const buildTagHierarchy = (flatTags: any[]): HierarchicalTag[] => {
    const tagMap = new Map<string, HierarchicalTag>();
    const rootTags: HierarchicalTag[] = [];

    // 创建映射并初始化children数组
    flatTags.forEach(tag => {
      const tagWithChildren = { ...tag, children: [], level: 0 };
      tagMap.set(tag.id, tagWithChildren);
    });

    // 构建层级关系并计算level
    const calculateLevel = (tagId: string, currentLevel: number = 0): void => {
      const tag = tagMap.get(tagId);
      if (tag) {
        tag.level = currentLevel;
        tag.children?.forEach(child => {
          calculateLevel(child.id, currentLevel + 1);
        });
      }
    };

    flatTags.forEach(tag => {
      const tagWithChildren = tagMap.get(tag.id)!;
      if (tag.parentId && tagMap.has(tag.parentId)) {
        const parent = tagMap.get(tag.parentId)!;
        parent.children!.push(tagWithChildren);
      } else {
        rootTags.push(tagWithChildren);
      }
    });

    // 计算所有标签的level
    rootTags.forEach(tag => calculateLevel(tag.id, 0));

    return rootTags;
  };

  const flattenTags = (hierarchicalTags: HierarchicalTag[]): HierarchicalTag[] => {
    const result: HierarchicalTag[] = [];
    
    const flatten = (tags: HierarchicalTag[]) => {
      tags.forEach(tag => {
        const flatTag = { ...tag };
        delete flatTag.children;
        delete flatTag.isExpanded;
        result.push(flatTag);
        
        if (tag.children && tag.children.length > 0) {
          flatten(tag.children);
        }
      });
    };
    
    flatten(hierarchicalTags);
    return result;
  };

  const saveTags = async (tagsToSave: HierarchicalTag[]) => {
    // 使用TagService保存标签
    await TagService.updateTags(tagsToSave);
    console.log('🔍 [TagManager] Saved tags via TagService, count:', tagsToSave.length);
    
    // 通知App.tsx标签已更新
    if (onTagsUpdated) {
      onTagsUpdated(tagsToSave);
    }
    
    // 🔧 [NEW] 触发App.tsx重新加载标签用于编辑
    // 发送自定义事件通知App.tsx更新标签列表
    window.dispatchEvent(new CustomEvent('tags-updated', {
      detail: { flatTags: tagsToSave }
    }));
  };

  const handleCreateTag = () => {
    if (!newTag.name.trim()) {
      alert('请输入标签名称');
      return;
    }

    const now = new Date().toISOString();
    const parentTag = newTag.parentId ? findTagById(tags, newTag.parentId) : null;
    const level = parentTag ? (parentTag.level || 0) + 1 : 0;

    const tag: HierarchicalTag = {
      id: `tag-${Date.now()}`,
      name: newTag.name.trim(),
      color: newTag.color,
      parentId: newTag.parentId || undefined,
      level,
      children: [],
      createdAt: now,
      updatedAt: now,
      calendarMapping: newTag.calendarId ? {
        calendarId: newTag.calendarId,
        calendarName: availableCalendars.find(c => c.id === newTag.calendarId)?.name || ''
      } : undefined
    };

    const updatedTags = addTagToHierarchy(tags, tag);
    setTags(updatedTags);
    saveTags(updatedTags); // 🔧 修复：保存层级结构，不要扁平化

    // 重置表单
    setNewTag({
      name: '',
      color: '#3b82f6',
      parentId: '',
      calendarId: ''
    });
    setShowCreateForm(false);
  };

  const findTagById = (tagList: HierarchicalTag[], id: string): HierarchicalTag | null => {
    for (const tag of tagList) {
      if (tag.id === id) return tag;
      if (tag.children) {
        const found = findTagById(tag.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const addTagToHierarchy = (tagList: HierarchicalTag[], newTag: HierarchicalTag): HierarchicalTag[] => {
    if (!newTag.parentId) {
      return [...tagList, newTag];
    }

    return tagList.map(tag => {
      if (tag.id === newTag.parentId) {
        return {
          ...tag,
          children: [...(tag.children || []), newTag]
        };
      }
      if (tag.children) {
        return {
          ...tag,
          children: addTagToHierarchy(tag.children, newTag)
        };
      }
      return tag;
    });
  };

  const toggleTagExpansion = (tagId: string) => {
    const updateExpansion = (tagList: HierarchicalTag[]): HierarchicalTag[] => {
      return tagList.map(tag => {
        if (tag.id === tagId) {
          return { ...tag, isExpanded: !tag.isExpanded };
        }
        if (tag.children) {
          return { ...tag, children: updateExpansion(tag.children) };
        }
        return tag;
      });
    };

    setTags(updateExpansion(tags));
  };

  const handleDeleteTag = (tagId: string) => {
    if (!window.confirm('确定要删除这个标签吗？这将删除所有子标签！')) {
      return;
    }

    const removeTag = (tagList: HierarchicalTag[]): HierarchicalTag[] => {
      return tagList.filter(tag => {
        if (tag.id === tagId) return false;
        if (tag.children) {
          tag.children = removeTag(tag.children);
        }
        return true;
      });
    };

    const updatedTags = removeTag(tags);
    setTags(updatedTags);
    saveTags(updatedTags); // 🔧 修复：保存层级结构，不要扁平化
  };

  const handleEditTag = (tag: HierarchicalTag) => {
    setEditingTag(tag);
    setEditTag({
      name: tag.name,
      color: tag.color,
      calendarId: tag.calendarMapping?.calendarId || ''
    });
    setShowEditForm(true);
  };

  const handleUpdateTag = () => {
    if (!editTag.name.trim() || !editingTag) {
      alert('请输入标签名称');
      return;
    }

    const updateTag = (tagList: HierarchicalTag[]): HierarchicalTag[] => {
      return tagList.map(tag => {
        if (tag.id === editingTag.id) {
          return {
            ...tag,
            name: editTag.name.trim(),
            color: editTag.color,
            calendarMapping: editTag.calendarId ? {
              calendarId: editTag.calendarId,
              calendarName: availableCalendars.find(c => c.id === editTag.calendarId)?.name || ''
            } : undefined,
            updatedAt: new Date().toISOString()
          };
        }
        if (tag.children) {
          return {
            ...tag,
            children: updateTag(tag.children)
          };
        }
        return tag;
      });
    };

    const updatedTags = updateTag(tags);
    setTags(updatedTags);
    saveTags(updatedTags); // 🔧 修复：保存层级结构，不要扁平化

    // 重置表单
    setEditingTag(null);
    setEditTag({
      name: '',
      color: '#3b82f6',
      calendarId: ''
    });
    setShowEditForm(false);
  };

  const updateTagCalendarMapping = async (tagId: string, calendarId: string) => {
    const calendar = availableCalendars.find(c => c.id === calendarId);
    
    try {
      // 🔧 使用TagService更新映射
      const mapping = calendar ? {
        calendarId: calendar.id,
        calendarName: calendar.name
      } : null;
      
      await TagService.updateTagCalendarMapping(tagId, mapping);
      
      // 🔄 通知ActionBasedSyncManager移动相关事件
      const syncManager = (window as any).actionBasedSyncManager;
      if (syncManager && syncManager.handleTagMappingChange) {
        console.log(`🔄 [TagManager] Tag mapping changed for ${tagId}, moving associated events`);
        await syncManager.handleTagMappingChange(tagId, mapping);
      }
      
      console.log(`✅ [TagManager] Updated calendar mapping for tag ${tagId}`);
    } catch (error) {
      console.error('❌ [TagManager] Failed to update calendar mapping:', error);
    }
  };

  const renderTag = (tag: HierarchicalTag) => {
    const hasChildren = tag.children && tag.children.length > 0;
    const isExpanded = tag.isExpanded;

    return (
      <div key={tag.id} className="tag-item" style={{ marginLeft: `${(tag.level || 0) * 20}px` }}>
        <div className="tag-content">
          <div className="tag-info">
            {hasChildren && (
              <button
                className="expand-button"
                onClick={() => toggleTagExpansion(tag.id)}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <div
              className="tag-color-indicator"
              style={{ backgroundColor: tag.color }}
            />
            <span className="tag-name">{tag.name}</span>
            {tag.calendarMapping && (
              <span className="calendar-mapping">
                → {tag.calendarMapping.calendarName}
              </span>
            )}
          </div>
          
          <div className="tag-actions">
            <select
              value={tag.calendarMapping?.calendarId || ''}
              onChange={(e) => updateTagCalendarMapping(tag.id, e.target.value)}
              className="calendar-select"
            >
              <option value="">选择日历</option>
              {availableCalendars.map(calendar => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
            
            <button
              className="btn btn-edit"
              onClick={() => handleEditTag(tag)}
              title="编辑标签"
            >
              ✏️
            </button>
            
            <button
              className="btn btn-create-child"
              onClick={() => {
                setNewTag({ ...newTag, parentId: tag.id });
                setShowCreateForm(true);
              }}
              title="添加子标签"
            >
              ➕
            </button>
            
            <button
              className="btn btn-delete"
              onClick={() => handleDeleteTag(tag.id)}
              title="删除标签"
            >
              🗑️
            </button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="tag-children">
            {tag.children!.map(child => renderTag(child))}
          </div>
        )}
      </div>
    );
  };

  const filteredTags = searchQuery
    ? tags.filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tags;

  if (!isOpen) return null;

  return createPortal(
    <div className="tag-manager-overlay" onClick={onClose}>
      <div className="tag-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="tag-manager-header">
          <h3>🏷️ 分级标签管理</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="tag-manager-content">
          <div className="tag-manager-toolbar">
            <div className="search-section">
              <input
                type="text"
                placeholder="搜索标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
            >
              新建标签
            </button>
          </div>

          {showCreateForm && (
            <div className="create-tag-form">
              <h4>创建新标签</h4>
              
              <div className="form-row">
                <label>标签名称</label>
                <input
                  type="text"
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  placeholder="输入标签名称"
                />
              </div>
              
              <div className="form-row">
                <label>标签颜色</label>
                <input
                  type="color"
                  value={newTag.color}
                  onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                />
              </div>
              
              <div className="form-row">
                <label>父级标签</label>
                <select
                  value={newTag.parentId}
                  onChange={(e) => setNewTag({ ...newTag, parentId: e.target.value })}
                >
                  <option value="">作为根标签</option>
                  {flattenTags(tags).map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {'  '.repeat(tag.level || 0)} {tag.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-row">
                <label>关联日历</label>
                <select
                  value={newTag.calendarId}
                  onChange={(e) => setNewTag({ ...newTag, calendarId: e.target.value })}
                >
                  <option value="">不关联日历</option>
                  {availableCalendars.map(calendar => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-actions">
                <button onClick={handleCreateTag} className="btn btn-primary">
                  创建标签
                </button>
                <button onClick={() => setShowCreateForm(false)} className="btn btn-secondary">
                  取消
                </button>
              </div>
            </div>
          )}

          {showEditForm && editingTag && (
            <div className="edit-tag-form">
              <h4>编辑标签: {editingTag.name}</h4>
              
              <div className="form-row">
                <label>标签名称</label>
                <input
                  type="text"
                  value={editTag.name}
                  onChange={(e) => setEditTag({ ...editTag, name: e.target.value })}
                  placeholder="输入标签名称"
                />
              </div>
              
              <div className="form-row">
                <label>标签颜色</label>
                <input
                  type="color"
                  value={editTag.color}
                  onChange={(e) => setEditTag({ ...editTag, color: e.target.value })}
                />
              </div>
              
              <div className="form-row">
                <label>关联日历</label>
                <select
                  value={editTag.calendarId}
                  onChange={(e) => setEditTag({ ...editTag, calendarId: e.target.value })}
                >
                  <option value="">不关联日历</option>
                  {availableCalendars.map(calendar => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-actions">
                <button onClick={handleUpdateTag} className="btn btn-primary">
                  更新标签
                </button>
                <button onClick={() => {
                  setShowEditForm(false);
                  setEditingTag(null);
                }} className="btn btn-secondary">
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="tags-tree">
            {filteredTags.map(tag => renderTag(tag))}
          </div>
        </div>

        <div className="tag-manager-footer">
          <div className="stats">
            共 {flattenTags(tags).length} 个标签
          </div>
          <button className="btn btn-primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TagManager;
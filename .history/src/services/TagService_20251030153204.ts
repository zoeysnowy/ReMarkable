/**
 * 标签服务 - 应用级别的标签管理系统
 * 独立于日历同步，为整个应用提供标签功能
 */

import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';
import { STORAGE_KEYS } from '../constants/storage';

export interface HierarchicalTag {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  parentId?: string;
  children?: HierarchicalTag[];
  calendarMapping?: {
    calendarId: string;
    calendarName: string;
  };
}

export interface FlatTag {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  parentId?: string;
  level?: number;
  calendarMapping?: {
    calendarId: string;
    calendarName: string;
  };
}

class TagServiceClass {
  private tags: HierarchicalTag[] = [];
  private flatTags: FlatTag[] = [];
  private listeners: ((tags: HierarchicalTag[]) => void)[] = [];
  private initialized = false;

  // 初始化标签系统
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('🏷️ [TagService] Already initialized, skipping...');
      return;
    }

    console.log('🏷️ [TagService] Initializing tag system...');
    
    try {
      // 从持久化存储加载标签
      const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
      
      if (savedTags && Array.isArray(savedTags) && savedTags.length > 0) {
        console.log('🏷️ [TagService] Loading existing tags from persistent storage:', savedTags.length);
        this.tags = savedTags;
        // ✅ 重新扁平化以确保添加 level 字段（兼容旧数据）
        this.flatTags = this.flattenTags(savedTags);
        console.log('🏷️ [TagService] Flattened tags sample:', this.flatTags.slice(0, 3));
      } else {
        console.log('🏷️ [TagService] No existing tags found, creating default structure');
        await this.createDefaultTags();
      }
      
      this.initialized = true;
      this.notifyListeners();
      console.log('✅ [TagService] Tag system initialized successfully');
    } catch (error) {
      console.error('❌ [TagService] Failed to initialize:', error);
      // 即使出错也要创建默认标签确保应用可用
      await this.createDefaultTags();
      this.initialized = true;
      this.notifyListeners();
    }
  }

  // 创建默认标签结构
  private async createDefaultTags(): Promise<void> {
    const defaultTags: HierarchicalTag[] = [
      {
        id: 'work',
        name: '工作',
        color: '#3498db',
        children: [
          { id: 'work-meeting', name: '会议', color: '#e74c3c' },
          { id: 'work-project', name: '项目开发', color: '#f39c12' },
          { id: 'work-planning', name: '规划设计', color: '#9b59b6' }
        ]
      },
      {
        id: 'personal',
        name: '个人',
        color: '#2ecc71',
        children: [
          { id: 'personal-study', name: '学习', color: '#1abc9c' },
          { id: 'personal-exercise', name: '运动', color: '#e67e22' },
          { id: 'personal-entertainment', name: '娱乐', color: '#e91e63' }
        ]
      },
      {
        id: 'life',
        name: '生活',
        color: '#95a5a6',
        children: [
          { id: 'life-shopping', name: '购物', color: '#34495e' },
          { id: 'life-healthcare', name: '医疗健康', color: '#16a085' },
          { id: 'life-travel', name: '出行', color: '#2980b9' }
        ]
      }
    ];

    this.tags = defaultTags;
    this.flatTags = this.flattenTags(defaultTags);
    await this.saveTags();
    
    // 标记为已初始化
    localStorage.setItem('remarkable-tags-initialized', 'true');
  }

  // 保存标签到持久化存储
  private async saveTags(): Promise<void> {
    try {
      PersistentStorage.setItem(STORAGE_KEYS.HIERARCHICAL_TAGS, this.tags, PERSISTENT_OPTIONS.TAGS);
      console.log('💾 [TagService] Tags saved to persistent storage');
    } catch (error) {
      console.error('❌ [TagService] Failed to save tags:', error);
    }
  }

  // 扁平化标签层级结构
  private flattenTags(tags: HierarchicalTag[]): FlatTag[] {
    const result: FlatTag[] = [];
    
    const flatten = (tags: HierarchicalTag[], parentId?: string, level: number = 0) => {
      tags.forEach(tag => {
        result.push({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          emoji: tag.emoji,
          parentId: tag.parentId || parentId,
          level: level,
          calendarMapping: tag.calendarMapping
        });
        
        if (tag.children && tag.children.length > 0) {
          flatten(tag.children, tag.id, level + 1);
        }
      });
    };
    
    flatten(tags);
    
    // 如果标签有 parentId 但 level 仍然是 0，说明是扁平结构，需要重新计算 level
    const needsLevelRecalc = result.some(tag => tag.parentId && tag.level === 0);
    if (needsLevelRecalc) {
      const tagMap = new Map(result.map(tag => [tag.id, tag]));
      result.forEach(tag => {
        let level = 0;
        let currentId = tag.parentId;
        while (currentId) {
          level++;
          const parent = tagMap.get(currentId);
          currentId = parent?.parentId;
        }
        tag.level = level;
      });
    }
    
    return result;
  }

  // 构建标签层级结构
  buildTagHierarchy(flatTags: FlatTag[]): HierarchicalTag[] {
    const tagMap = new Map<string, HierarchicalTag>();
    const roots: HierarchicalTag[] = [];

    // 创建所有标签节点
    flatTags.forEach(tag => {
      tagMap.set(tag.id, {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        parentId: tag.parentId,
        children: [],
        calendarMapping: tag.calendarMapping
      });
    });

    // 构建层级关系
    flatTags.forEach(tag => {
      const node = tagMap.get(tag.id)!;
      if (tag.parentId) {
        const parent = tagMap.get(tag.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // 获取所有标签（层级结构）
  getTags(): HierarchicalTag[] {
    return [...this.tags];
  }

  // 获取所有标签（扁平结构）
  getFlatTags(): FlatTag[] {
    // 如果还没有初始化，尝试同步加载
    if (!this.initialized || this.flatTags.length === 0) {
      console.warn('⚠️ [TagService] getFlatTags called before initialization, attempting sync load');
      const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
      if (savedTags && Array.isArray(savedTags) && savedTags.length > 0) {
        this.tags = savedTags;
        this.flatTags = this.flattenTags(savedTags);
        console.log('🏷️ [TagService] Sync loaded tags:', this.flatTags.length);
      }
    }
    return [...this.flatTags];
  }

  // 根据ID获取标签
  getTagById(id: string): FlatTag | null {
    return this.flatTags.find(tag => tag.id === id) || null;
  }

  // 获取标签显示名称（包含父级路径）
  getTagDisplayName(tagId: string): string {
    const tag = this.getTagById(tagId);
    if (!tag) return '未分类';

    if (tag.parentId) {
      const parent = this.getTagById(tag.parentId);
      if (parent) {
        return `${parent.name} > ${tag.name}`;
      }
    }
    
    return tag.name;
  }

  // 更新标签
  async updateTags(newTags: HierarchicalTag[]): Promise<void> {
    this.tags = newTags;
    this.flatTags = this.flattenTags(newTags);
    await this.saveTags();
    this.notifyListeners();
  }

  // 更新标签的日历映射
  async updateTagCalendarMapping(tagId: string, mapping: { calendarId: string; calendarName: string } | null): Promise<void> {
    // 更新层级标签
    const updateInHierarchy = (tags: HierarchicalTag[]): boolean => {
      for (const tag of tags) {
        if (tag.id === tagId) {
          if (mapping) {
            tag.calendarMapping = mapping;
          } else {
            delete tag.calendarMapping;
          }
          return true;
        }
        if (tag.children && updateInHierarchy(tag.children)) {
          return true;
        }
      }
      return false;
    };

    updateInHierarchy(this.tags);
    this.flatTags = this.flattenTags(this.tags);
    await this.saveTags();
    this.notifyListeners();
  }

  // 添加标签变化监听器
  addListener(listener: (tags: HierarchicalTag[]) => void): void {
    this.listeners.push(listener);
  }

  // 移除标签变化监听器
  removeListener(listener: (tags: HierarchicalTag[]) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // 通知所有监听器
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.tags]);
      } catch (error) {
        console.error('❌ [TagService] Error notifying listener:', error);
      }
    });
  }

  // 检查是否已初始化
  isInitialized(): boolean {
    return this.initialized;
  }

  // 强制重新初始化
  async reinitialize(): Promise<void> {
    this.initialized = false;
    this.tags = [];
    this.flatTags = [];
    await this.initialize();
  }

  // 构建标签的完整路径（带颜色和 emoji）
  getTagPath(tagId: string): string {
    const flatTags = this.getFlatTags();
    const tag = flatTags.find(t => t.id === tagId);
    
    if (!tag) {
      console.warn('⚠️ [TagService] Tag not found:', tagId);
      return '';
    }
    
    // 构建层级路径，包含emoji
    const pathParts: { emoji?: string; name: string; color: string }[] = [];
    let currentTag = tag;
    
    while (currentTag) {
      pathParts.unshift({
        emoji: currentTag.emoji,
        name: currentTag.name,
        color: currentTag.color
      });
      
      if (currentTag.parentId) {
        const parentTag = flatTags.find(t => t.id === currentTag.parentId);
        if (parentTag) {
          currentTag = parentTag;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    
    // 生成格式：#emoji名称
    return pathParts.map(part => `#${part.emoji || ''}${part.name}`).join('/');
  }

  // 构建多个标签的路径（用于插入编辑器）
  buildTagsText(tagIds: string[]): string {
    if (tagIds.length === 0) return '';
    
    const paths = tagIds.map(id => this.getTagPath(id)).filter(p => p);
    return paths.join(' ');
  }
}

// 创建单例实例
export const TagService = new TagServiceClass();

// 暴露到全局供调试使用
if (typeof window !== 'undefined') {
  (window as any).TagService = TagService;
}
import React, { useState, useEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import ColorPicker from './ColorPicker';
import CalendarMappingPicker from './CalendarMappingPicker';
import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';
import { icons } from '../assets/icons';
import './TagManager.css';

import { logger } from '../utils/logger';

const TagManagerLogger = logger.module('TagManager');
// ��ǩ���ݳ־û����ߺ���
const saveTagsToStorage = (tags: ExtendedHierarchicalTag[]) => {
  try {
    PersistentStorage.setItem(STORAGE_KEYS.HIERARCHICAL_TAGS, tags, PERSISTENT_OPTIONS.TAGS);
  } catch (error) {
    TagManagerLogger.error('? [TagManager] Failed to save tags:', error);
  }
};

const loadTagsFromStorage = (): ExtendedHierarchicalTag[] => {
  try {
    const saved = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
    return saved ? saved : [];
  } catch (error) {
    TagManagerLogger.error('Failed to load tags from localStorage:', error);
    return [];
  }
};

const saveCheckinCountsToStorage = (counts: { [tagId: string]: number }) => {
  try {
    PersistentStorage.setItem(STORAGE_KEYS.CHECKIN_COUNTS, counts, PERSISTENT_OPTIONS.CHECKIN_COUNTS);
  } catch (error) {
    TagManagerLogger.error('Failed to save checkin counts to localStorage:', error);
  }
};

const loadCheckinCountsFromStorage = (): { [tagId: string]: number } => {
  try {
    const saved = PersistentStorage.getItem(STORAGE_KEYS.CHECKIN_COUNTS, PERSISTENT_OPTIONS.CHECKIN_COUNTS);
    return saved ? saved : {};
  } catch (error) {
    TagManagerLogger.error('Failed to load checkin counts from localStorage:', error);
    return {};
  }
};

// ��չ��ǩ�ӿ�
interface ExtendedHierarchicalTag {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  level?: number;
  parentId?: string;
  position?: number; // ��ǩ���б��е�λ��˳��
  calendarMapping?: {
    calendarId: string;
    calendarName: string;
    color?: string;
  } | undefined;
  dailyAvgCheckins?: number;
  dailyAvgDuration?: number;
  isRecurring?: boolean;
}

interface TagManagerProps {
  microsoftService?: any;
  tagService?: any; // TagServiceʵ��
  availableCalendars?: any[]; // ��ͬ���������б�
  globalTimer?: {
    tagId: string;
    isRunning: boolean;
    startTime: number;
    elapsedTime: number;
  } | null;
  onTimerStart?: (tagId: string) => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
  onTimerStop?: () => void;
  onTagsChange?: (tags: ExtendedHierarchicalTag[]) => void; // ��ǩ�仯�ص�
}

const TagManager: React.FC<TagManagerProps> = ({
  microsoftService,
  tagService,
  availableCalendars,
  globalTimer,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerStop,
  onTagsChange
}) => {
  const [tags, setTags] = useState<ExtendedHierarchicalTag[]>([]);
  const [checkinCounts, setCheckinCounts] = useState<{ [tagId: string]: number }>({});
  
  // �±�ǩ����״̬
  const [newTagId, setNewTagId] = useState<string | null>(null);
  const [isCreatingNewTag, setIsCreatingNewTag] = useState<boolean>(false); // �����������Ƿ����ڴ����±�ǩ
  const [userClickedGrayText, setUserClickedGrayText] = useState<boolean>(false); // �����������û��Ƿ���ȷ����˻�ɫ�ı�
  
  // ѡ����״̬
  const [showColorPicker, setShowColorPicker] = useState<{ 
    show: boolean; 
    tagId: string; 
    position: { x: number; y: number } 
  }>({
    show: false,
    tagId: '',
    position: { x: 0, y: 0 }
  });
  
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ 
    show: boolean; 
    tagId: string; 
    position: { x: number; y: number } 
  }>({
    show: false,
    tagId: '',
    position: { x: 0, y: 0 }
  });
  
  // ��ק���״̬
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // �Ľ���λ�ü��㺯��
  const calculateOptimalPosition = (rect: DOMRect, pickerWidth = 352, pickerHeight = 435) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    
    let x = rect.left;
    let y = rect.bottom + 5;
    
    // �ұ߽���
    if (x + pickerWidth > viewportWidth) {
      x = viewportWidth - pickerWidth - 10;
    }
    
    // ��߽���
    if (x < 10) {
      x = 10;
    }
    
    // �±߽���
    if (y + pickerHeight > viewportHeight + scrollY) {
      y = rect.top - pickerHeight - 5; // ��Ԫ���Ϸ���ʾ
    }
    
    // �ϱ߽���
    if (y < scrollY + 10) {
      y = scrollY + 10;
    }
    
    return { x, y };
  };
  
  
  const [showCalendarPicker, setShowCalendarPicker] = useState<{ 
    show: boolean; 
    tagId: string; 
    position: { x: number; y: number } 
  }>({
    show: false,
    tagId: '',
    position: { x: 0, y: 0 }
  });
  
  // ���hover״̬����
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);
  
  // ?? ׷��ѡ�еı�ǩID�б�
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // ��ʼ������- ��localStorage���ػ�ʹ�ÿ�����
  useEffect(() => {
    const startTime = performance.now();
    TagManagerLogger.log('?? [TagManager] Component initializing...');
    
    const savedTags = loadTagsFromStorage();
    const savedCounts = loadCheckinCountsFromStorage();
    
    TagManagerLogger.log(`?? [TagManager] Loaded ${savedTags.length} tags from storage`);
    
    // ? ����Ǩ�ƣ�����parentId��ϵ����level�㼶
    const calculateTagLevel = (tag: ExtendedHierarchicalTag, allTags: ExtendedHierarchicalTag[], visited = new Set<string>()): number => {
      // ����Ѿ���level,ֱ�ӷ���
      if (tag.level !== undefined) {
        return tag.level;
      }
      
      // ���û��parentId,�Ƕ�����ǩ
      if (!tag.parentId) {
        return 0;
      }
      
      // ��ֹѭ������
      if (visited.has(tag.id)) {
        TagManagerLogger.warn('?? ��⵽ѭ������:', tag.id, tag.name);
        return 0;
      }
      visited.add(tag.id);
      
      // �ҵ�����ǩ
      const parent = allTags.find(t => t.id === tag.parentId);
      if (!parent) {
        TagManagerLogger.warn('?? �Ҳ�������ǩ:', tag.parentId, '���ڱ�ǩ:', tag.name);
        return 0;
      }
      
      // �ݹ���㸸��ǩ��level,Ȼ��+1
      return calculateTagLevel(parent, allTags, visited) + 1;
    };
    
    // Ϊ���б�ǩ����level
    const migratedTags = savedTags.map((tag, index) => ({
      ...tag,
      level: calculateTagLevel(tag, savedTags),
      parentId: tag.parentId || undefined,
      position: tag.position !== undefined ? tag.position : index // ?? ���û��position��ʹ������
    }));
    
    // ?? ��ϣ�������б�ǩ�Ĳ㼶��Ϣ
    TagManagerLogger.log('?? [TagManager] ��ǩ�㼶��Ϣ:');
    console.table(migratedTags.map(tag => ({
      name: tag.name,
      level: tag.level,
      position: tag.position,
      parentId: tag.parentId || '(��)',
      hasLevel: tag.level !== undefined
    })));
    
    // ?? ����б�ǩ��level����������ˣ�����position����ʼ���ˣ�����ش洢��һ����Ǩ�ƣ�
    const hasLevelCalculated = migratedTags.some(tag => 
      tag.level !== undefined && tag.level > 0 && savedTags.find(t => t.id === tag.id && t.level === undefined)
    );
    const hasPositionInitialized = migratedTags.some(tag =>
      tag.position !== undefined && savedTags.find(t => t.id === tag.id && t.position === undefined)
    );
    if (hasLevelCalculated || hasPositionInitialized) {
      TagManagerLogger.log('?? [TagManager] Saving calculated levels and positions to storage...');
      saveTagsToStorage(migratedTags);
    }
    
    // ����б�������ݣ�ʹ�����ǣ������ʼ��Ϊ��
    setTags(migratedTags);
    setCheckinCounts(savedCounts);
    
    const duration = performance.now() - startTime;
    TagManagerLogger.log(`? [TagManager] Initialized in ${duration.toFixed(2)}ms`);
  }, []);

  // �Զ������ǩ���ݵ�localStorage
  useEffect(() => {
    if (tags.length > 0) {
      saveTagsToStorage(tags);
    }
  }, [tags]);

  // �Զ�����򿨼�����localStorage
  useEffect(() => {
    if (Object.keys(checkinCounts).length > 0) {
      saveCheckinCountsToStorage(checkinCounts);
    }
  }, [checkinCounts]);

  // ǿ�Ƹ�������ʾʵʱ��ʱ
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (globalTimer?.isRunning) {
      // ÿ��ǿ�Ƹ���һ��
      interval = setInterval(() => {
        forceUpdate(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [globalTimer?.isRunning]);

  // ����ȫ�ֽ����¼���useEffect - �򻯰汾�������ڵ���
  useEffect(() => {
    const handleGlobalFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.textContent?.includes('������ǩ')) {
        TagManagerLogger.log('?? GLOBAL FOCUS on gray text detected! (Should not happen in new implementation)');
        TagManagerLogger.log('?? Focus event details:', {
          target: target,
          relatedTarget: e.relatedTarget,
          eventType: e.type,
          timeStamp: e.timeStamp,
          bubbles: e.bubbles
        });
        TagManagerLogger.log('?? Call stack:', new Error().stack);
      }
    };

    document.addEventListener('focus', handleGlobalFocus, true); // ʹ��capture�׶�
    
    return () => {
      document.removeEventListener('focus', handleGlobalFocus, true);
    };
  }, []);

  // ֪ͨ�������ǩ�仯 - ��ӷ��������ظ�����
  useEffect(() => {
    TagManagerLogger.log('??? [FigmaTagManager] Tags changed, current count:', tags.length);
    
    // ʹ�� setTimeout ����������Ƶ������
    const timer = setTimeout(() => {
      if (onTagsChange && tags.length > 0) {
        // ?? ��Ӳ㼶��Ϣ���
        TagManagerLogger.log('??? [FigmaTagManager] Calling onTagsChange with tags:', tags.map(t => ({
          id: t.id, 
          name: t.name, 
          level: t.level, // ?? ���level�Ƿ����
          parentId: t.parentId
        })));
        onTagsChange(tags);
      } else if (onTagsChange && tags.length === 0) {
        TagManagerLogger.log('??? [FigmaTagManager] Tags array is empty, not calling onTagsChange');
      } else if (!onTagsChange) {
        TagManagerLogger.warn('?? [FigmaTagManager] onTagsChange callback not provided!');
      }
    }, 100); // 100ms ����
    
    return () => clearTimeout(timer);
  }, [tags, onTagsChange]);

  // Removed global keyboard handler to prevent duplicate events with component handlers

  // ������ɫѡ��
  const handleColorClick = (tagId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setShowColorPicker({
      show: true,
      tagId,
      position: { x: rect.left, y: rect.bottom + 5 }
    });
  };

  const handleColorSelect = (color: string) => {
    setTags(prevTags =>
      prevTags.map(tag =>
        tag.id === showColorPicker.tagId
          ? { ...tag, color }
          : tag
      )
    );
    setShowColorPicker({ show: false, tagId: '', position: { x: 0, y: 0 } });
  };

  // ����emojiѡ��
  const handleEmojiClick = (tagId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const optimalPosition = calculateOptimalPosition(rect);
    setShowEmojiPicker({
      show: true,
      tagId,
      position: optimalPosition
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setTags(prevTags =>
      prevTags.map(tag =>
        tag.id === showEmojiPicker.tagId
          ? { ...tag, emoji }
          : tag
      )
    );
    setShowEmojiPicker({ show: false, tagId: '', position: { x: 0, y: 0 } });
  };

  // ��ק������
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    // �ų�emoji��ť��������Ƚ���Ԫ��
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.tagName === 'BUTTON' || 
                                target.tagName === 'INPUT' || 
                                target.closest('button') || 
                                target.closest('input') ||
                                target.closest('[role="button"]') ||
                                target.classList.contains('emoji') ||
                                target.closest('.emoji');
    
    if (!isInteractiveElement) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - showEmojiPicker.position.x,
        y: e.clientY - showEmojiPicker.position.y
      });
    }
  }, [showEmojiPicker.position]);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isDragging) {
      setShowEmojiPicker(prev => ({
        ...prev,
        position: {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        }
      }));
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  // ���ȫ������¼�����
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, handleMouseMove, handleMouseUp]);

  // ?? ����ճ���¼� - ���������ǩ
  useEffect(() => {
    // ?? �������¼� - �ڼ���������Ӳ㼶����ɫ��Ϣ
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      // ����Ƿ�ѡ���˱�ǩ
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentElement = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container as HTMLElement;
      
      // ��������ѡ�еı�ǩ
      const selectedTags = tags.filter(tag => {
        const tagElement = document.querySelector(`[data-tag-id="${tag.id}"]`);
        if (!tagElement) return false;
        return selection.containsNode(tagElement, true);
      });
      
      if (selectedTags.length === 0) return;
      
      TagManagerLogger.log('?? [Copy] Selected tags:', selectedTags.length);
      
      // ���ɴ��������ı���ʽ
      const textFormat = selectedTags
        .map(tag => {
          const indent = ' '.repeat((tag.level || 0) * 2); // ÿ��2���ո�
          const emoji = tag.emoji || '';
          return `${indent}#${emoji} ${tag.name}`;
        })
        .join('\n');
      
      // ����JSON��ʽ������������Ϣ�����Ϊ���Ʋ�����
      const jsonData = {
        isCut: false, // ���Ϊ���Ʋ���
        tags: selectedTags.map(tag => ({
          id: tag.id, // ����ID���ں�������
          name: tag.name,
          emoji: tag.emoji,
          color: tag.color,
          level: tag.level || 0,
          parentId: tag.parentId
        }))
      };
      
      const jsonFormat = JSON.stringify(jsonData);
      
      // ?? Electron�����£��Զ���MIME���Ϳ��ܲ���֧��
      // ʹ�������� + Base64 ����ķ�ʽ�洢JSON�������ı���
      const jsonBase64 = btoa(encodeURIComponent(jsonFormat));
      const textWithJson = `__REMARKABLE_TAGS_JSON__${jsonBase64}__\n${textFormat}`;
      
      // ͬʱд�����ָ�ʽ��������
      try {
        e.clipboardData?.setData('text/plain', textWithJson);
        e.clipboardData?.setData('application/json', jsonFormat); // ��������JSON�����ܲ���֧�֣�
        e.preventDefault();
        
        TagManagerLogger.log('?? [Copy] Copied to clipboard:', {
          textFormat: textFormat,
          jsonData: jsonData,
          tagsCount: selectedTags.length,
          hasCustomFormat: true
        });
      } catch (error) {
        TagManagerLogger.error('?? [Copy] Error setting clipboard data:', error);
      }
    };

    // ?? ��������¼� - ���Ϊ�ƶ�����
    const handleCut = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      // ��������ѡ�еı�ǩ
      const selectedTags = tags.filter(tag => {
        const tagElement = document.querySelector(`[data-tag-id="${tag.id}"]`);
        if (!tagElement) return false;
        return selection.containsNode(tagElement, true);
      });
      
      if (selectedTags.length === 0) return;
      
      TagManagerLogger.log('?? [Cut] Selected tags:', selectedTags.length);
      
      // ���ɴ��������ı���ʽ
      const textFormat = selectedTags
        .map(tag => {
          const indent = ' '.repeat((tag.level || 0) * 2);
          const emoji = tag.emoji || '';
          return `${indent}#${emoji} ${tag.name}`;
        })
        .join('\n');
      
      // ����JSON��ʽ������������Ϣ��ԭʼID�����Ϊ���в�����
      const jsonData = {
        isCut: true, // ���Ϊ���в���
        tags: selectedTags.map(tag => ({
          id: tag.id, // ����ԭʼID�����ƶ�
          name: tag.name,
          emoji: tag.emoji,
          color: tag.color,
          level: tag.level || 0,
          parentId: tag.parentId
        }))
      };
      
      const jsonFormat = JSON.stringify(jsonData);
      
      // ?? ʹ�������� + Base64 ����洢JSON����
      const jsonBase64 = btoa(encodeURIComponent(jsonFormat));
      const textWithJson = `__REMARKABLE_TAGS_JSON__${jsonBase64}__\n${textFormat}`;
      
      // д�������
      try {
        e.clipboardData?.setData('text/plain', textWithJson);
        e.clipboardData?.setData('application/json', jsonFormat);
        e.preventDefault();
        
        TagManagerLogger.log('?? [Cut] Cut to clipboard:', {
          textFormat: textFormat,
          jsonData: jsonData,
          tagsCount: selectedTags.length
        });
        
        // �����ɾ���ı�ǩID��ճ����ɾ����
        (window as any).__cutTagIds = selectedTags.map(t => t.id);
      } catch (error) {
        TagManagerLogger.error('?? [Cut] Error setting clipboard data:', error);
      }
    };
    
    // ?? ����������������+ճ���������±�ǩ��
    const handleCopyPaste = (tagsData: any[]) => {
      setTags(prevTags => {
        const newTags = [...prevTags];
        const maxPosition = Math.max(...newTags.map(t => t.position || 0), -1);
        
        const idMap = new Map<string, string>(); // ��ID -> ��ID��ӳ��
        
        tagsData.forEach((tagData: any, index: number) => {
          const newId = `tag-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          idMap.set(tagData.id, newId);
          
          // ���Ҹ���ǩ
          let parentId: string | undefined = undefined;
          if (tagData.level > 0) {
            for (let i = index - 1; i >= 0; i--) {
              if (tagsData[i].level < tagData.level) {
                const parentOldId = tagsData[i].id;
                parentId = idMap.get(parentOldId);
                break;
              }
            }
          }
          
          const newTag: ExtendedHierarchicalTag = {
            id: newId,
            name: tagData.name,
            color: tagData.color || '#3b82f6',
            emoji: tagData.emoji,
            level: tagData.level,
            parentId,
            position: maxPosition + index + 1
          };
          
          TagManagerLogger.log(`?? [CopyPaste] Creating tag #${index}:`, { name: newTag.name, color: newTag.color, level: newTag.level });
          newTags.push(newTag);
        });
        
        TagManagerLogger.log('? [CopyPaste] Created new tags:', tagsData.length);
        return newTags;
      });
    };
    
    // ?? �����������������+ճ�����ƶ���ǩ��
    const handleCutPaste = (tagsData: any[]) => {
      setTags(prevTags => {
        const cutTagIds = (window as any).__cutTagIds || [];
        const newTags = [...prevTags];
        const maxPosition = Math.max(...newTags.map(t => t.position || 0), -1);
        
        // 1. ɾ��ԭλ�õı�ǩ
        const remainingTags = newTags.filter(t => !cutTagIds.includes(t.id));
        
        // 2. ����λ����ӱ�ǩ������ԭID��
        tagsData.forEach((tagData: any, index: number) => {
          // �����µĸ���ǩID
          let newParentId: string | undefined = undefined;
          if (tagData.level > 0) {
            for (let i = index - 1; i >= 0; i--) {
              if (tagsData[i].level < tagData.level) {
                newParentId = tagsData[i].id;
                break;
              }
            }
          }
          
          // ����ԭID
          const movedTag: ExtendedHierarchicalTag = {
            id: tagData.id, // ����ԭʼID
            name: tagData.name,
            color: tagData.color || '#3b82f6',
            emoji: tagData.emoji,
            level: tagData.level,
            parentId: newParentId,
            position: maxPosition + index + 1
          };
          
          TagManagerLogger.log(`?? [CutPaste] Moving tag #${index}:`, { name: movedTag.name, color: movedTag.color, level: movedTag.level });
          remainingTags.push(movedTag);
        });
        
        // �����ɾ�����
        delete (window as any).__cutTagIds;
        
        TagManagerLogger.log('? [CutPaste] Moved tags:', tagsData.length);
        return remainingTags;
      });
    };
    
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      
      // ?? ���ȼ���Ƿ������ǵ��Զ����ʽ���� __REMARKABLE_TAGS_JSON__ ��ǣ�
      const pastedText = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text');
      const isRemarkableFormat = pastedText?.startsWith('__REMARKABLE_TAGS_JSON__');
      
      TagManagerLogger.log('?? [Paste] Event triggered:', {
        targetTag: target.tagName,
        isEditable: target.contentEditable === 'true',
        isRemarkableFormat: isRemarkableFormat,
        className: target.className
      });
      
      // ����������ǵĸ�ʽ����Ŀ���ǿɱ༭Ԫ�أ��������������Ĭ��ճ��
      if (!isRemarkableFormat && (target.contentEditable === 'true' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        TagManagerLogger.log('?? [Paste] Allowing default paste behavior in editable element');
        return;
      }
      
      // ��������ǵĸ�ʽ�����������ﶼҪ���������༭��
      TagManagerLogger.log('?? [Paste] Processing paste event');
      TagManagerLogger.log('?? [Paste] Raw pasted text FULL:', pastedText);
      TagManagerLogger.log('?? [Paste] Text starts with marker?', isRemarkableFormat);
      TagManagerLogger.log('?? [Paste] First 200 chars:', pastedText?.substring(0, 200));
      
      if (pastedText && pastedText.startsWith('__REMARKABLE_TAGS_JSON__')) {
        try {
          // ��ȡ Base64 ����� JSON
          const match = pastedText.match(/^__REMARKABLE_TAGS_JSON__(.+?)__\n/);
          if (match) {
            const jsonBase64 = match[1];
            const jsonFormat = decodeURIComponent(atob(jsonBase64));
            const parsedData = JSON.parse(jsonFormat);
            
            TagManagerLogger.log('? [Paste] Extracted JSON from Base64 text successfully:', parsedData);
            
            const isCut = parsedData.isCut === true;
            const tagsData = parsedData.tags || [];
            
            if (Array.isArray(tagsData) && tagsData.length > 0) {
              e.preventDefault();
              
              if (isCut) {
                // ?? ���� + ճ�� = �ƶ�����������ԭID��
                TagManagerLogger.log('?? [Paste] Detected CUT operation from Base64');
                handleCutPaste(tagsData);
              } else {
                // ?? ���� + ճ�� = �½�������������ID��
                TagManagerLogger.log('?? [Paste] Detected COPY operation from Base64');
                handleCopyPaste(tagsData);
              }
              return; // �ɹ������˳�
            }
          }
        } catch (error) {
          TagManagerLogger.warn('?? [Paste] Failed to extract Base64 JSON:', error);
        }
      }
      
      // ?? Step 2: ���˳��Զ�ȡ application/json�����÷�����
      const jsonData = e.clipboardData?.getData('application/json');
      TagManagerLogger.log('?? [Paste] JSON data from clipboard:', jsonData ? 'found' : 'not found');
      
      if (jsonData) {
        try {
          const parsedData = JSON.parse(jsonData);
          TagManagerLogger.log('? [Paste] Parsed application/json successfully:', parsedData);
          
          const isCut = parsedData.isCut === true;
          const tagsData = parsedData.tags || parsedData; // ���ݾɸ�ʽ
          
          if (Array.isArray(tagsData) && tagsData.length > 0) {
            e.preventDefault();
            
            if (isCut) {
              TagManagerLogger.log('?? [Paste] Detected CUT operation from application/json');
              handleCutPaste(tagsData);
            } else {
              TagManagerLogger.log('?? [Paste] Detected COPY operation from application/json');
              handleCopyPaste(tagsData);
            }
            return; // �ɹ�����JSON���˳�
          }
        } catch (error) {
          TagManagerLogger.warn('?? [Paste] Failed to parse application/json, fallback to text:', error);
        }
      }

      // ?? Step 3: �����˵����ı���ʽ������?? �޷�������ɫ��Ϣ��
      if (!pastedText) {
        TagManagerLogger.log('?? [Paste] No paste data found');
        return;
      }
      
      // �Ƴ� Base64 ���ͷ��������ڣ�
      const cleanText = pastedText.replace(/^__REMARKABLE_TAGS_JSON__.+?__\n/, '');
      TagManagerLogger.log('?? [Paste] Using text fallback. Clean text preview:', cleanText.substring(0, 100));
      
      // ?? �ı���ʽ�޷�������ɫ��Ϣ��ֻ��JSON��ʽ������������
      // ��ʽ1: # emoji ���� (��ǰ���ո�)
      // ��ʽ2: #emoji���� (���ո�ʽ)
      // ��ʽ3: # emoji���� (�޿ո�)
      const lines = cleanText.split('\n');
      TagManagerLogger.log('?? [Paste] Total lines:', lines.length);
      
      const parsedTags: Array<{
        name: string;
        emoji?: string;
        level: number;
        color?: string;
      }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; // ��������
        
        TagManagerLogger.log(`?? [Paste] Line ${i}:`, {
          raw: line,
          trimmed: line.trim(),
          leadingSpaces: line.length - line.trimStart().length,
          chars: line.split('').map(c => c.charCodeAt(0))
        });
        
        // ����㼶��ǰ���ո�����
        const leadingSpaces = line.length - line.trimStart().length;
        const level = Math.floor(leadingSpaces / 2); // ÿ2���ո� = 1��
        
        const trimmedLine = line.trim();
        
        // ���Զ���ƥ��ģʽ
        let emoji: string | undefined;
        let name: string;
        
        // ģʽ1: # emoji ���� (��׼��ʽ)
        const pattern1 = /^#\s*([^\s\w]+)\s+(.+)$/;
        const match1 = trimmedLine.match(pattern1);
        
        // ģʽ2: #emoji���� (���ո�ʽ)
        const pattern2 = /^#([^\s\w]+)(.+)$/;
        const match2 = trimmedLine.match(pattern2);
        
        // ģʽ3: # ���� (��emoji)
        const pattern3 = /^#\s+(.+)$/;
        const match3 = trimmedLine.match(pattern3);
        
        if (match1) {
          emoji = match1[1];
          name = match1[2].trim();
          TagManagerLogger.log(`? [Paste] Matched pattern1:`, { emoji, name, level });
        } else if (match2) {
          emoji = match2[1];
          name = match2[2].trim();
          TagManagerLogger.log(`? [Paste] Matched pattern2:`, { emoji, name, level });
        } else if (match3) {
          emoji = undefined;
          name = match3[1].trim();
          TagManagerLogger.log(`? [Paste] Matched pattern3:`, { name, level });
        } else if (trimmedLine.startsWith('#')) {
          // ���ף���ȡ#�����������
          const content = trimmedLine.substring(1).trim();
          // ���Է���emoji������
          const emojiMatch = content.match(/^([^\w\s]+)\s*(.*)$/);
          if (emojiMatch) {
            emoji = emojiMatch[1];
            name = emojiMatch[2] || content;
          } else {
            name = content;
          }
          TagManagerLogger.log(`?? [Paste] Fallback parsing:`, { emoji, name, level, original: trimmedLine });
        } else {
          TagManagerLogger.log(`? [Paste] Line doesn't start with #, skipping:`, trimmedLine);
          continue;
        }
        
        if (name) {
          parsedTags.push({
            name: name.trim(),
            emoji,
            level,
            color: '#3b82f6'
          });
        }
      }

      if (parsedTags.length > 0) {
        TagManagerLogger.log('?? [Paste] Parsed tags:', parsedTags);
        e.preventDefault();
        
        // ����������ǩ
        setTags(prevTags => {
          const newTags = [...prevTags];
          const maxPosition = Math.max(...newTags.map(t => t.position || 0), -1);
          
          parsedTags.forEach((parsedTag, index) => {
            const newId = `tag-${Date.now()}-${index}`;
            
            // ���Ҹ���ǩ����ǰ���ҵ�һ���㼶�ȵ�ǰС�ı�ǩ��
            let parentId: string | undefined = undefined;
            if (parsedTag.level > 0) {
              // ����ճ���ı�ǩ�в��Ҹ���ǩ
              for (let i = index - 1; i >= 0; i--) {
                if (parsedTags[i].level < parsedTag.level) {
                  // �ҵ���Ӧ���´�����ǩID
                  const parentIndex = i;
                  parentId = `tag-${Date.now()}-${parentIndex}`;
                  TagManagerLogger.log(`?? [Paste] Found parent for "${parsedTag.name}":`, {
                    parentName: parsedTags[parentIndex].name,
                    childLevel: parsedTag.level,
                    parentLevel: parsedTags[parentIndex].level
                  });
                  break;
                }
              }
            }
            
            const newTag: ExtendedHierarchicalTag = {
              id: newId,
              name: parsedTag.name,
              color: parsedTag.color || '#3b82f6',
              emoji: parsedTag.emoji,
              level: parsedTag.level,
              parentId,
              position: maxPosition + index + 1
            };
            
            newTags.push(newTag);
            TagManagerLogger.log(`? [Paste] Created tag:`, {
              id: newId,
              name: newTag.name,
              level: newTag.level,
              parentId: newTag.parentId
            });
          });
          
          TagManagerLogger.log('? [Paste] Successfully imported tags:', newTags.length - prevTags.length);
          TagManagerLogger.log('?? [Paste] Final tag structure:', newTags.slice(-parsedTags.length).map(t => ({
            name: t.name,
            level: t.level,
            parentId: t.parentId
          })));
          return newTags;
        });
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
    };
  }, [tags]);

  // ?? ����������ɾ�����ƶ�
  useEffect(() => {
    const getSelectedTags = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return [];
      
      return tags.filter(tag => {
        const tagElement = document.querySelector(`[data-tag-id="${tag.id}"]`);
        if (!tagElement) return false;
        return selection.containsNode(tagElement, true);
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // ?? ����ڱ༭���ڣ�������������
      if (target.contentEditable === 'true' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const selectedTags = getSelectedTags();
      if (selectedTags.length === 0) return;

      // ??? Delete/Backspace - ����ɾ��
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        
        if (confirm(`ȷ��Ҫɾ��ѡ�е� ${selectedTags.length} ����ǩ��`)) {
          TagManagerLogger.log('??? [Batch Delete] Deleting tags:', selectedTags.map(t => t.name));
          
          setTags(prevTags => {
            const selectedIds = new Set(selectedTags.map(t => t.id));
            return prevTags.filter(tag => !selectedIds.has(tag.id));
          });
          
          // ���ѡ��
          window.getSelection()?.removeAllRanges();
        }
      }

      // ???? Shift+Alt+��/�� - ���������ƶ�
      if (e.shiftKey && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        TagManagerLogger.log(`?? [Batch Move] Moving ${selectedTags.length} tags ${direction > 0 ? 'down' : 'up'}`);
        
        setTags(prevTags => {
          const newTags = [...prevTags].sort((a, b) => (a.position || 0) - (b.position || 0));
          const selectedIds = new Set(selectedTags.map(t => t.id));
          
          // �ҵ�ѡ�б�ǩ������
          const selectedIndices = newTags
            .map((tag, index) => selectedIds.has(tag.id) ? index : -1)
            .filter(index => index !== -1);
          
          if (selectedIndices.length === 0) return prevTags;
          
          // ����Ƿ�����ƶ�
          const minIndex = Math.min(...selectedIndices);
          const maxIndex = Math.max(...selectedIndices);
          
          if (direction === -1 && minIndex === 0) {
            TagManagerLogger.log('?? Already at top');
            return prevTags;
          }
          if (direction === 1 && maxIndex === newTags.length - 1) {
            TagManagerLogger.log('?? Already at bottom');
            return prevTags;
          }
          
          // �ƶ���ǩ
          if (direction === -1) {
            // �����ƶ�������һ����ǩ����
            const temp = newTags[minIndex - 1];
            newTags.splice(minIndex - 1, 1);
            newTags.splice(maxIndex, 0, temp);
          } else {
            // �����ƶ�������һ����ǩ����
            const temp = newTags[maxIndex + 1];
            newTags.splice(maxIndex + 1, 1);
            newTags.splice(minIndex, 0, temp);
          }
          
          // ���·��� position
          return newTags.map((tag, index) => ({
            ...tag,
            position: index
          }));
        });
      }

      // ?? Shift+Alt+M - �����༭����ӳ��
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        
        TagManagerLogger.log(`?? [Batch Calendar] Editing calendar mapping for ${selectedTags.length} tags`);
        
        // ������ѡ������ʹ�õ�һ��ѡ�б�ǩ��λ�ã�
        if (selectedTags.length > 0) {
          const firstTagElement = document.querySelector(`[data-tag-id="${selectedTags[0].id}"]`);
          if (firstTagElement) {
            const rect = firstTagElement.getBoundingClientRect();
            setShowCalendarPicker({
              show: true,
              tagId: `batch:${selectedTags.map(t => t.id).join(',')}`, // �����Ǳ�ʾ��������
              position: { x: rect.left, y: rect.bottom + 5 }
            });
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tags]);

  // ?? ��ȡ��ǰѡ�еı�ǩID�б�����UI��Ⱦ��
  const getSelectedTagIds = (): string[] => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];
    
    const selectedIds: string[] = [];
    tags.forEach(tag => {
      const tagElement = document.querySelector(`[data-tag-id="${tag.id}"]`);
      if (tagElement && selection.containsNode(tagElement, true)) {
        selectedIds.push(tag.id);
      }
    });
    return selectedIds;
  };
  
  // ?? ����ѡ���仯������selectedTagIds
  useEffect(() => {
    const updateSelection = () => {
      const ids = getSelectedTagIds();
      setSelectedTagIds(ids);
    };
    
    // ����selectionchange�¼�
    document.addEventListener('selectionchange', updateSelection);
    
    // ��ʼ��
    updateSelection();
    
    return () => {
      document.removeEventListener('selectionchange', updateSelection);
    };
  }, [tags]);

  // ��������ӳ��
  const handleCalendarMappingClick = (tagId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    
    // ?? ������������������Ƿ��ж����ǩ��ѡ��
    const selection = window.getSelection();
    const selectedTagIds: string[] = [];
    
    if (selection && selection.rangeCount > 0) {
      tags.forEach(tag => {
        const tagElement = document.querySelector(`[data-tag-id="${tag.id}"]`);
        if (tagElement && selection.containsNode(tagElement, true)) {
          selectedTagIds.push(tag.id);
        }
      });
    }
    
    const isTagSelected = selectedTagIds.includes(tagId);
    const shouldBatchUpdate = isTagSelected && selectedTagIds.length > 1;
    
    if (shouldBatchUpdate) {
      TagManagerLogger.log(`?? [Smart Batch] Tag ${tagId} is selected with ${selectedTagIds.length - 1} other tags, enabling batch mode`);
      setShowCalendarPicker({
        show: true,
        tagId: `batch:${selectedTagIds.join(',')}`,
        position: { x: rect.left, y: rect.bottom + 5 }
      });
    } else {
      setShowCalendarPicker({
        show: true,
        tagId,
        position: { x: rect.left, y: rect.bottom + 5 }
      });
    }
  };

  const handleCalendarSelect = (calendar: { calendarId: string; calendarName: string; color?: string }) => {
    // ?? ����Ƿ�����������
    if (showCalendarPicker.tagId.startsWith('batch:')) {
      const tagIds = showCalendarPicker.tagId.replace('batch:', '').split(',');
      TagManagerLogger.log(`?? [Batch Calendar] Setting calendar for ${tagIds.length} tags:`, calendar.calendarName);
      
      setTags(prevTags =>
        prevTags.map(tag =>
          tagIds.includes(tag.id)
            ? { ...tag, calendarMapping: calendar }
            : tag
        )
      );
      
      // ?? ��ʾ���������ɹ���ʾ
      const tagNames = tags.filter(t => tagIds.includes(t.id)).map(t => t.name).join('��');
      TagManagerLogger.log(`? [Batch Calendar] Updated ${tagIds.length} tags: ${tagNames}`);
      
    } else {
      // ������ǩ����
      setTags(prevTags =>
        prevTags.map(tag =>
          tag.id === showCalendarPicker.tagId
            ? { ...tag, calendarMapping: calendar }
            : tag
        )
      );
    }
    
    setShowCalendarPicker({ show: false, tagId: '', position: { x: 0, y: 0 } });
  };

  // �����
  const handleCheckin = (tagId: string) => {
    setCheckinCounts(prev => ({
      ...prev,
      [tagId]: (prev[tagId] || 0) + 1
    }));
  };

  // ��ʽ��ʱ����??
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `�վ�${hours}h${mins.toString().padStart(2, '0')}min`;
  };

  // �����±�??
  // ��ȡĬ������ӳ��
  const getDefaultCalendarMapping = async () => {
    if (!microsoftService) return undefined;
    
    try {
      const calendars = await microsoftService.getAllCalendars();
      if (calendars && calendars.length > 0) {
        // ʹ�õ�һ��������ΪĬ��������ͨ�������û���������
        const defaultCalendar = calendars[0];
        return {
          calendarId: defaultCalendar.id || '',
          calendarName: `Outlook: ${defaultCalendar.name || '����'}`,
          color: convertMicrosoftColorToHex(defaultCalendar.color) || '#3b82f6'
        };
      }
    } catch (error) {
      TagManagerLogger.warn('��ȡĬ������ʧ��:', error);
    }
    return undefined;
  };

  // ��Microsoft��ɫ����ת��Ϊʮ��������ɫ
  const convertMicrosoftColorToHex = (colorName?: string): string => {
    const colorMap: { [key: string]: string } = {
      'lightBlue': '#5194f0',
      'lightGreen': '#42b883', 
      'lightOrange': '#ff8c42',
      'lightGray': '#9ca3af',
      'lightYellow': '#f1c40f',
      'lightTeal': '#48c9b0',
      'lightPink': '#f48fb1',
      'lightBrown': '#a0826d',
      'lightRed': '#e74c3c',
      'maxColor': '#6366f1'
    };
    
    if (!colorName) return '#3b82f6';
    return colorMap[colorName] || '#3b82f6';
  };

  const createNewTag = (level: number = 0, afterTagId?: string) => {
    const newId = `new-${Date.now()}`;
    
    setTags(prevTags => {
      let newPosition: number;
      let newParentId: string | undefined = undefined;
      let updatedTags: ExtendedHierarchicalTag[];
      
      // ������ӱ�ǩ(level > 0)����Ҫ�ҵ�����ǩ
      if (level > 0) {
        const sortedTags = [...prevTags].sort((a, b) => (a.position || 0) - (b.position || 0));
        const insertIndex = afterTagId ? 
          sortedTags.findIndex(tag => tag.id === afterTagId) + 1 : 
          sortedTags.length;
        
        // ��ǰ���ҵ�һ���㼶�ȵ�ǰlevelС�ı�ǩ��Ϊ����ǩ
        for (let i = insertIndex - 1; i >= 0; i--) {
          if ((sortedTags[i].level || 0) < level) {
            newParentId = sortedTags[i].id;
            TagManagerLogger.log('?? [createNewTag] Found parent for new tag:', {
              newTagId: newId,
              newTagLevel: level,
              parentId: newParentId,
              parentName: sortedTags[i].name,
              parentLevel: sortedTags[i].level
            });
            break;
          }
        }
      }
      
      if (afterTagId) {
        // �ҵ�Ҫ����λ�õı�ǩ������positionֵ��������������
        const afterTag = prevTags.find(tag => tag.id === afterTagId);
        if (!afterTag) {
          TagManagerLogger.error('? After tag not found:', afterTagId);
          return prevTags;
        }
        
        TagManagerLogger.log('?? Found afterTag:', {
          id: afterTag.id.substring(0, 8),
          name: afterTag.name,
          position: afterTag.position,
          level: afterTag.level
        });
        
        const afterPosition = afterTag.position || 0;
        
        // �±�ǩ��λ�þ��� afterPosition + 1
        newPosition = afterPosition + 1;
        
        TagManagerLogger.log('?? Creating new tag after tagId:', afterTagId, 'afterPosition:', afterPosition, 'newPosition:', newPosition);
        TagManagerLogger.log('?? Current tags positions before shift:', 
          prevTags
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map(t => ({ id: t.id.substring(0, 8), name: t.name || '(unnamed)', position: t.position }))
        );
        
        // ������ position > afterPosition �ı�ǩ +1��Ϊ�±�ǩ�ڳ��ռ䣩
        const shiftedTags = prevTags.map(tag => {
          if ((tag.position || 0) > afterPosition) {
            TagManagerLogger.log(`  ?? Shifting tag "${tag.name}" from position ${tag.position} to ${(tag.position || 0) + 1}`);
            return { ...tag, position: (tag.position || 0) + 1 };
          }
          return tag;
        });
        
        const newTag: ExtendedHierarchicalTag = {
          id: newId,
          name: '',
          color: '#3b82f6',
          emoji: '??',
          level,
          parentId: newParentId, // ���ø���ǩID
          position: newPosition,
          dailyAvgCheckins: 0,
          dailyAvgDuration: 150,
          isRecurring: false
        };
        
        updatedTags = [...shiftedTags, newTag];
        TagManagerLogger.log('? Created tag at position', newPosition, 'and shifted', shiftedTags.filter(t => t.position !== prevTags.find(pt => pt.id === t.id)?.position).length, 'tags forward');
        TagManagerLogger.log('?? All tags after creation (sorted by position):', 
          updatedTags
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map(t => ({ id: t.id.substring(0, 8), name: t.name || '(unnamed)', position: t.position, level: t.level }))
        );
      } else {
        newPosition = prevTags.length;
        
        const newTag: ExtendedHierarchicalTag = {
          id: newId,
          name: '',
          color: '#3b82f6',
          emoji: '??',
          level,
          parentId: newParentId, // ���ø���ǩID
          position: newPosition,
          dailyAvgCheckins: 0,
          dailyAvgDuration: 150,
          isRecurring: false
        };
        
        updatedTags = [...prevTags, newTag];
      }
      
      return updatedTags;
    });

    // �첽��������ӳ�� - �ӱ�ǩ�̳и���ǩ������ʹ��Ĭ��ӳ��
    (async () => {
      let calendarMapping: { calendarId: string; calendarName: string; color?: string } | undefined = undefined;
      
      // ������ӱ�ǩ(level > 0)�������ҵ�����ǩ���̳�������ӳ��
      if (level > 0) {
        // �ҵ�����λ���ڵ�ǰ��ǩ֮ǰ�Ҳ㼶��С�ı�ǩ
        const sortedTags = [...tags].sort((a, b) => (a.position || 0) - (b.position || 0));
        const currentIndex = afterTagId ? 
          sortedTags.findIndex(tag => tag.id === afterTagId) + 1 : // ���ָ����afterTagId���±�ǩ�����
          sortedTags.length; // ���������
        
        // �ӵ�ǰλ����ǰ��������ĸ���ǩ
        for (let i = currentIndex - 1; i >= 0; i--) {
          const potentialParent = sortedTags[i];
          if ((potentialParent.level || 0) < level && potentialParent.calendarMapping) {
            calendarMapping = potentialParent.calendarMapping;
            TagManagerLogger.log('?? �ӱ�ǩ�̳и���ǩ����ӳ��:', {
              childLevel: level,
              parentTag: potentialParent.name,
              parentLevel: potentialParent.level || 0,
              inheritedMapping: calendarMapping
            });
            break;
          }
        }
      }
      
      // ���û���ҵ�����ǩӳ�䣬ʹ��Ĭ��ӳ��
      if (!calendarMapping) {
        calendarMapping = await getDefaultCalendarMapping();
        TagManagerLogger.log('?? ʹ��Ĭ������ӳ��:', calendarMapping);
      }
      
      if (calendarMapping) {
        setTags(prevTags => 
          prevTags.map(tag => 
            tag.id === newId 
              ? { ...tag, calendarMapping: calendarMapping }
              : tag
          )
        );
      }
    })();

    setCheckinCounts(prev => ({ ...prev, [newId]: 0 }));
    setNewTagId(newId);
    
    // �Զ��۽����±�ǩ - ���Ӹ������ӳٺ����Ի���
    const focusNewTag = (retryCount = 0) => {
      const element = document.querySelector(`[data-tag-id="${newId}"]`) as HTMLElement;
      if (element) {
        TagManagerLogger.log('?? Successfully found and focusing new tag:', newId);
        element.focus();
        return;
      }
      
      // ���û�ҵ�Ԫ�������Դ�������5�Σ���������
      if (retryCount < 5) {
        TagManagerLogger.log(`?? Retrying focus for tag ${newId}, attempt ${retryCount + 1}`);
        setTimeout(() => focusNewTag(retryCount + 1), 50);
      } else {
        TagManagerLogger.error('? Failed to focus new tag after 5 attempts:', newId);
      }
    };
    
    setTimeout(() => focusNewTag(), 100);

    return newId;
  };

  // �����±�ǩ��������
  const handleNewTagActivation = () => {
    TagManagerLogger.log('?? handleNewTagActivation called!');
    TagManagerLogger.log('?? �û�����˻�ɫ�ı�:', userClickedGrayText);
    TagManagerLogger.log('?? Call stack:', new Error().stack);
    
    // ֻ�е��û���ȷ����˻�ɫ�ı�ʱ�ż���
    if (!userClickedGrayText) {
      TagManagerLogger.log('?? ��ֹ����û�û����ȷ�����ɫ�ı�');
      return;
    }
    
    setIsCreatingNewTag(true); // ���봴��ģʽ
    
    // �ҵ����б�ǩ��position���ı�ǩ��������洴���µ�һ����ǩ
    const sortedTags = [...tags].sort((a, b) => (a.position || 0) - (b.position || 0));
    const lastTag = sortedTags[sortedTags.length - 1];
    const lastTagId = lastTag?.id;
    
    TagManagerLogger.log('?? [NewTagActivation] Creating new tag after last tag:', {
      lastTagId,
      lastTagName: lastTag?.name,
      lastTagPosition: lastTag?.position,
      newTagLevel: 0
    });
    
    // ����б�ǩ�������һ����ǩ���洴��������ֱ�Ӵ���
    if (lastTagId) {
      createNewTag(0, lastTagId);
    } else {
      createNewTag(0);
    }
  };

  // ȡ���±�ǩ����
  const handleCancelNewTag = () => {
    TagManagerLogger.log('? Cancelling new tag creation');
    setIsCreatingNewTag(false);
    setNewTagId(null);
    setUserClickedGrayText(false); // ���õ�����
  };

  // �ƶ���굽��һ����ǩ
  const focusPreviousTag = (currentTagId: string) => {
    const sortedTags = tags.sort((a, b) => (a.position || 0) - (b.position || 0));
    const currentIndex = sortedTags.findIndex(tag => tag.id === currentTagId);
    
    if (currentIndex > 0) {
      const previousTag = sortedTags[currentIndex - 1];
      // �Զ����浱ǰ��ǩ
      saveTagsToStorage(tags);
      // �۽�����һ����ǩ
      setTimeout(() => {
        const element = document.querySelector(`[data-tag-id="${previousTag.id}"]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      }, 10);
    }
  };

  // �ƶ���굽��һ����ǩ
  const focusNextTag = (currentTagId: string) => {
    const sortedTags = tags.sort((a, b) => (a.position || 0) - (b.position || 0));
    const currentIndex = sortedTags.findIndex(tag => tag.id === currentTagId);
    
    if (currentIndex < sortedTags.length - 1) {
      const nextTag = sortedTags[currentIndex + 1];
      // �Զ����浱ǰ��ǩ
      saveTagsToStorage(tags);
      // �۽�����һ����ǩ
      setTimeout(() => {
        const element = document.querySelector(`[data-tag-id="${nextTag.id}"]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      }, 10);
    }
  };

  // �����ǩ�����¼�
  const handleTagKeyDown = (e: React.KeyboardEvent, tagId: string, currentLevel: number) => {
    // ���������ȷ������������
    TagManagerLogger.log('?? FUNCTION CALLED - handleTagKeyDown');
    TagManagerLogger.log('?? Key event:', {
      key: e.key,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      tagId: tagId,
      currentLevel: currentLevel
    });
    
    if (e.key === 'Enter') {
      e.preventDefault();
      // ���浱ǰ��ǩ�������µ�ͬ����ǩ
      createNewTag(currentLevel, tagId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // ESC ȡ��������ɾ�������ǩ��������û�����ݣ�
      TagManagerLogger.log('?? ESC pressed - Canceling tag creation:', tagId);
      setTags(prev => prev.filter(tag => tag.id !== tagId));
      // ʧ����ǰ�����
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: ��������
        if (currentLevel > 0) {
          setTags(prevTags => {
            const sortedTags = [...prevTags].sort((a, b) => (a.position || 0) - (b.position || 0));
            const currentIndex = sortedTags.findIndex(tag => tag.id === tagId);
            const newLevel = Math.max(0, currentLevel - 1);
            
            // �ҵ��µĸ���ǩ����ǰ���ҵ�һ���㼶���²㼶С�ı�ǩ
            let newParentId: string | undefined = undefined;
            
            if (newLevel > 0) {
              for (let i = currentIndex - 1; i >= 0; i--) {
                if ((sortedTags[i].level || 0) < newLevel) {
                  newParentId = sortedTags[i].id;
                  TagManagerLogger.log('?? Found parent for decreased indent:', {
                    childId: tagId,
                    parentId: newParentId,
                    parentName: sortedTags[i].name,
                    newLevel: newLevel
                  });
                  break;
                }
              }
            }
            
            return prevTags.map(tag =>
              tag.id === tagId ? { ...tag, level: newLevel, parentId: newParentId } : tag
            );
          });
        }
      } else {
        // Tab: �������������ܲ㼶���ƣ�
        // �ҵ���һ����ǩ��ȷ����ǰ��ǩ�㼶��������һ����ǩ�㼶+1
        const sortedTags = tags.sort((a, b) => (a.position || 0) - (b.position || 0));
        const currentIndex = sortedTags.findIndex(tag => tag.id === tagId);
        
        let maxAllowedLevel = currentLevel + 1; // Ĭ����������1��
        
        if (currentIndex > 0) {
          // ������һ����ǩ�Ĳ㼶
          const previousTag = sortedTags[currentIndex - 1];
          const previousLevel = previousTag.level || 0;
          maxAllowedLevel = Math.min(currentLevel + 1, previousLevel + 1);
          
          TagManagerLogger.log('?? Tab�����������:', {
            currentTagId: tagId,
            currentLevel: currentLevel,
            previousTagLevel: previousLevel,
            maxAllowedLevel: maxAllowedLevel,
            canIncrease: currentLevel < maxAllowedLevel
          });
        }
        
        if (currentLevel < maxAllowedLevel) {
          setTags(prevTags => {
            const sortedTags = [...prevTags].sort((a, b) => (a.position || 0) - (b.position || 0));
            const currentIndex = sortedTags.findIndex(tag => tag.id === tagId);
            
            // �ҵ��µĸ���ǩ����ǰ���ҵ�һ���㼶�ȵ�ǰ�²㼶С�ı�ǩ
            let newParentId: string | undefined = undefined;
            const newLevel = currentLevel + 1;
            
            for (let i = currentIndex - 1; i >= 0; i--) {
              if ((sortedTags[i].level || 0) < newLevel) {
                newParentId = sortedTags[i].id;
                TagManagerLogger.log('?? Found parent for increased indent:', {
                  childId: tagId,
                  parentId: newParentId,
                  parentName: sortedTags[i].name,
                  newLevel: newLevel
                });
                break;
              }
            }
            
            return prevTags.map(tag =>
              tag.id === tagId ? { ...tag, level: newLevel, parentId: newParentId } : tag
            );
          });
        } else {
          TagManagerLogger.log('?? �ﵽ���㼶���ƣ��޷���������');
        }
      }
    } else if (e.key === 'ArrowUp' && e.shiftKey && e.altKey) {
      e.preventDefault();
      TagManagerLogger.log('?? Shift+Alt+�� detected for tagId:', tagId);
      TagManagerLogger.log('?? Current tags state:', tags.map(t => ({id: t.id, position: t.position, name: t.name})));
      // Shift+Alt+��: �����ƶ���ǩ
      moveTagUp(tagId);
    } else if (e.key === 'ArrowDown' && e.shiftKey && e.altKey) {
      e.preventDefault();
      TagManagerLogger.log('?? Shift+Alt+�� detected for tagId:', tagId);
      TagManagerLogger.log('?? Current tags state:', tags.map(t => ({id: t.id, position: t.position, name: t.name})));
      // Shift+Alt+��: �����ƶ���ǩ
      moveTagDown(tagId);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // ��: �ƶ���굽��һ����ǩ
      focusPreviousTag(tagId);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // ��: �ƶ���굽��һ����ǩ
      focusNextTag(tagId);
    } else if (e.key === 'F9' && e.ctrlKey) {
      e.preventDefault();
      TagManagerLogger.log('?? Manual position fix triggered');
      fixTagPositions();
    }
  };



  // ��֤���޸�positionֵ��ͬ���汾��
  const validateAndFixPositions = (tagsToCheck: ExtendedHierarchicalTag[]): ExtendedHierarchicalTag[] => {
    const sortedTags = [...tagsToCheck].sort((a, b) => (a.position || 0) - (b.position || 0));
    
    // ����Ƿ����ظ���position
    const positions = sortedTags.map(tag => tag.position || 0);
    const uniquePositions = Array.from(new Set(positions));
    
    if (positions.length !== uniquePositions.length) {
      TagManagerLogger.warn('?? Found duplicate positions:', positions);
      TagManagerLogger.warn('?? Synchronously fixing positions...');
      // �����޸��ظ���position
      return sortedTags.map((tag, index) => ({
        ...tag,
        position: index
      }));
    }
    
    return tagsToCheck;
  };

  // �޸���ǩpositionֵ
  const fixTagPositions = () => {
    setTags(prevTags => {
      const sortedTags = [...prevTags].sort((a, b) => (a.position || 0) - (b.position || 0));
      const fixedTags = sortedTags.map((tag, index) => ({
        ...tag,
        position: index
      }));
      TagManagerLogger.log('?? Fixed tag positions:', fixedTags.map(t => ({id: t.id, position: t.position, name: t.name})));
      return fixedTags;
    });
  };

  // �����ƶ���ǩ
  const moveTagUp = (tagId: string) => {
    TagManagerLogger.log('?? moveTagUp called with tagId:', tagId);
    
    setTags(prevTags => {
      TagManagerLogger.log('?? Current prevTags:', prevTags.map(t => ({id: t.id, position: t.position, name: t.name})));
      
      // ����֤���޸�position
      const validatedTags = validateAndFixPositions(prevTags);
      const sortedTags = [...validatedTags].sort((a, b) => (a.position || 0) - (b.position || 0));
      TagManagerLogger.log('?? Sorted tags:', sortedTags.map(t => ({id: t.id, position: t.position, name: t.name})));
      
      const currentIndex = sortedTags.findIndex(tag => tag.id === tagId);
      TagManagerLogger.log('?? Current index:', currentIndex, 'for tagId:', tagId);
      
      if (currentIndex <= 0) {
        TagManagerLogger.log('?? Tag is already at the top, no movement needed');
        return validatedTags; // �����޸��������
      }
      
      // ����һ����ǩ����λ��
      const currentTag = sortedTags[currentIndex];
      const previousTag = sortedTags[currentIndex - 1];
      
      TagManagerLogger.log('?? Swapping:', {
        current: {id: currentTag.id, position: currentTag.position, name: currentTag.name},
        previous: {id: previousTag.id, position: previousTag.position, name: previousTag.name}
      });
      
      // ����ƶ�����һ�У���������Ϊһ����ǩ
      const newLevel = currentIndex === 1 ? 0 : currentTag.level;
      TagManagerLogger.log('?? New level for moved tag:', newLevel);
      
      const newTags = validatedTags.map(tag => {
        if (tag.id === tagId) {
          // �����ƶ���ĺ���㼶
          let adjustedLevel = newLevel;
          if (currentIndex > 1) {
            // �����ƶ�����������Ҫ�����λ�õ���һ����ǩ
            const newPreviousTag = sortedTags[currentIndex - 2]; // ��λ�õ���һ����ǩ
            const newPreviousLevel = newPreviousTag.level || 0;
            // ȷ���㼶��������λ����һ����ǩ�Ĳ㼶+1
            adjustedLevel = Math.min(currentTag.level || 0, newPreviousLevel + 1);
            
            TagManagerLogger.log('?? �㼶�������:', {
              originalLevel: currentTag.level,
              newPreviousTagLevel: newPreviousLevel,
              adjustedLevel: adjustedLevel
            });
          }
          
          const newTag = { ...tag, position: previousTag.position, level: adjustedLevel };
          TagManagerLogger.log('?? Updated current tag:', newTag);
          return newTag;
        } else if (tag.id === previousTag.id) {
          const newTag = { ...tag, position: currentTag.position };
          TagManagerLogger.log('?? Updated previous tag:', newTag);
          return newTag;
        }
        return tag;
      });
      
      TagManagerLogger.log('?? Final result:', newTags.map(t => ({id: t.id, position: t.position, name: t.name})));
      
      return newTags;
    });
  };

  // �����ƶ���ǩ
  const moveTagDown = (tagId: string) => {
    TagManagerLogger.log('?? moveTagDown called with tagId:', tagId);
    
    setTags(prevTags => {
      TagManagerLogger.log('?? Current prevTags:', prevTags.map(t => ({id: t.id, position: t.position, name: t.name})));
      
      // ����֤���޸�position
      const validatedTags = validateAndFixPositions(prevTags);
      const sortedTags = [...validatedTags].sort((a, b) => (a.position || 0) - (b.position || 0));
      TagManagerLogger.log('?? Sorted tags:', sortedTags.map(t => ({id: t.id, position: t.position, name: t.name})));
      
      const currentIndex = sortedTags.findIndex(tag => tag.id === tagId);
      TagManagerLogger.log('?? Current index:', currentIndex, 'for tagId:', tagId);
      
      if (currentIndex < 0 || currentIndex >= sortedTags.length - 1) {
        TagManagerLogger.log('?? Tag is already at the bottom or not found, no movement needed');
        return validatedTags; // �����޸��������
      }
      
      // ����һ����ǩ����λ��
      const currentTag = sortedTags[currentIndex];
      const nextTag = sortedTags[currentIndex + 1];
      
      TagManagerLogger.log('?? Swapping:', {
        current: {id: currentTag.id, position: currentTag.position, name: currentTag.name},
        next: {id: nextTag.id, position: nextTag.position, name: nextTag.name}
      });
      
      const newTags = validatedTags.map(tag => {
        if (tag.id === tagId) {
          // �����ƶ���ĺ���㼶
          let adjustedLevel = currentTag.level || 0;
          
          // �������ƶ�ʱ������ƶ������һ����ǩ����ԭ����nextTag���ͺ�һ����ǩ
          const newPreviousLevel = nextTag.level || 0;
          
          // �ҵ��ƶ������һ����ǩ��ԭ��λ��currentIndex+2�ı�ǩ��
          const newNextTag = currentIndex + 2 < sortedTags.length ? sortedTags[currentIndex + 2] : null;
          
          // ����Լ����飺
          // 1. ���ܳ�����λ����һ����ǩ�Ĳ㼶+1
          // 2. �������һ����ǩ����ǰ�㼶���ܱ���һ����ǩС̫�ࣨ��ֹ�㼶��Ծ����
          let maxAllowedLevel = newPreviousLevel + 1;
          
          if (newNextTag) {
            const nextTagLevel = newNextTag.level || 0;
            // �����һ����ǩ�㼶�������ǰ��ǩҲ��һ�����
            maxAllowedLevel = Math.max(maxAllowedLevel, nextTagLevel);
          }
          
          adjustedLevel = Math.min(currentTag.level || 0, maxAllowedLevel);
          
          TagManagerLogger.log('?? �㼶�������:', {
            originalLevel: currentTag.level,
            newPreviousTagLevel: newPreviousLevel,
            newNextTagLevel: newNextTag?.level || 'none',
            maxAllowedLevel: maxAllowedLevel,
            adjustedLevel: adjustedLevel
          });
          
          const newTag = { ...tag, position: nextTag.position, level: adjustedLevel };
          TagManagerLogger.log('?? Updated current tag:', newTag);
          return newTag;
        } else if (tag.id === nextTag.id) {
          const newTag = { ...tag, position: currentTag.position };
          TagManagerLogger.log('?? Updated next tag:', newTag);
          return newTag;
        }
        return tag;
      });
      
      TagManagerLogger.log('?? Final result:', newTags.map(t => ({id: t.id, position: t.position, name: t.name})));
      
      return newTags;
    });
  };

  // �����ǩ����
  const handleTagSave = (tagId: string, content: string) => {
    if (content.trim() === '') {
      // ɾ���ձ�??
      setTags(prev => prev.filter(tag => tag.id !== tagId));
      setCheckinCounts(prev => {
        const newCounts = { ...prev };
        delete newCounts[tagId];
        return newCounts;
      });
    } else {
      // �����ǩ����
      setTags(prev => prev.map(tag => 
        tag.id === tagId ? { ...tag, name: content.trim() } : tag
      ));
    }
    
    // �����±�ǩ״̬
    if (tagId === newTagId) {
      setNewTagId(null);
    }
  };

  return (
    <div>
      {/* ��� kbd ��ʽ */}
      <style>{`
        kbd {
          display: inline-block;
          padding: 2px 6px;
          font-family: monospace;
          font-size: 11px;
          line-height: 1;
          color: #374151;
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
        }
      `}</style>
      
      {/* ������� - �ѽ����Լ�����־��� 
      <ClickTracker 
        enabled={true}
        showVisualIndicators={true}
        onClickDetected={(event) => {
          // ������е���¼����ڵ���
          TagManagerLogger.log('??? GLOBAL CLICK DETECTED:', {
            position: `(${event.x}, ${event.y})`,
            target: event.elementInfo?.tagName,
            size: `${event.elementBounds?.width.toFixed(1)}��${event.elementBounds?.height.toFixed(1)}`,
            text: event.elementInfo?.textContent?.substring(0, 50)
          });
          
          // �ر��ע���ܴ�����ɫ�ı�focus��Ԫ��
          if (event.elementInfo?.textContent?.includes('������ǩ')) {
            TagManagerLogger.log('?? CLICKED ELEMENT CONTAINS GRAY TEXT!', event);
          }
        }}
      >
      */}
        <div style={{ padding: '20px', backgroundColor: 'white' }}>
          <div style={{ position: 'relative' }}>
        
        {/* ������ - ��Ӧʽ��λ���Ҷ��� */}
        <div style={{
          position: 'absolute',
          top: '-75px',
          right: '20px', // ʹ��right��λ�������ұ�Ե20px��ʵ������Ӧ
          zIndex: 10
        }}>
          <div style={{
            width: '122px',
            height: '40px',
            borderRadius: '25px',
            border: '2px solid transparent',
            background: 'linear-gradient(white, white), linear-gradient(90deg, #A855F7 0%, #3B82F6 75.48%)',
            backgroundClip: 'padding-box, border-box',
            backgroundOrigin: 'padding-box, border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: '12px',
            cursor: 'pointer',
            flexShrink: 0
          }}>
            <img src={icons.search} alt="����" width="20" height="20" />
          </div>
        </div>

        {/* ��ǩ�б� - ����ϱ߾�Ϊ�����������ռ� */}
        <div style={{ marginTop: '60px' }}>
          {tags
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((tag, index) => {
              // ���ڿ���ģʽ�´�ӡ��һ����ǩ�ĵ�����Ϣ��������־��
              // if (index === 0 && process.env.NODE_ENV === 'development') {
              //   TagManagerLogger.log('?? [Render] Tags being rendered:', tags
              //     .sort((a, b) => (a.position || 0) - (b.position || 0))
              //     .map(t => ({ 
              //       id: t.id.substring(0, 8), 
              //       name: t.name, 
              //       level: t.level,
              //       padding: `${(t.level || 0) * 20}px`
              //     }))
              //   );
              // }
              return (
            <div key={tag.id} 
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '4px',
                height: '24px',
                fontSize: '16px',
                fontFamily: "'Microsoft YaHei', Arial, sans-serif",
                width: '100%',
                position: 'relative',
                borderBottom: hoveredTagId === tag.id ? '1px solid #d1d5db' : '1px solid transparent',
                transition: 'border-bottom-color 0.2s ease'
              }}
              onMouseEnter={() => setHoveredTagId(tag.id)}
              onMouseLeave={() => setHoveredTagId(null)}
            >
              {/* ��ǩ���� - ��ಿ�� */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                paddingLeft: `${(tag.level || 0) * 20}px`,
                flex: 1,
                minWidth: 0
              }}>
                {/* # �� - �̶�24px */}
                <span 
                  onClick={(e) => handleColorClick(tag.id, e)}
                  style={{ 
                    color: tag.color,
                    fontSize: '16px',
                    fontWeight: (tag.level || 0) === 0 ? 'bold' : 'normal',
                    width: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="����޸���ɫ"
                >#</span>
                
                {/* Emoji - �̶�24px */}
                <span 
                  onClick={(e) => handleEmojiClick(tag.id, e)}
                  style={{
                    fontSize: '16px',
                    width: '24px',
                    height: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    marginLeft: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="����޸ı���"
                >
                  {tag.emoji}
                </span>
                
                {/* ��ǩ���� - �ɱ༭ */}
                <span 
                  data-tag-id={tag.id}
                  style={{ 
                    color: tag.color,
                    fontSize: '16px',
                    fontWeight: (tag.level || 0) === 0 ? 'bold' : 'normal',
                    marginLeft: '8px',
                    outline: 'none',
                    border: 'none',
                    background: 'transparent',
                    display: 'inline-block',
                    minWidth: 'fit-content',
                    cursor: 'text',
                    userSelect: 'text', // ?? ��ȷ����ѡ��
                    WebkitUserSelect: 'text', // ?? ����webkit
                    MozUserSelect: 'text' // ?? ����Firefox
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newName = e.currentTarget.textContent || '';
                    handleTagSave(tag.id, newName);
                  }}
                  onKeyDown={(e) => handleTagKeyDown(e, tag.id, tag.level || 0)}
                  onMouseDown={(e) => {
                    // ?? ��ֹ�¼�ð�ݣ�ȷ������ѡ������
                    e.stopPropagation();
                  }}
                >
                  {tag.name}
                </span>
              </div>

              {/* �Ҳ����� - ��Ӧʽ���� */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                flex: '1',
                minWidth: '400px',
                justifyContent: 'flex-end',
                userSelect: 'none', // ?? ��ֹ�Ҳ�����ѡ��
                WebkitUserSelect: 'none',
                MozUserSelect: 'none'
              }}>
                {/* ����ӳ�� */}
                <div 
                  onClick={(e) => handleCalendarMappingClick(tag.id, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '16px',
                    color: '#000000',
                    cursor: 'pointer',
                    padding: '0px 8px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    width: '180px',
                    flexShrink: 0,
                    position: 'relative', // ?? ��������ָʾ����λ
                    border: selectedTagIds.includes(tag.id) && selectedTagIds.length > 1 ? '2px solid #3b82f6' : 'none' // ?? ����ģʽ�߿�
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title={
                    selectedTagIds.includes(tag.id) && selectedTagIds.length > 1 
                      ? `�������� (${selectedTagIds.length}����ǩ)` 
                      : "�����������ӳ��"
                  }
                >
                  {/* ?? ��������ָʾ�� */}
                  {selectedTagIds.includes(tag.id) && selectedTagIds.length > 1 && (
                    <div style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      border: '2px solid white',
                      zIndex: 1
                    }}>
                      {selectedTagIds.length}
                    </div>
                  )}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: tag.calendarMapping?.color || '#9ca3af',
                    flexShrink: 0
                  }} />
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {tag.calendarMapping?.calendarName || 'δӳ��'}
                  </span>
                </div>

              {/* �Ҳఴť���� */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px'
              }}>
                {/* �򿨰�ť */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '16px',
                  color: '#000000',
                  width: '95px', // �̶���ȣ���ֹƯ��
                  justifyContent: 'center',
                  flexShrink: 0 // ��ֹ��ѹ��
                }}>
                  <div
                    onClick={() => handleCheckin(tag.id)}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '25px',
                      height: '25px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title={`�� (�Ѵ�${checkinCounts[tag.id] || 0}��)`}
                  >
                    <img src={icons.multiCheckinColor} alt="��" width="25" height="25" />
                    {checkinCounts[tag.id] > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {checkinCounts[tag.id]}
                      </span>
                    )}
                  </div>
                  <span>
                    {(tag.dailyAvgCheckins || 0).toFixed(1)}��/��
                  </span>
                </div>

                {/* ��ʱ����ť */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '16px',
                  color: '#000000',
                  width: '110px', // �̶���ȣ���ֹƯ��
                  justifyContent: 'flex-start', // �����
                  flexShrink: 0 // ��ֹ��ѹ��
                }}>
                  {/* ��ʱ��ť - �̶������ */}
                  <div
                    style={{
                      width: '25px',
                      height: '25px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0 // �̶���С����������
                    }}
                    onClick={() => {
                      // �����ǰ��ǩ���ڼ�ʱ������ͣ/����
                      if (globalTimer?.tagId === tag.id) {
                        if (globalTimer.isRunning) {
                          onTimerPause?.();
                        } else {
                          onTimerResume?.();
                        }
                      } else {
                        // ��ʼ�µļ�ʱ
                        onTimerStart?.(tag.id);
                      }
                    }}
                    title={globalTimer?.tagId === tag.id ? (globalTimer.isRunning ? "��ͣ��ʱ" : "������ʱ") : "��ʼ��ʱ"}
                  >
                    <img 
                      src={icons.timerColor} 
                      alt="��ʱ" 
                      width="25" 
                      height="25"
                      style={{
                        transition: 'transform 0.2s',
                        display: 'block'
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'}
                    />
                  </div>
                  
                  {/* ��ʱ�ı� - �̶���ȣ���ֹ��ť�ƶ� */}
                  <span style={{ 
                    width: '80px', // �̶���ȣ��ı��仯��Ӱ�찴ťλ��
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {/* �����ǰ��ǩ���ڼ�ʱ����ʾʵʱ��ʱ��������ʾƽ��ʱ�� */}
                    {globalTimer?.tagId === tag.id ? (() => {
                      const elapsed = globalTimer.elapsedTime + 
                        (globalTimer.isRunning ? (Date.now() - globalTimer.startTime) : 0);
                      const totalSeconds = Math.floor(elapsed / 1000);
                      const hours = Math.floor(totalSeconds / 3600);
                      const minutes = Math.floor((totalSeconds % 3600) / 60);
                      const seconds = totalSeconds % 60;
                      
                      if (hours > 0) {
                        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                      }
                      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    })() : `${((tag.dailyAvgDuration || 150) / 60).toFixed(1)}h/��`}
                  </span>
                </div>
              </div>
              </div>
            </div>
          );
          })}

          {/* �±�ǩ�������� */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px',
              height: '24px',
              fontSize: '16px',
              fontFamily: "'Microsoft YaHei', Arial, sans-serif",
              position: 'relative'
            }}
          >
            {/* ��ǩ���� - ��� */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center',
                flex: 'none',
                width: 'auto',
                height: '24px',
                overflow: 'hidden'
              }}
            >
              {/* # ��- �̶�24px */}
              <span 
                style={{ 
                  color: '#9ca3af',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  width: '24px',
                  textAlign: 'center',
                  padding: '2px',
                  borderRadius: '4px'
                }}
              >#</span>
              
              {/* Emoji - �̶�24px */}
              <span 
                style={{
                  fontSize: '16px',
                  width: '24px',
                  textAlign: 'center',
                  padding: '2px',
                  borderRadius: '4px',
                  marginLeft: '4px'
                }}
              >
                ??
              </span>
              
              {/* �±�ǩ������������ - ������������ */}
              <span 
                style={{ 
                  color: isCreatingNewTag ? '#3b82f6' : '#9ca3af',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginLeft: '8px',
                  outline: 'none',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'text',
                  fontStyle: isCreatingNewTag ? 'normal' : 'italic',
                  display: 'inline-block',
                  width: 'auto',
                  height: 'auto',
                  lineHeight: '20px',
                  verticalAlign: 'top',
                  whiteSpace: 'nowrap',
                  padding: '2px 4px',
                  margin: '0 0 0 8px',
                  minWidth: '120px', // ȷ�����㹻�ĵ������
                  borderRadius: '3px',
                  transition: 'background-color 0.2s'
                }}
                contentEditable
                suppressContentEditableWarning
                onClick={(e) => {
                  e.stopPropagation();
                  
                  // �û���ȷ����˻�ɫ�ı�
                  TagManagerLogger.log('? �û���ȷ����˻�ɫ�ı�����');
                  
                  // �����λ���Ƿ������ָ���
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const clickY = e.clientY - rect.top;
                  
                  TagManagerLogger.log('?? Gray text area clicked at:', {
                    clickX: clickX.toFixed(1),
                    clickY: clickY.toFixed(1),
                    rectWidth: rect.width.toFixed(1),
                    rectHeight: rect.height.toFixed(1),
                    isCreating: isCreatingNewTag
                  });
                  
                  // ������ڴ���ģʽ��ֱ�Ӽ�����������û���ͼ��⣩
                  if (!isCreatingNewTag) {
                    TagManagerLogger.log('?? Direct activation from click');
                    setIsCreatingNewTag(true); // ֱ�ӽ��봴��ģʽ
                    
                    // �ҵ����б�ǩ��position���ı�ǩ��������洴���µ�һ����ǩ
                    const sortedTags = [...tags].sort((a, b) => (a.position || 0) - (b.position || 0));
                    const lastTag = sortedTags[sortedTags.length - 1];
                    const lastTagId = lastTag?.id;
                    
                    TagManagerLogger.log('?? [GrayText] Creating new tag after last tag:', {
                      lastTagId,
                      lastTagName: lastTag?.name,
                      lastTagPosition: lastTag?.position,
                      newTagLevel: 0
                    });
                    
                    // ����б�ǩ�������һ����ǩ���洴��������ֱ�Ӵ���
                    if (lastTagId) {
                      createNewTag(0, lastTagId);
                    } else {
                      createNewTag(0);
                    }
                    
                    // ���浱ǰԪ�ص����ã�������setTimeout�з���null
                    const currentElement = e.currentTarget;
                    setTimeout(() => {
                      if (currentElement && currentElement.textContent === '���������ǩ��Tab/Shift+Tab�л��㼶��Shift+Alt+��/�������ƶ���ǩ') {
                        currentElement.textContent = '';
                      }
                      if (currentElement) {
                        currentElement.focus();
                      }
                    }, 0);
                  }
                }}
                onFocus={(e) => {
                  TagManagerLogger.log('?? Gray text focused, isCreating:', isCreatingNewTag);
                  TagManagerLogger.log('?? �û��Ƿ���ȷ����˻�ɫ�ı�:', userClickedGrayText);
                  
                  // ����Ѿ��ڴ���ģʽ��ֱ�ӷ���
                  if (isCreatingNewTag) {
                    TagManagerLogger.log('? Already in creation mode, nothing to do');
                    return;
                  }
                  
                  // ����û�û����ȷ�����ɫ�ı������������focus�¼�������
                  if (!userClickedGrayText) {
                    TagManagerLogger.log('?? Focus�¼��������û�ֱ�ӵ������ģ�����');
                    // �Ƴ������Է�ֹ���⼤��
                    e.currentTarget.blur();
                    return;
                  }
                  
                  // ���õ�����
                  setUserClickedGrayText(false);
                  
                  // �����ģʽ���������Ӧ�ú��ٷ�������ΪonClick�Ѿ������ˣ�
                  TagManagerLogger.log('? Valid focus on placeholder text, activating creation');
                  handleNewTagActivation();
                  e.currentTarget.textContent = '';
                }}
                onBlur={(e) => {
                  TagManagerLogger.log('?? Gray text blurred');
                  const content = e.currentTarget.textContent || '';
                  
                  if (isCreatingNewTag) {
                    if (content.trim() === '') {
                      // ���û���������ݣ�ȡ������
                      TagManagerLogger.log('? Empty content, cancelling creation');
                      handleCancelNewTag();
                      e.currentTarget.textContent = '���������ǩ��Tab/Shift+Tab�л��㼶��Shift+Alt+��/�������ƶ���ǩ';
                    } else {
                      // �����±�ǩ���ݣ��˳�����ģʽ
                      TagManagerLogger.log('?? Saving new tag:', content.trim());
                      setIsCreatingNewTag(false);
                    }
                  } else {
                    // ȷ����ʾռλ���ı�
                    if (content.trim() === '') {
                      e.currentTarget.textContent = '���������ǩ��Tab/Shift+Tab�л��㼶��Shift+Alt+��/�������ƶ���ǩ';
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const content = e.currentTarget.textContent || '';
                    if (content.trim() !== '') {
                      TagManagerLogger.log('? Creating new tag with Enter:', content.trim());
                      setIsCreatingNewTag(false);
                      // ������Լ���������һ����ǩ
                      setTimeout(() => {
                        handleNewTagActivation();
                        e.currentTarget.textContent = '';
                        e.currentTarget.focus();
                      }, 100);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    TagManagerLogger.log('?? Cancelling new tag creation with Escape');
                    handleCancelNewTag();
                    e.currentTarget.textContent = '���������ǩ��Tab/Shift+Tab�л��㼶��Shift+Alt+��/�������ƶ���ǩ';
                    e.currentTarget.blur();
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isCreatingNewTag) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCreatingNewTag) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {!isCreatingNewTag ? '���������ǩ��Tab/Shift+Tab�л��㼶��Shift+Alt+��/�������ƶ���ǩ' : ''}
              </span>
            </div>
          </div>
        </div>

      {/* ѡ������� */}
      <ColorPicker
        onSelect={handleColorSelect}
        onClose={() => setShowColorPicker({ show: false, tagId: '', position: { x: 0, y: 0 } })}
        position={showColorPicker.position}
        currentColor={tags.find(tag => tag.id === showColorPicker.tagId)?.color || '#000000'}
        isVisible={showColorPicker.show}
      />
      
      {/* emoji-mart ����ѡ���� */}
      {showEmojiPicker.show && (
        <div 
          onMouseDown={handleMouseDown}
          style={{
          position: 'fixed', // ��Ϊfixed��λ
          left: showEmojiPicker.position.x,
          top: showEmojiPicker.position.y,
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'white',
          border: '1px solid #e5e7eb',
          userSelect: 'none', // ��ֹ��קʱѡ���ı�
          cursor: isDragging ? 'grabbing' : 'grab'
        }}>
          <Picker
            data={data}
            onEmojiSelect={(emoji: any) => {
              handleEmojiSelect(emoji.native);
              setShowEmojiPicker({ show: false, tagId: '', position: { x: 0, y: 0 } });
            }}
            theme="light"
            set="native"
            locale="zh"
            title=""
            emoji="point_up"
            showPreview={false}
            previewPosition="none"
            showSkinTones={false}
            perLine={9}
            emojiSize={22}
            maxFrequentRows={3}
            skinTonePosition="none"
            searchPosition="top"
            navPosition="bottom"
            noCountryFlags={true}
            categoryIcons={{
              activity: '?',
              custom: '??',
              flags: '??',
              foods: '??',
              frequent: '?',
              nature: '??',
              objects: '??',
              people: '??',
              places: '??',
              symbols: '??'
            }}
          />
        </div>
      )}
      
      <CalendarMappingPicker
        onSelect={handleCalendarSelect}
        onClose={() => setShowCalendarPicker({ show: false, tagId: '', position: { x: 0, y: 0 } })}
        position={showCalendarPicker.position}
        isVisible={showCalendarPicker.show}
        microsoftService={microsoftService}
        googleService={undefined} // δ����Google��������
        icloudService={undefined} // δ����iCloud��������
        availableCalendars={availableCalendars}
      />
      
      {/* ����ⲿ�ر�ѡ��??*/}
      {(showEmojiPicker.show || showColorPicker.show || showCalendarPicker.show) && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => {
            setShowEmojiPicker({ show: false, tagId: '', position: { x: 0, y: 0 } });
            setShowColorPicker({ show: false, tagId: '', position: { x: 0, y: 0 } });
            setShowCalendarPicker({ show: false, tagId: '', position: { x: 0, y: 0 } });
          }}
        />
      )}
      </div>
      </div>
    </div>
  );
};

export default TagManager;

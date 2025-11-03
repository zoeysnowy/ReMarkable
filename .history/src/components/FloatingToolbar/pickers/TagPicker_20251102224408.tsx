/**
 * TagPicker - 标签选择器（FloatingToolbar 专用）
 * 基于通用 HierarchicalTagPicker 组件
 */

import React, { useRef, useCallback } from 'react';
import { HierarchicalTagPicker, HierarchicalTag } from '../../shared';

interface TagPickerProps {
  availableTags: HierarchicalTag[];
  selectedTags: string[];
  onSelect: (tagIds: string[]) => void;
  onClose: () => void;
}

export const TagPicker: React.FC<TagPickerProps> = ({
  availableTags,
  selectedTags,
  onSelect,
  onClose,
}) => {
  // 源头去抖：在极短时间内，若选择结果未变化，则不重复触发
  const lastEmitRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  const handleSelectionChange = useCallback((ids: string[]) => {
    const key = ids.slice().sort().join(',');
    const now = Date.now();
    if (lastEmitRef.current.key === key && now - lastEmitRef.current.time < 300) {
      return;
    }
    lastEmitRef.current = { key, time: now };
    onSelect(ids);
  }, [onSelect]);

  return (
    <div className="floating-toolbar-tag-picker">
      <HierarchicalTagPicker
        availableTags={availableTags}
        selectedTagIds={selectedTags}
        onSelectionChange={handleSelectionChange}
        multiple={true}
        searchable={true}
        showSelectedChips={false}
        showBulkActions={true}
        placeholder="搜索或选择标签..."
        onClose={onClose}
        mode="inline"
      />
    </div>
  );
};

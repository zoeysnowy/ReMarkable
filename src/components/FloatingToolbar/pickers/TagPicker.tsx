/**
 * TagPicker - 标签选择器（FloatingToolbar 专用）
 * 基于通用 HierarchicalTagPicker 组件
 */

import React from 'react';
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
  return (
    <div className="floating-toolbar-tag-picker">
      <HierarchicalTagPicker
        availableTags={availableTags}
        selectedTagIds={selectedTags}
        onSelectionChange={onSelect}
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

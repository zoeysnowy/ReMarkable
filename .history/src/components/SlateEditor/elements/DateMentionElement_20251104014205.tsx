/**
 * Date Mention 元素组件
 * 
 * 渲染日期提及节点
 */

import React from 'react';
import { RenderElementProps, useSelected, useFocused } from 'slate-react';
import { DateMentionElement } from '../types';

export const DateMentionElementComponent: React.FC<RenderElementProps> = ({ attributes, children, element }) => {
  const dateMentionElement = element as DateMentionElement;
  const selected = useSelected();
  const focused = useFocused();

  return (
    <span
      {...attributes}
      contentEditable={false}
      data-type="date-mention"
      data-date={dateMentionElement.date}
      className={`date-mention ${selected && focused ? 'selected' : ''}`}
      style={{
        display: 'inline',
        margin: '0 2px',
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: '#e3f2fd',
        border: '1px solid #90caf9',
        color: '#1976d2',
        fontSize: '0.9em',
        fontWeight: 500,
        userSelect: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      📅 {dateMentionElement.displayText}
      {children}
    </span>
  );
};

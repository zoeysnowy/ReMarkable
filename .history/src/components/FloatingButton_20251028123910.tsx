import React, { useState, Fragment } from 'react';
import Tippy from '@tippyjs/react';
import { Menu, Transition } from '@headlessui/react';
import 'tippy.js/dist/tippy.css';
import './FloatingButton.css';

export interface FloatingButtonAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

export interface FloatingButtonProps {
  /** 主按钮的图标 */
  icon?: React.ReactNode;
  /** 主按钮的文本（如果没有图标） */
  label?: string;
  /** 子操作列表 */
  actions: FloatingButtonAction[];
  /** 主按钮的位置 */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** 主按钮的颜色 */
  color?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 展开方向 */
  expandDirection?: 'up' | 'down' | 'left' | 'right';
  /** 自定义 className */
  className?: string;
  /** Tooltip 提示文本 */
  tooltip?: string;
}

const FloatingButton: React.FC<FloatingButtonProps> = ({
  icon,
  label = '+',
  actions,
  position = 'bottom-right',
  color = '#007AFF',
  disabled = false,
  expandDirection = 'up',
  className = '',
  tooltip,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    'bottom-right': 'floating-button-bottom-right',
    'bottom-left': 'floating-button-bottom-left',
    'top-right': 'floating-button-top-right',
    'top-left': 'floating-button-top-left',
  };

  const expandClasses = {
    up: 'floating-button-expand-up',
    down: 'floating-button-expand-down',
    left: 'floating-button-expand-left',
    right: 'floating-button-expand-right',
  };

  const handleActionClick = (action: FloatingButtonAction) => {
    if (!action.disabled) {
      action.onClick();
      setIsOpen(false);
    }
  };

  const mainButton = (
    <button
      className={`floating-button-main ${className}`}
      style={{ backgroundColor: color }}
      disabled={disabled}
      aria-label={label}
    >
      {icon || <span className="floating-button-label">{label}</span>}
    </button>
  );

  return (
    <div className={`floating-button-container ${positionClasses[position]}`}>
      <Menu as="div" className="floating-button-menu">
        {({ open }) => {
          // 同步状态
          if (open !== isOpen) {
            setIsOpen(open);
          }

          return (
            <>
              <Tippy content={tooltip} disabled={!tooltip || open}>
                <Menu.Button as="div" className="floating-button-trigger">
                  {mainButton}
                </Menu.Button>
              </Tippy>

              <Transition
                as={Fragment}
                show={open}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items
                  className={`floating-button-actions ${expandClasses[expandDirection]}`}
                >
                  {actions.map((action) => (
                    <Menu.Item key={action.id} disabled={action.disabled}>
                      {({ active, disabled: itemDisabled }) => (
                        <Tippy content={action.label} placement="left">
                          <button
                            className={`floating-action-item ${
                              active ? 'floating-action-item-active' : ''
                            } ${itemDisabled ? 'floating-action-item-disabled' : ''}`}
                            style={{
                              backgroundColor: action.color || color,
                            }}
                            onClick={() => handleActionClick(action)}
                            disabled={itemDisabled}
                            aria-label={action.label}
                          >
                            {action.icon || (
                              <span className="floating-action-label">
                                {action.label}
                              </span>
                            )}
                          </button>
                        </Tippy>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </>
          );
        }}
      </Menu>
    </div>
  );
};

export default FloatingButton;

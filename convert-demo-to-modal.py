#!/usr/bin/env python3
"""
将 EventEditModalV2Demo.tsx 转换为 EventEditModalV2.tsx
主要修改：
1. 组件名和Props接口
2. 移除Demo页面外层容器
3. 添加模态框遮罩层
4. 修改CSS导入路径
"""

import re

# 读取源文件
with open('src/components/EventEditModalV2Demo.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 修改文件头部注释
content = content.replace(
    '/**\n * EventEditModal v2 Demo Page\n * \n * 独立的测试页面，用于开发和测试 EventEditModal v2 的交互功能',
    '/**\n * EventEditModal v2 - 双视图事件编辑模态框\n * \n * 完整的事件编辑器，支持详情视图和收缩视图'
)

# 2. 修改CSS导入
content = content.replace(
    "import './EventEditModalV2Demo.css';",
    "import './EventEditModalV2.css';"
)

# 3. 修改服务导入路径
content = content.replace("from '../services/", "from '../../services/")
content = content.replace("from '../types'", "from '../../types'")
content = content.replace("from '../utils/", "from '../../utils/")
content = content.replace("from '../features/", "from '../../features/")
content = content.replace("from '../assets/", "from '../../assets/")

# 4. 修改组件导入路径（保持相对路径）
content = content.replace("from './HierarchicalTagPicker/", "from '../HierarchicalTagPicker/")
content = content.replace("from './FloatingToolbar/", "from '../FloatingToolbar/")
content = content.replace("from './common/", "from '../common/")
content = content.replace("from './EventEditModalV2Demo/", "from '../EventEditModalV2Demo/")
content = content.replace("from './LightSlateEditor'", "from '../LightSlateEditor'")

# 5. 修改接口名称
content = content.replace('interface MockEvent {', 'interface FormData {')
content = content.replace('<MockEvent>', '<FormData>')
content = content.replace('MockEvent>', 'FormData>')

# 6. 修改Props接口
old_props = '''interface EventEditModalV2DemoProps {
  globalTimer?: {
    isRunning: boolean;
    tagId: string;
    tagIds: string[];
    tagName: string;
    tagEmoji?: string;
    tagColor?: string;
    startTime: number;
    originalStartTime: number;
    elapsedTime: number;
    isPaused: boolean;
    eventEmoji?: string;
    eventTitle?: string;
    eventId?: string;
    parentEventId?: string;
  } | null;
  onTimerStart?: (tagIds?: string | string[], parentEventId?: string) => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
  onTimerStop?: () => void;
  onTimerCancel?: () => void;
}'''

new_props = '''interface EventEditModalV2Props {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEvent: Event) => void;
  onDelete?: (eventId: string) => void;
  hierarchicalTags: any[];
  globalTimer?: {
    startTime: number;
    originalStartTime?: number;
    elapsedTime: number;
    isRunning: boolean;
    isPaused?: boolean;
    eventId?: string;
    parentEventId?: string;
  } | null;
  onTimerAction?: (action: 'start' | 'pause' | 'stop' | 'cancel', eventId?: string) => void;
}'''

content = content.replace(old_props, new_props)

# 7. 修改组件定义
content = content.replace(
    'export const EventEditModalV2Demo: React.FC<EventEditModalV2DemoProps> = ({',
    'export const EventEditModalV2: React.FC<EventEditModalV2Props> = ({'
)

# 8. 修改Props解构
old_params = '''  globalTimer,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerStop,
  onTimerCancel
}) => {'''

new_params = '''  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  hierarchicalTags,
  globalTimer,
  onTimerAction,
}) => {'''

content = content.replace(old_params, new_params)

# 9. 在组件开始处添加不显示逻辑
insert_point = '}) => {\n  // 模拟事件数据'
replacement = '''}) => {
  // 如果modal未打开，不渲染
  if (!isOpen) return null;

  // 模拟事件数据'''
content = content.replace(insert_point, replacement)

# 10. 保存新文件
with open('src/components/EventEditModal/EventEditModalV2_converted.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 转换完成！生成文件：src/components/EventEditModal/EventEditModalV2_converted.tsx")
print("请手动完成以下步骤：")
print("1. 检查转换后的文件")
print("2. 添加模态框遮罩层和关闭按钮")
print("3. 移除Demo页面的外层容器和左侧信息面板")
print("4. 将formData初始化改为从props.event读取")
print("5. 实现onSave和onClose回调")

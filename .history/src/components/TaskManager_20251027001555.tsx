import React, { useState, useEffect } from 'react';
import { Task, Event } from '../types';
import { formatTimeForStorage, parseLocalTimeString } from '../utils/timeUtils';
import { STORAGE_KEYS } from '../constants/storage';
import { EventEditModal } from './EventEditModal';

interface TaskManagerProps {
  onStartTimer: (taskTitle: string) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ onStartTimer }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: ''
  });
  const [sortType, setSortType] = useState<'priority' | 'dueDate' | 'created'>('created');
  const [filterCompleted, setFilterCompleted] = useState(false);
  
  // EventEditModal 状态
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [editingTaskAsEvent, setEditingTaskAsEvent] = useState<Event | null>(null);

  // 加载任务
  useEffect(() => {
    const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks);
        setTasks(parsedTasks);
      } catch (error) {
        console.error('Failed to parse tasks:', error);
        setTasks([]);
      }
    }
  }, []);

  // 保存任务到localStorage
  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updatedTasks));
  };

  // 添加任务
  const addTask = () => {
    if (!newTask.title.trim()) {
      alert('请输入任务标题！');
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      completed: false,
      priority: newTask.priority,
      createdAt: formatTimeForStorage(new Date()), // 🔧 转为字符串
      updatedAt: formatTimeForStorage(new Date()), // 🔧 转为字符串
      dueDate: newTask.dueDate || undefined // 🔧 直接使用字符串
    };

    const updatedTasks = [...tasks, task];
    saveTasks(updatedTasks);
    
    // 重置表单
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: ''
    });
    setShowAddForm(false);
  };

  // 🔧 修复：更新任务函数，补充缺失的参数
  const updateTask = (id: string, updates: Partial<Task>) => {
    const updatedTasks = tasks.map(task =>
      task.id === id
        ? { ...task, ...updates, updatedAt: formatTimeForStorage(new Date()) } // 🔧 转为字符串
        : task
    );
    saveTasks(updatedTasks);
  };

  // 🔧 修复：切换任务完成状态
  const toggleTaskComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      updateTask(taskId, { completed: !task.completed }); // 🔧 现在函数存在了
    }
  };

  // 删除任务
  const deleteTask = (id: string) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      const updatedTasks = tasks.filter(task => task.id !== id);
      saveTasks(updatedTasks);
    }
  };

  // 打开事件编辑器 (用于编辑任务)
  const openTaskEditor = (task: Task) => {
    // 将Task转换为Event格式
    const taskAsEvent: Event = {
      id: task.id,
      title: task.title,
      description: task.description || '',
      startTime: task.createdAt,
      endTime: task.dueDate || formatTimeForStorage(new Date(Date.now() + 60 * 60 * 1000)),
      isAllDay: false,
      location: '',
      reminder: 15,
      tags: task.tags || [],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      category: 'planning'
    };
    
    setEditingTaskAsEvent(taskAsEvent);
    setShowEventEditModal(true);
  };

  // 保存任务编辑（从EventEditModal返回）
  const saveTaskFromModal = (updatedEvent: Event) => {
    // 将Event转换回Task格式
    updateTask(updatedEvent.id, {
      title: updatedEvent.title,
      description: updatedEvent.description,
      tags: updatedEvent.tags || [],
      dueDate: updatedEvent.endTime
    });
    
    setShowEventEditModal(false);
    setEditingTaskAsEvent(null);
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  // 获取优先级标签
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '未知';
    }
  };

  // 排序任务
  const sortedTasks = () => {
    return [...tasks].sort((a, b) => {
      switch (sortType) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                 (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        case 'dueDate':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return parseLocalTimeString(a.dueDate).getTime() - parseLocalTimeString(b.dueDate).getTime(); // 🔧 使用工具函数
        default:
          return parseLocalTimeString(b.createdAt).getTime() - parseLocalTimeString(a.createdAt).getTime(); // 🔧 使用工具函数
      }
    });
  };

  // 过滤任务
  const filteredTasks = () => {
    const sorted = sortedTasks();
    if (filterCompleted) {
      return sorted.filter(task => !task.completed);
    }
    return sorted;
  };

  return (
    <div className="task-manager">
      <div className="task-manager-header">
        <h2>📋 我的任务</h2>
        <div className="header-actions">
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary"
          >
            ➕ 添加任务
          </button>
        </div>
      </div>

      {/* 过滤和排序控件 */}
      <div className="task-controls">
        <div className="sort-controls">
          <label>排序方式:</label>
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as 'priority' | 'dueDate' | 'created')}
            className="form-control-small"
          >
            <option value="created">创建时间</option>
            <option value="priority">优先级</option>
            <option value="dueDate">截止时间</option>
          </select>
        </div>
        
        <div className="filter-controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filterCompleted}
              onChange={(e) => setFilterCompleted(e.target.checked)}
            />
            隐藏已完成
          </label>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="tasks-list">
        {filteredTasks().length === 0 ? (
          <p className="no-tasks">暂无任务</p>
        ) : (
          filteredTasks().map(task => (
            <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <div className="task-header">
                <div className="task-checkbox">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTaskComplete(task.id)} // 🔧 修复：使用正确的函数名
                  />
                </div>
                <div className="task-title-section">
                  <h4 className="task-title">{task.title}</h4>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  >
                    {getPriorityLabel(task.priority)}优先级
                  </span>
                </div>
                <div className="task-actions">
                  <button
                    onClick={() => openTaskEditor(task)}
                    className="btn btn-edit-small"
                    title="编辑任务"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onStartTimer(task.title)}
                    className="btn btn-timer-small"
                    title="开始计时"
                  >
                    ⏰
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="btn btn-delete-small"
                    title="删除任务"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {task.description && (
                <div className="task-description">{task.description}</div>
              )}
              
              <div className="task-meta">
                <div className="task-dates">
                  {task.dueDate && (
                    <span style={{ color: '#6c757d' }}>
                      截止: {parseLocalTimeString(task.dueDate).toLocaleDateString('zh-CN')} {/* 🔧 使用工具函数 */}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 添加任务表单 */}
      {showAddForm && (
        <div className="task-form-overlay">
          <div className="task-form">
            <div className="form-header">
              <h3>添加新任务</h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="btn btn-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); addTask(); }}>
              <div className="form-group">
                <label>任务标题:</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  required
                  className="form-control"
                  placeholder="输入任务标题..."
                />
              </div>

              <div className="form-group">
                <label>任务描述:</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="form-control"
                  rows={3}
                  placeholder="输入任务描述（可选）..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>优先级:</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="form-control"
                  >
                    <option value="low">低优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="high">高优先级</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>截止日期:</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  添加任务
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)} 
                  className="btn btn-secondary"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 描述编辑器 */}
      <DescriptionEditor
        isOpen={descriptionEditor.isOpen}
        onClose={closeDescriptionEditor}
        onSave={saveDescriptionAndTags}
        initialDescription={descriptionEditor.description}
        initialTags={descriptionEditor.tags}
        title={descriptionEditor.title}
      />
    </div>
  );
};

export default TaskManager;
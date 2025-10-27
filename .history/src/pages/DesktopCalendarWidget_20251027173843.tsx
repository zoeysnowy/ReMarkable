/**
 * DesktopCalendarWidget - Electron 桌面窗口页面（全屏模式）
 * 完全复刻 DesktopCalendarWidgetV3 的样式和透明度逻辑
 * 但布局适配 Electron 全屏窗口（不使用 position: fixed）
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import TimeCalendar from '../components/TimeCalendar'; // ✅ 使用原始 TimeCalendar
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import { ActionBasedSyncManager } from '../services/ActionBasedSyncManager';
import '../components/DesktopCalendarWidget.css'; // 导入桌面日历 CSS
import SyncIcon from '../assets/icons/Sync.svg';
import OutlookIcon from '../assets/icons/Outlook.svg';

// 包装 TimeCalendar，只在必要的 props 变化时重渲染
const MemoizedTimeCalendar = memo(TimeCalendar, (prevProps, nextProps) => {
  // 只有这些 props 变化时才重渲染
  return (
    prevProps.calendarBackgroundColor === nextProps.calendarBackgroundColor &&
    prevProps.calendarOpacity === nextProps.calendarOpacity &&
    prevProps.widgetLocked === nextProps.widgetLocked &&
    prevProps.microsoftService === nextProps.microsoftService &&
    prevProps.syncManager === nextProps.syncManager &&
    prevProps.lastSyncTime === nextProps.lastSyncTime
  );
});

interface CustomCSSProperties extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const DesktopCalendarWidget: React.FC = () => {
  // 🆔 生成或读取唯一的 Widget ID
  const [widgetId] = useState(() => {
    // 1. 尝试从 URL 参数读取
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('widgetId');
    if (urlId) {
      console.log('📝 [Widget] Using widgetId from URL:', urlId);
      return urlId;
    }
    
    // 2. 尝试从 localStorage 读取
    const savedId = localStorage.getItem('remarkable-widget-instance-id');
    if (savedId) {
      console.log('📝 [Widget] Using saved widgetId:', savedId);
      return savedId;
    }
    
    // 3. 生成新的 ID 并保存
    const newId = `widget-${Date.now()}`;
    localStorage.setItem('remarkable-widget-instance-id', newId);
    console.log('✨ [Widget] Generated new widgetId:', newId);
    return newId;
  });

  // 🔧 生成唯一的存储 key
  const storageKey = `remarkable-widget-settings-${widgetId}`;
  
  // 🔄 使用全局单例服务，确保与主应用的登录状态一致
  const [microsoftService, setMicrosoftService] = useState<any>(() => {
    // 优先使用全局实例，如果不存在则创建新实例（兼容性）
    if (typeof window !== 'undefined' && (window as any).microsoftCalendarService) {
      console.log('✅ [Widget] 使用全局 microsoftCalendarService 实例');
      console.log('🔍 [Widget] 登录状态:', (window as any).microsoftCalendarService.isSignedIn());
      return (window as any).microsoftCalendarService;
    }
    console.warn('⚠️ [Widget] 全局实例不存在，创建新的 MicrosoftCalendarService');
    return new MicrosoftCalendarService();
  });
  
  // 🔄 延迟检查全局服务（给App.tsx时间初始化）
  useEffect(() => {
    const checkGlobalService = () => {
      if (typeof window !== 'undefined' && (window as any).microsoftCalendarService) {
        const globalService = (window as any).microsoftCalendarService;
        if (globalService !== microsoftService) {
          console.log('🔄 [Widget] 发现全局服务，切换到全局实例');
          console.log('🔍 [Widget] 全局服务登录状态:', globalService.isSignedIn());
          setMicrosoftService(globalService);
        } else {
          console.log('✅ [Widget] 已经在使用全局服务');
        }
      } else {
        console.log('⚠️ [Widget] 全局服务仍未初始化，稍后重试...');
      }
    };
    
    // 延迟1秒后检查（给App.tsx初始化时间）
    const timer = setTimeout(() => {
      console.log('⏰ [Widget] 开始检查全局服务...');
      checkGlobalService();
    }, 1000);
    
    // 再延迟3秒检查一次（以防第一次太早）
    const timer2 = setTimeout(() => {
      console.log('⏰ [Widget] 第二次检查全局服务...');
      checkGlobalService();
    }, 3000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, []); // 空依赖数组，只在挂载时执行一次
  
  const [syncManager, setSyncManager] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null); // 定时器引用
  
  // 🔐 从 localStorage 读取主应用的登录状态（Widget 独立窗口无法直接访问主应用状态）
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    // 初始读取
    const checkAuthStatus = () => {
      try {
        const authStatus = localStorage.getItem('remarkable-outlook-authenticated');
        setIsAuthenticated(authStatus === 'true');
      } catch (error) {
        console.error('❌ [Widget] Failed to read auth status:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuthStatus();
    
    // 定期检查（每5秒）
    const interval = setInterval(checkAuthStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // 样式控制 - 简化版：只控制日历背景
  const [bgOpacity, setBgOpacity] = useState(0.95); // 日历背景透明度，默认 95%
  const [bgColor, setBgColor] = useState('#ffffff'); // 日历背景颜色，默认白色

  const widgetRef = useRef<HTMLDivElement>(null);
  
  // 调整大小状态
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; edge: string } | null>(null);
  const resizeThrottleRef = useRef<number>(0); // 节流用的时间戳
  
  // Resize 性能追踪
  const resizePerfRef = useRef({ count: 0, totalTime: 0, maxTime: 0, minTime: Infinity });
  const lastResizeTimeRef = useRef<number>(0);
  const resizeIpcBusyRef = useRef<boolean>(false); // IPC忙碌标志
  
  // 拖动状态 - 恢复自定义拖动实现
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragThrottleRef = useRef<number>(0);
  
  // 性能追踪
  const perfRef = useRef<{
    moveCount: number;
    totalTime: number;
    maxTime: number;
    minTime: number;
  }>({ moveCount: 0, totalTime: 0, maxTime: 0, minTime: Infinity });
  
  // ⚡ 新增：IPC忙碌标志和delta累积
  const ipcBusyRef = useRef<boolean>(false);
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const sentMoveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // 追踪已发送的总移动量
  
  // 调整大小光标悬停状态（保持3秒）
  const [isResizeHovering, setIsResizeHovering] = useState(false);
  const resizeHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 从 localStorage 读取设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('desktop-calendar-widget-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setBgOpacity(settings.bgOpacity !== undefined ? settings.bgOpacity : 0.95);
        setBgColor(settings.bgColor || '#ffffff');
        const locked = settings.isLocked || false;
        setIsLocked(locked);
        console.log('🔒 Widget locked status:', locked);
        
        // 同步锁定状态到 Electron 主进程
        if (window.electronAPI?.widgetLock) {
          window.electronAPI.widgetLock(locked).then(() => {
            console.log('✅ Lock state synced to main process:', locked);
          }).catch((error: Error) => {
            console.error('❌ Failed to sync lock state:', error);
          });
        }
      } catch (e) {
        console.error('Failed to parse widget settings', e);
      }
    } else {
      console.log('🔓 No saved settings, widget is unlocked');
      // 确保主进程也是解锁状态
      if (window.electronAPI?.widgetLock) {
        window.electronAPI.widgetLock(false).then(() => {
          console.log('✅ Main process unlocked');
        });
      }
    }
  }, []);

  // 保存设置（防抖）
  useEffect(() => {
    const t = setTimeout(() => {
      const settings = { bgOpacity, bgColor, isLocked };
      localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(settings));
    }, 500);
    return () => clearTimeout(t);
  }, [bgOpacity, bgColor, isLocked]);

  // 初始化 widget-mode 样式
  useEffect(() => {
    console.log('🎨 [Renderer] DesktopCalendarWidget mounted');
    console.log('🔍 [Renderer] 检查 electronAPI:', {
      hasElectronAPI: !!window.electronAPI,
      hasWidgetMove: !!window.electronAPI?.widgetMove
    });
    
    document.body.classList.add('widget-mode');
    document.body.style.backgroundColor = 'transparent';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    // 检查拖动条元素
    setTimeout(() => {
      const dragBar = document.querySelector('.drag-bar') as HTMLElement;
      if (dragBar) {
        const computedStyle = window.getComputedStyle(dragBar);
        console.log('✅ [Renderer] Drag bar found:', {
          element: dragBar,
          webkitAppRegion: computedStyle.getPropertyValue('-webkit-app-region'),
          pointerEvents: computedStyle.pointerEvents,
          cursor: computedStyle.cursor,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex,
          width: computedStyle.width,
          height: computedStyle.height
        });
      } else {
        console.error('❌ [Renderer] Drag bar NOT found!');
      }
    }, 500);
    
    return () => {
      document.body.classList.remove('widget-mode');
      document.body.style.backgroundColor = '';
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
    };
  }, []);

  // 🔄 使用全局同步管理器，确保与主应用数据一致
  useEffect(() => {
    const checkAuthAndInitSync = () => {
      const isAuthenticated = microsoftService.isSignedIn();
      console.log('🔍 [Widget] 检查认证状态:', isAuthenticated);
      
      if (isAuthenticated && !syncManager) {
        console.log('🚀 [Widget] 用户已登录，尝试使用全局同步管理器...');
        
        // 优先使用全局 syncManager
        if (typeof window !== 'undefined' && (window as any).syncManager) {
          console.log('✅ [Widget] 使用全局 syncManager 实例');
          const globalSync = (window as any).syncManager;
          setSyncManager(globalSync);
          
          // 立即获取同步时间
          const time = globalSync.getLastSyncTime?.();
          if (time) {
            console.log('🕐 [Widget] 获取到全局同步时间:', time);
            setLastSyncTime(time);
          }
          return;
        }
        
        // 如果全局 syncManager 不存在，创建新实例（兼容性）
        console.warn('⚠️ [Widget] 全局 syncManager 不存在，创建新实例');
        try {
          const newSyncManager = new ActionBasedSyncManager(microsoftService);
          setSyncManager(newSyncManager);
          
          // 启动同步管理器
          newSyncManager.start();
          console.log('✅ [Widget] 同步管理器初始化成功');
          
          // 暴露到全局用于调试
          if (typeof window !== 'undefined') {
            (window as any).widgetSyncManager = newSyncManager;
          }
        } catch (error) {
          console.error('❌ [Widget] 同步管理器初始化失败:', error);
        }
      } else if (!isAuthenticated && syncManager) {
        console.log('⏸️ [Widget] 用户已登出，停止同步管理器...');
        syncManager.stop();
        setSyncManager(null);
      }
    };
    
    checkAuthAndInitSync();
    
    // 定期检查认证状态（每分钟）
    const authCheckInterval = setInterval(checkAuthAndInitSync, 60000);
    
    return () => {
      clearInterval(authCheckInterval);
      if (syncManager) {
        syncManager.stop();
      }
    };
  }, [microsoftService, syncManager]);

  // 🔄 定期更新 lastSyncTime
  useEffect(() => {
    if (!syncManager) {
      console.log('⚠️ [Widget] syncManager 为空，无法更新同步时间');
      return;
    }
    
    const updateSyncTime = () => {
      try {
        const time = syncManager.getLastSyncTime?.();
        if (time) {
          console.log('🕐 [Widget] 更新同步时间:', time.toLocaleString('zh-CN'));
          setLastSyncTime(time);
        } else {
          console.log('⚠️ [Widget] getLastSyncTime 返回空值');
        }
      } catch (error) {
        console.error('❌ [Widget] 获取同步时间失败:', error);
      }
    };
    
    // 立即更新一次
    console.log('🔄 [Widget] 开始定期更新同步时间...');
    updateSyncTime();
    
    // 每5秒更新一次（更频繁以确保同步）
    const syncTimeInterval = setInterval(updateSyncTime, 5000);
    
    return () => clearInterval(syncTimeInterval);
  }, [syncManager]);

  // 移除控制栏自动显示逻辑，不再需要
  // useEffect(() => {
  //   const handleMouseMove = (e: MouseEvent) => {
  //     const isNearTop = e.clientY <= 10;
  //     if (isNearTop) {
  //       setShowControls(true);
  //       if (hideTimerRef.current) {
  //         clearTimeout(hideTimerRef.current);
  //       }
  //       hideTimerRef.current = setTimeout(() => {
  //         setShowControls(false);
  //       }, 5000);
  //     }
  //   };
  //   window.addEventListener('mousemove', handleMouseMove);
  //   return () => {
  //     window.removeEventListener('mousemove', handleMouseMove);
  //     if (hideTimerRef.current) {
  //       clearTimeout(hideTimerRef.current);
  //     }
  //   };
  // }, []);

  // 动态注入 CSS 控制日历内部元素透明度
  // 移除错误的动态CSS注入逻辑
  // calendar.css 中的静态样式已经足够，不需要动态覆盖
  // bgOpacity 只应该影响 TimeCalendar 的 backgroundColor，不应该影响内部元素

  // 锁定切换（调用 Electron API） - 使用 useCallback 优化
  const handleLockToggle = useCallback(async (newLockState?: boolean) => {
    const targetState = newLockState !== undefined ? newLockState : !isLocked;
    console.log('🔄 handleLockToggle called:', { current: isLocked, target: targetState });
    
    setIsLocked(targetState);
    
    if (window.electronAPI?.widgetLock) {
      try {
        const result = await window.electronAPI.widgetLock(targetState);
        console.log('✅ Widget lock state changed:', { locked: targetState, result });
      } catch (error) {
        console.error('❌ Failed to set widget lock:', error);
      }
    } else {
      console.warn('⚠️ electronAPI.widgetLock not available');
    }
  }, [isLocked]);

  // 调整大小处理
  const handleResizeStart = useCallback((edge: string, e: React.MouseEvent) => {
    console.log('🎯 [Resize] handleResizeStart 被调用!', { edge, isLocked });
    if (isLocked) {
      console.log('❌ [Resize] 被 isLocked 阻止');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    console.log('✅ [Resize] 开始调整大小:', edge);
    setIsResizing(true);
    const bounds = widgetRef.current?.getBoundingClientRect();
    if (bounds) {
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: bounds.width,
        height: bounds.height,
        edge
      };
      console.log('📐 [Resize] 初始尺寸:', { width: bounds.width, height: bounds.height });
    }
  }, [isLocked]);

  // 调整大小手柄悬停处理（保持2秒）
  const handleResizeHover = useCallback(() => {
    setIsResizeHovering(true);
    
    // 清除之前的计时器
    if (resizeHoverTimerRef.current) {
      clearTimeout(resizeHoverTimerRef.current);
    }
    
    // 🎯 2秒后隐藏（满足"至少维持2秒"的要求）
    resizeHoverTimerRef.current = setTimeout(() => {
      setIsResizeHovering(false);
    }, 2000);
  }, []);

  const handleResizeLeave = useCallback(() => {
    // 不立即隐藏，等待计时器
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStartRef.current) return;
    
    const startTime = Date.now();
    const timeSinceLastResize = lastResizeTimeRef.current ? startTime - lastResizeTimeRef.current : 0;
    lastResizeTimeRef.current = startTime;
    
    const { x, y, width, height, edge } = resizeStartRef.current;
    const deltaX = e.clientX - x;
    const deltaY = e.clientY - y;
    
    let newWidth = width;
    let newHeight = height;
    
    if (edge.includes('right')) newWidth = width + deltaX;
    if (edge.includes('left')) newWidth = width - deltaX;
    if (edge.includes('bottom')) newHeight = height + deltaY;
    if (edge.includes('top')) newHeight = height - deltaY;
    
    // 最小尺寸限制
    newWidth = Math.max(400, newWidth);
    newHeight = Math.max(300, newHeight);
    
    // 🔧 激进的节流：拖动中每100ms最多更新一次（减少渲染次数）
    const now = Date.now();
    if (now - resizeThrottleRef.current < 100) {
      // 静默跳过，不打印日志
      return;
    }
    resizeThrottleRef.current = now;
    
    // 🔧 如果上一个resize IPC还在处理中，跳过本次请求
    if (resizeIpcBusyRef.current) {
      return;
    }
    
    // 调用Electron API调整窗口大小
    if (window.electronAPI?.widgetResize) {
      resizeIpcBusyRef.current = true; // 标记忙碌
      const ipcStart = Date.now();
      window.electronAPI.widgetResize({ width: Math.round(newWidth), height: Math.round(newHeight) })
        .then((result: any) => {
          resizeIpcBusyRef.current = false; // 重置忙碌标志
          const ipcEnd = Date.now();
          const ipcDuration = ipcEnd - ipcStart;
          
          // 更新性能统计
          resizePerfRef.current.count++;
          resizePerfRef.current.totalTime += ipcDuration;
          resizePerfRef.current.maxTime = Math.max(resizePerfRef.current.maxTime, ipcDuration);
          resizePerfRef.current.minTime = Math.min(resizePerfRef.current.minTime, ipcDuration);
        })
        .catch((error: any) => {
          resizeIpcBusyRef.current = false; // 出错也要重置
          console.error('❌ [Renderer] widgetResize 失败:', error);
        });
    }
  }, [isResizing]); // 移除 isDragging 依赖

  const handleResizeEnd = useCallback(async (event?: MouseEvent) => {
    console.log('🏁 [Resize] handleResizeEnd 被调用!', { isResizing, hasEvent: !!event });
    if (!isResizing) {
      console.log('⚠️ [Resize] isResizing=false, 跳过结束逻辑');
      return;
    }
    
    console.log('✅ [Resize] 结束 resize');
    
    // 如果有event，立即应用最终尺寸
    if (event && resizeStartRef.current) {
      const deltaX = event.clientX - resizeStartRef.current.x;
      const deltaY = event.clientY - resizeStartRef.current.y;
      const newWidth = Math.max(400, resizeStartRef.current.width + deltaX);
      const newHeight = Math.max(300, resizeStartRef.current.height + deltaY);
      
      console.log('📐 [Resize] 应用最终尺寸:', { newWidth, newHeight });
      
      // 强制应用最终尺寸
      try {
        await window.electronAPI.widgetResize({
          width: newWidth,
          height: newHeight
        });
      } catch (error) {
        console.error('❌ 应用最终尺寸失败:', error);
      }
    }
    
    // 重置IPC忙碌标志
    resizeIpcBusyRef.current = false;
    
    // 重置性能统计
    resizePerfRef.current = { count: 0, totalTime: 0, maxTime: 0, minTime: Infinity };
    lastResizeTimeRef.current = 0;
    
    setIsResizing(false);
    resizeStartRef.current = null;
    console.log('✅ [Resize] 状态已重置');
  }, [isResizing]);

  // 监听鼠标移动和释放
  useEffect(() => {
    if (isResizing) {
      console.log('👂 [Resize] 添加 mousemove 和 mouseup 监听器');
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        console.log('🔇 [Resize] 移除 mousemove 和 mouseup 监听器');
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // 拖动处理 - 简化版，依赖主进程的尺寸恢复机制
  // ===== 拖动相关逻辑 - 自定义拖动实现 =====
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isLocked || isResizing) {
      console.log('🚫 [Renderer] 拖动被阻止:', { isLocked, isResizing });
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // 重置性能统计
    perfRef.current = { moveCount: 0, totalTime: 0, maxTime: 0, minTime: Infinity };
    
    console.log('🎬 [Renderer] 开始拖动:', { screenX: e.screenX, screenY: e.screenY });
    setIsDragging(true);
    dragStartRef.current = {
      x: e.screenX,
      y: e.screenY
    };
  }, [isLocked, isResizing]);

  const handleDragMove = useCallback(async (e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || isResizing) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastMove = now - dragThrottleRef.current;
    
    e.preventDefault();
    e.stopPropagation();
    
    // 🔧 计算相对于拖动起始点的总移动量
    const totalMoveX = e.screenX - dragStartRef.current.x;
    const totalMoveY = e.screenY - dragStartRef.current.y;
    
    // 🔧 计算还未发送的增量 = 总移动量 - 已发送量
    const deltaX = totalMoveX - sentMoveRef.current.x;
    const deltaY = totalMoveY - sentMoveRef.current.y;
    
    // ⚡ 关键优化：累积delta,避免IPC请求排队
    if (!pendingMoveRef.current) {
      pendingMoveRef.current = { x: 0, y: 0 };
    }
    pendingMoveRef.current.x += deltaX;
    pendingMoveRef.current.y += deltaY;
    
    // 更新已计算的总移动量（包括pending）
    sentMoveRef.current.x = totalMoveX;
    sentMoveRef.current.y = totalMoveY;
    
    console.log('🚚 [Renderer] 拖动中:', { 
      currentScreen: { x: e.screenX, y: e.screenY },
      totalMove: { x: totalMoveX, y: totalMoveY },
      delta: { x: deltaX, y: deltaY },
      pending: pendingMoveRef.current,
      timeSinceLastMove: `${timeSinceLastMove}ms`,
      fps: Math.round(1000 / timeSinceLastMove),
      ipcBusy: ipcBusyRef.current
    });
    
    // ⚡ 关键优化：如果上一个IPC还在处理,跳过本次发送
    if (ipcBusyRef.current) {
      console.log('⏭️ [Renderer] IPC忙碌中,跳过本次请求');
      dragThrottleRef.current = now;
      return;
    }
    
    // ⚡ 节流：至少等待16ms (60fps)
    if (now - dragThrottleRef.current < 16) {
      return;
    }
    dragThrottleRef.current = now;
    
    // 🚀 发送累积的delta
    const moveX = pendingMoveRef.current.x;
    const moveY = pendingMoveRef.current.y;
    
    if (Math.abs(moveX) > 0 || Math.abs(moveY) > 0) {
      pendingMoveRef.current = { x: 0, y: 0 }; // 重置累积
      
      if (window.electronAPI?.widgetMove) {
        try {
          const ipcStartTime = performance.now();
          ipcBusyRef.current = true; // 标记IPC忙碌
          
          // � 不等待返回，立即发送下一个移动
          window.electronAPI.widgetMove({ x: moveX, y: moveY }).then((result) => {
            const ipcEndTime = performance.now();
            const ipcDuration = ipcEndTime - ipcStartTime;
            ipcBusyRef.current = false; // 释放标志
            
            // 更新性能统计
            perfRef.current.moveCount++;
            perfRef.current.totalTime += ipcDuration;
            perfRef.current.maxTime = Math.max(perfRef.current.maxTime, ipcDuration);
            perfRef.current.minTime = Math.min(perfRef.current.minTime, ipcDuration);
            
            const avgTime = perfRef.current.totalTime / perfRef.current.moveCount;
            
            console.log('✅ [Renderer] widgetMove 完成:', {
              sent: { x: moveX, y: moveY },
              result,
              duration: `${ipcDuration.toFixed(2)}ms`,
              avg: `${avgTime.toFixed(2)}ms`,
              min: `${perfRef.current.minTime.toFixed(2)}ms`,
              max: `${perfRef.current.maxTime.toFixed(2)}ms`,
              count: perfRef.current.moveCount
            });
          }).catch((error) => {
            console.error('❌ [Renderer] widgetMove 失败:', error);
            ipcBusyRef.current = false; // 出错时也要释放
          });
          
        } catch (error) {
          console.error('❌ [Renderer] widgetMove 异常:', error);
          ipcBusyRef.current = false;
        }
      } else {
        console.error('❌ [Renderer] widgetMove API 不存在');
      }
    }
  }, [isDragging, isResizing]);

  const handleDragEnd = useCallback(() => {
    console.log('🏁 [Renderer] 拖动结束');
    
    // 打印性能总结
    if (perfRef.current.moveCount > 0) {
      const avgTime = perfRef.current.totalTime / perfRef.current.moveCount;
      console.log('📊 [Renderer] 拖动性能总结:', {
        totalMoves: perfRef.current.moveCount,
        avgIpcTime: `${avgTime.toFixed(2)}ms`,
        minIpcTime: `${perfRef.current.minTime.toFixed(2)}ms`,
        maxIpcTime: `${perfRef.current.maxTime.toFixed(2)}ms`,
        totalTime: `${perfRef.current.totalTime.toFixed(2)}ms`,
        avgFps: Math.round(1000 / (avgTime + 32)) // 32ms是节流时间
      });
    }
    
    setIsDragging(false);
    dragStartRef.current = null;
    
    // 🔧 重置所有ref状态
    ipcBusyRef.current = false;
    pendingMoveRef.current = null;
    sentMoveRef.current = { x: 0, y: 0 };
    
    // ⚡ 重置IPC状态
    ipcBusyRef.current = false;
    pendingMoveRef.current = null;
    
    // 通知主进程拖动结束，重置目标尺寸
    if ((window.electronAPI as any)?.widgetDragEnd) {
      (window.electronAPI as any).widgetDragEnd().catch((err: Error) => {
        console.error('❌ [Renderer] widgetDragEnd 失败:', err);
      });
    }
  }, []);

  // 监听拖动
  useEffect(() => {
    if (isDragging) {
      console.log('👂 [Renderer] 开始监听 mousemove 和 mouseup');
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        console.log('🔇 [Renderer] 停止监听 mousemove 和 mouseup');
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);


  // color->rgba
  const bgColorRgba = (() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  })();

  // 最外层容器样式 - 透明容器
  const widgetStyle: CustomCSSProperties = {
    width: '100vw',
    height: '100vh',
    backgroundColor: 'transparent', // 容器透明，让 Electron 窗口背景透过
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'default',
    userSelect: 'none',
    position: 'relative', // 🎯 为 absolute 定位的 resize handles 提供定位上下文
    transition: 'opacity 0.2s ease', // 只保留透明度过渡，移除缩放动画
    WebkitAppRegion: 'no-drag' // 默认不可拖动，只有拖动条可以拖动
  };

  // 渲染时输出状态（调试用）
  // console.log('🎨 [Render] Widget状态:', { isLocked, isDragging, isResizing, showControls });

  return (
    <div
      ref={widgetRef}
      className="desktop-calendar-widget"
      style={widgetStyle}
    >
      {/* 调整大小时的全屏遮罩层 */}
      {isResizing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          cursor: 'default',
          pointerEvents: 'none' // 不阻止鼠标事件传播
        }} />
      )}
      
      {/* 不需要拖动遮罩层 - window 级别的监听器足够了 */}

      {/* 顶部拖动条 - 自定义拖动实现 */}
      {!isLocked && (
        <div
          className="drag-bar"
          data-testid="widget-drag-bar"
          style={{
            position: 'absolute',
            top: '0px', // 🎯 紧贴顶部边缘
            left: '8px',
            right: '8px',
            width: 'calc(100% - 16px)',
            height: '10px',
            zIndex: 10000,
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: showControls ? 'rgba(100, 150, 255, 0.5)' : 'rgba(100, 150, 255, 0.25)', // 🎯 固定蓝色，半透明
            backdropFilter: showControls ? 'blur(8px)' : 'blur(3px)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            transition: 'all 0.15s ease',
            boxShadow: showControls ? '0 2px 8px rgba(100, 150, 255, 0.3)' : 'none',
            pointerEvents: 'auto'
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setShowControls(true);
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            setShowControls(false);
          }}
          onMouseDown={handleDragStart}
        >
          {/* 拖动条提示文字 */}
          <span style={{
            fontSize: '9px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.95)',
            letterSpacing: '1.5px',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            opacity: showControls ? 1 : 0.6,
            transition: 'opacity 0.15s ease'
          }}
          >
            ⋮⋮⋮
          </span>
        </div>
      )}

      {/* 调整大小手柄 - 只保留底部和侧边 */}
      {!isLocked && (
        <>
          <div className="resize-handle-bottom" onMouseDown={(e) => handleResizeStart('bottom', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-left" onMouseDown={(e) => handleResizeStart('left', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-right" onMouseDown={(e) => handleResizeStart('right', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-bottomleft" onMouseDown={(e) => handleResizeStart('bottomleft', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-bottomright" onMouseDown={(e) => handleResizeStart('bottomright', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
        </>
      )}

      {/* 主要内容容器 - 使用 flexbox 布局 */}
      <div 
        style={{ 
          flex: 1, 
          marginTop: '14px', // 🎯 drag-bar (0px + 10px height) + 4px 间距 = 14px
          marginBottom: '0',
          position: 'relative', 
          overflow: 'hidden', 
          pointerEvents: 'auto',
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          flexDirection: 'column'
        } as CustomCSSProperties} 
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 日历主体区域 */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MemoizedTimeCalendar
            onStartTimer={useCallback((taskTitle: string) => { 
              console.log('📝 Timer started:', taskTitle); 
            }, [])}
            microsoftService={microsoftService}
            syncManager={syncManager}
            lastSyncTime={lastSyncTime}
            isWidgetMode={true}
            storageKey={storageKey} // 🔧 使用唯一的存储key
            className="desktop-calendar-inner"
            style={useMemo(() => ({ 
              height: '100%', 
              border: 'none', 
              borderRadius: '0 0 12px 12px', 
              background: 'transparent',
            }), [])}
            calendarBackgroundColor={bgColor}
            calendarOpacity={bgOpacity}
            onWidgetOpacityChange={setBgOpacity}
            onWidgetColorChange={setBgColor}
            onWidgetLockToggle={handleLockToggle}
            widgetLocked={isLocked}
          />
        </div>

        {/* 📊 Widget 专属状态栏 - 正常布局，底部固定 */}
        <div 
          style={{
            flexShrink: 0,
            margin: '4px 8px 4px 8px', // 🎯 统一间距：上下 4px，左右 8px
            background: `rgba(${parseInt(bgColor.slice(1,3), 16)}, ${parseInt(bgColor.slice(3,5), 16)}, ${parseInt(bgColor.slice(5,7), 16)}, ${bgOpacity * 0.8})`, // 🎯 与 controller 一致：bgOpacity * 0.8
            backdropFilter: 'blur(3px)', // 🎯 与 controller 一致：blur(3px)
            borderRadius: '20px', // 🎨 四个角都有圆角，独立卡片设计
            border: 'none',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: (() => {
              const r = parseInt(bgColor.slice(1,3), 16);
              const g = parseInt(bgColor.slice(3,5), 16);
              const b = parseInt(bgColor.slice(5,7), 16);
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
              const isDark = luminance < 128;
              return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
            })(),
            cursor: 'default',
            // @ts-ignore - Electron specific property
            WebkitAppRegion: 'no-drag',
            // @ts-ignore - Electron specific property  
            appRegion: 'no-drag',
            pointerEvents: 'auto' // ✅ 正常接收鼠标事件，resize handles 通过高 z-index 覆盖
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={SyncIcon} alt="Sync" style={{ 
              width: 16, 
              height: 16,
              filter: (() => {
                const r = parseInt(bgColor.slice(1,3), 16);
                const g = parseInt(bgColor.slice(3,5), 16);
                const b = parseInt(bgColor.slice(5,7), 16);
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                return luminance < 128 ? 'brightness(1.2)' : 'none';
              })()
            }} />
            <span>
              {lastSyncTime ? (
                <>
                  最后同步：<strong style={{ 
                    color: (() => {
                      const r = parseInt(bgColor.slice(1,3), 16);
                      const g = parseInt(bgColor.slice(3,5), 16);
                      const b = parseInt(bgColor.slice(5,7), 16);
                      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                      const isDark = luminance < 128;
                      return isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.87)';
                    })()
                  }}>
                    {lastSyncTime.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </strong>
                </>
              ) : '正在同步...'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={OutlookIcon} alt="Outlook" style={{ 
              width: 16, 
              height: 16,
              filter: (() => {
                const r = parseInt(bgColor.slice(1,3), 16);
                const g = parseInt(bgColor.slice(3,5), 16);
                const b = parseInt(bgColor.slice(5,7), 16);
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                return luminance < 128 ? 'brightness(1.2)' : 'none';
              })()
            }} />
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isAuthenticated ? '#4ade80' : '#ef4444',
                boxShadow: isAuthenticated
                  ? '0 0 8px rgba(74, 222, 128, 0.6)'
                  : '0 0 8px rgba(239, 68, 68, 0.6)',
                transition: 'all 0.3s ease'
              }}
              title={isAuthenticated ? '已连接' : '未连接'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopCalendarWidget;

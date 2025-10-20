import React, { useState, useEffect } from 'react';
import './TimerCard.css';

export interface TimerSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  description: string;
  isActive: boolean;
}

interface TimerCardProps {
  onSessionComplete?: (session: TimerSession) => void;
  className?: string;
}

export const TimerCard: React.FC<TimerCardProps> = ({ 
  onSessionComplete,
  className = '' 
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentSession, setCurrentSession] = useState<TimerSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [description, setDescription] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && currentSession) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - currentSession.startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, currentSession]);

  const startTimer = () => {
    const newSession: TimerSession = {
      id: Date.now().toString(),
      startTime: new Date(),
      duration: 0,
      description: description || '工作会话',
      isActive: true
    };
    
    setCurrentSession(newSession);
    setIsRunning(true);
    setElapsedTime(0);
  };

  const stopTimer = () => {
    if (currentSession) {
      const endTime = new Date();
      const finalSession: TimerSession = {
        ...currentSession,
        endTime,
        duration: elapsedTime,
        isActive: false
      };
      
      setIsRunning(false);
      setCurrentSession(null);
      setElapsedTime(0);
      
      if (onSessionComplete) {
        onSessionComplete(finalSession);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`timer-card ${className}`}>
      <div className="timer-card-header">
        <h3>计时器</h3>
      </div>
      
      <div className="timer-display">
        <span className="time-text">{formatTime(elapsedTime)}</span>
      </div>

      <div className="timer-description">
        <input
          type="text"
          placeholder="输入活动描述..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isRunning}
          className="description-input"
        />
      </div>

      <div className="timer-controls">
        {!isRunning ? (
          <button 
            onClick={startTimer}
            className="timer-btn start-btn"
            disabled={!description.trim()}
          >
            开始计时
          </button>
        ) : (
          <button 
            onClick={stopTimer}
            className="timer-btn stop-btn"
          >
            停止计时
          </button>
        )}
      </div>

      {currentSession && (
        <div className="current-session-info">
          <p className="session-description">{currentSession.description}</p>
          <p className="session-start-time">
            开始时间: {currentSession.startTime.toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
};


  useEffect(() => {export const TimerCard: React.FC<TimerCardProps> = ({

    let interval: NodeJS.Timeout;  onTimerStart,

      globalTimer,

    if (isRunning && currentSession) {  onTimerPause,

      interval = setInterval(() => {  onTimerResume,

        const now = new Date();  onTimerStop,

        const elapsed = Math.floor((now.getTime() - currentSession.startTime.getTime()) / 1000);  onTimerCancel,

        setElapsedTime(elapsed);  onTimerEdit,

      }, 1000);  onStartTimeChange,

    }}) => {

  // 初始化为 null，将在 useEffect 中设置为最新时间

    return () => {  const [currentTime, setCurrentTime] = useState<number>(Date.now());

      if (interval) {  const [isPulsing, setIsPulsing] = useState(false);

        clearInterval(interval);  

      }  // 判断是否处于初始状态（未开始计时）

    };  const isIdle = !startTime;

  }, [isRunning, currentSession]);  

  // 立即初始化 currentTime 为最新时间（在组件挂载或 startTime 变化时）

  const startTimer = () => {  useEffect(() => {

    const newSession: TimerSession = {    setCurrentTime(Date.now());

      id: Date.now().toString(),  }, [startTime]);

      startTime: new Date(),  

      duration: 0,  // 每秒更新时间

      description: description || '工作会话',  useEffect(() => {

      isActive: true    if (isRunning && !isIdle) {

    };      // 立即更新一次，确保时间是最新的

          const now = Date.now();

    setCurrentSession(newSession);      setCurrentTime(now);

    setIsRunning(true);      

    setElapsedTime(0);      const interval = setInterval(() => {

  };        setCurrentTime(Date.now());

      }, 1000);

  const stopTimer = () => {      

    if (currentSession) {      return () => clearInterval(interval);

      const endTime = new Date();    }

      const finalSession: TimerSession = {  }, [isRunning, isIdle]);

        ...currentSession,  

        endTime,  // 计算总时长（秒）- 使用最新的 Date.now() 而不是 state 中的 currentTime

        duration: elapsedTime,  const now = Date.now();

        isActive: false  const totalElapsed = (!isIdle && isRunning && startTime) 

      };    ? elapsedTime + (now - startTime)

          : elapsedTime;

      setIsRunning(false);  

      setCurrentSession(null);  // 调试：记录计算过程（使用最新的 now 而不是 state 中的 currentTime）

      setElapsedTime(0);  if (!isIdle && totalElapsed < 0) {

          console.error('⚠️ [TimerCard] Negative elapsed time detected!', {

      if (onSessionComplete) {      startTime,

        onSessionComplete(finalSession);      now, // 使用最新的时间戳

      }      currentTime, // state 中的时间戳（可能过时）

    }      elapsedTime,

  };      diff: now - startTime, // 使用最新时间计算

      totalElapsed,

  const formatTime = (seconds: number): string => {      startTimeDate: startTime ? new Date(startTime).toISOString() : 'null',

    const hours = Math.floor(seconds / 3600);      nowDate: new Date(now).toISOString()

    const minutes = Math.floor((seconds % 3600) / 60);    });

    const secs = seconds % 60;  }

      

    if (hours > 0) {  const totalSeconds = Math.floor(totalElapsed / 1000);

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;  const minutes = Math.floor(totalSeconds / 60);

    }  const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;  

  };  // 检测整分钟，触发脉冲效果

  useEffect(() => {

  return (    if (isRunning && seconds === 0 && minutes > 0) {

    <div className={`timer-card ${className}`}>      setIsPulsing(true);

      <div className="timer-card-header">      const timeout = setTimeout(() => setIsPulsing(false), 600);

        <h3>计时器</h3>      return () => clearTimeout(timeout);

      </div>    }

        }, [seconds, minutes, isRunning]);

      <div className="timer-display">  

        <span className="time-text">{formatTime(elapsedTime)}</span>  // 格式化显示时间

      </div>  const formatTime = () => {

    const hours = Math.floor(minutes / 60);

      <div className="timer-description">    const mins = minutes % 60;

        <input    

          type="text"    if (hours > 0) {

          placeholder="输入活动描述..."      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

          value={description}    }

          onChange={(e) => setDescription(e.target.value)}    return `${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

          disabled={isRunning}  };

          className="description-input"  

        />  // 格式化开始时间

      </div>  const formatStartTime = () => {

    if (!startTime) return '--:--';

      <div className="timer-controls">    const date = new Date(startTime);

        {!isRunning ? (    const hours = date.getHours().toString().padStart(2, '0');

          <button     const mins = date.getMinutes().toString().padStart(2, '0');

            onClick={startTimer}    return `${hours}:${mins}`;

            className="timer-btn start-btn"  };

            disabled={!description.trim()}  

          >  // 显示的emoji和标题

            开始计时  const displayEmoji = eventEmoji || tagEmoji || '⏱️';

          </button>  const displayTitle = eventTitle || tagName || '点击选择任务';

        ) : (  const displayTagPath = tagPath || '未选择标签';

          <button   

            onClick={stopTimer}  return (

            className="timer-btn stop-btn"    <div className="timer-card">

          >      {/* Emoji图标 - 在标题上方 */}

            停止计时      <div className="timer-emoji" onClick={onEdit} title="点击修改表情">

          </button>        {displayEmoji}

        )}      </div>

      </div>      

      {/* 标题 */}

      {currentSession && (      <div className="timer-title" onClick={onEdit} title="点击编辑事件">

        <div className="current-session-info">        {displayTitle}

          <p className="session-description">{currentSession.description}</p>      </div>

          <p className="session-start-time">      

            开始时间: {currentSession.startTime.toLocaleTimeString()}      {/* 标签路径 */}

          </p>      <div 

        </div>        className="timer-tags" 

      )}        onClick={onEdit} 

    </div>        title="点击编辑标签"

  );        style={{ color: tagColor || '#666' }}

};      >
        {displayTagPath}
      </div>
      
      {/* 按钮组 */}
      {isIdle ? (
        // 初始状态：只显示开始按钮
        <div className="timer-buttons">
          <button 
            className="timer-btn start-btn" 
            onClick={onStart}
            title="开始计时"
          >
            <img src={icons.timerColor} alt="开始" />
          </button>
        </div>
      ) : (
        // 计时中：显示暂停、停止、取消按钮
        <div className="timer-buttons">
          <button 
            className="timer-btn pause-btn" 
            onClick={onPause}
            title={isRunning ? "暂停" : "继续"}
          >
            <img src={icons.pause} alt="暂停" />
          </button>
          <button 
            className="timer-btn stop-btn" 
            onClick={onStop}
            title="停止并保存"
          >
            <img src={icons.stop} alt="停止" />
          </button>
          <button 
            className="timer-btn cancel-btn" 
            onClick={onCancel}
            title="取消计时"
          >
            <img src={icons.cancel} alt="取消" />
          </button>
        </div>
      )}
      
      {/* 计时时间 */}
      <div className={`timer-display ${isPulsing ? 'pulse' : ''}`}>
        {formatTime()}
      </div>
      
      {/* 开始时间 - 点击打开编辑modal */}
      <div className="timer-start" onClick={onEdit} title="点击编辑开始时间">
        {isIdle ? '准备开始' : `开始时间 ${formatStartTime()}`}
      </div>
    </div>
  );
};

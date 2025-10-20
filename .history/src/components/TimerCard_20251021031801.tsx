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
};  return (

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

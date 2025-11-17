/**
 * AttendeeFeatureDemo - 参会人功能演示
 * 
 * 演示：
 * 1. AttendeeDisplay 组件的使用
 * 2. 多来源搜索功能
 * 3. 悬浮预览卡片
 * 4. 完整编辑 Modal
 * 5. 键盘导航
 */

import React, { useState } from 'react';
import { Event, Contact } from '../../types';
import { AttendeeDisplay } from '../common/AttendeeDisplay';
import './AttendeeFeatureDemo.css';

export const AttendeeFeatureDemo: React.FC = () => {
  const [demoEvent, setDemoEvent] = useState<Event>({
    id: 'demo-event-001',
    simpleTitle: '产品设计评审会',
    startTime: '2025-01-15T14:00:00',
    endTime: '2025-01-15T16:00:00',
    organizer: {
      id: 'organizer-001',
      name: '张伟',
      email: 'zhang.wei@company.com',
      organization: '产品部',
      position: '产品总监',
      isOutlook: true,
    },
    attendees: [
      {
        id: 'attendee-001',
        name: '李娜',
        email: 'li.na@company.com',
        organization: '设计部',
        position: '首席设计师',
        isGoogle: true,
      },
      {
        id: 'attendee-002',
        name: '王强',
        email: 'wang.qiang@company.com',
        organization: '研发部',
        position: '技术经理',
        isReMarkable: true,
      },
      {
        id: 'attendee-003',
        name: '赵敏',
        organization: '市场部',
        notes: '历史参会人，没有邮箱信息',
      },
    ],
  });

  const handleAttendeesChange = (attendees: Contact[], organizer?: Contact) => {
    console.log('[AttendeeFeatureDemo] Attendees changed:', { attendees, organizer });
    
    setDemoEvent(prev => ({
      ...prev,
      organizer,
      attendees,
    }));
  };

  return (
    <div className="attendee-feature-demo">
      <div className="demo-container">
        <h1>参会人功能演示</h1>
        
        {/* 功能说明 */}
        <div className="demo-section">
          <h2>功能说明</h2>
          <ul className="feature-list">
            <li>
              <strong>发起人显示</strong>：第一个参会人为发起人，显示为 <em><strong><u>斜体 + 加粗 + 下划线</u></strong></em>
            </li>
            <li>
              <strong>有邮箱参会人</strong>：显示为 <u>下划线</u>
            </li>
            <li>
              <strong>悬浮预览</strong>：鼠标悬浮 1 秒后显示联系人详细信息卡片
            </li>
            <li>
              <strong>点击搜索</strong>：点击任意参会人名字，展开多来源搜索下拉框
            </li>
            <li>
              <strong>键盘导航</strong>：搜索框中支持 ↑↓ 选择、Enter 确认、Esc 取消
            </li>
            <li>
              <strong>内联编辑</strong>：在预览卡片中点击字段即可编辑
            </li>
            <li>
              <strong>完整编辑</strong>：点击"展开"按钮打开完整编辑 Modal
            </li>
          </ul>
        </div>

        {/* 演示事件 */}
        <div className="demo-section">
          <h2>演示事件</h2>
          <div className="event-card">
            <h3>{demoEvent.simpleTitle}</h3>
            <p className="event-time">
              {new Date(demoEvent.startTime!).toLocaleString('zh-CN')} - 
              {new Date(demoEvent.endTime!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </p>
            
            {/* 参会人组件 */}
            <AttendeeDisplay
              event={demoEvent}
              currentUserEmail="current.user@company.com"
              onChange={handleAttendeesChange}
            />
          </div>
        </div>

        {/* 使用指南 */}
        <div className="demo-section">
          <h2>使用指南</h2>
          <ol className="usage-guide">
            <li>
              <strong>查看参会人信息</strong>
              <p>将鼠标悬浮在任意参会人名字上，等待 1 秒后会显示详细信息卡片</p>
            </li>
            <li>
              <strong>快速编辑字段</strong>
              <p>在悬浮卡片中，点击任意字段可以直接编辑，按 Enter 保存或 Esc 取消</p>
            </li>
            <li>
              <strong>更换参会人</strong>
              <p>点击参会人名字，打开搜索框，输入关键词搜索联系人（支持搜索 Outlook、Google、iCloud、本地联系人和历史参会人）</p>
            </li>
            <li>
              <strong>键盘快捷操作</strong>
              <p>在搜索框中：↑↓ 移动选择、Enter 确认选择、Esc 关闭搜索</p>
            </li>
            <li>
              <strong>查看关联事件</strong>
              <p>悬浮卡片中会显示该联系人最近 5 个关联事件，点击"查看全部"可在完整编辑 Modal 中查看所有事件</p>
            </li>
          </ol>
        </div>

        {/* 数据来源说明 */}
        <div className="demo-section">
          <h2>数据来源说明</h2>
          <div className="source-legend">
            <div className="source-item">
              <span className="source-tag outlook">Outlook</span>
              <span>从 Microsoft Outlook 同步的联系人</span>
            </div>
            <div className="source-item">
              <span className="source-tag google">Google</span>
              <span>从 Google Contacts 同步的联系人</span>
            </div>
            <div className="source-item">
              <span className="source-tag icloud">iCloud</span>
              <span>从 Apple iCloud 同步的联系人</span>
            </div>
            <div className="source-item">
              <span className="source-tag remarkable">ReMarkable</span>
              <span>在 ReMarkable 中手动创建的联系人</span>
            </div>
            <div className="source-item">
              <span className="source-tag default">历史参会人</span>
              <span>从历史事件中提取的参会人（未同步到联系人库）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

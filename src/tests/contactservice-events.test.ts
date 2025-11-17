/**
 * ContactService 事件机制测试
 * 验证 Phase 1 实现
 */

import { ContactService } from '../services/ContactService';
import { EventService } from '../services/EventService';

// 清空 localStorage
beforeEach(() => {
  localStorage.clear();
});

describe('ContactService Event Mechanism (Phase 1)', () => {
  it('应该在创建联系人时触发 contact.created 事件', () => {
    const listener = jest.fn();
    ContactService.addEventListener('contact.created', listener);
    
    const contact = ContactService.addContact({
      name: '张三',
      email: 'zhangsan@example.com',
    });
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'contact.created',
        data: expect.objectContaining({
          contact: expect.objectContaining({
            name: '张三',
            email: 'zhangsan@example.com',
          })
        })
      })
    );
  });

  it('应该在更新联系人时触发 contact.updated 事件', () => {
    const listener = jest.fn();
    
    // 先创建联系人
    const contact = ContactService.addContact({
      name: '张三',
      email: 'zhangsan@example.com',
    });
    
    // 订阅更新事件
    ContactService.addEventListener('contact.updated', listener);
    
    // 更新联系人
    ContactService.updateContact(contact.id!, {
      phone: '13800138000',
    });
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'contact.updated',
        data: expect.objectContaining({
          id: contact.id,
          before: expect.objectContaining({
            name: '张三',
            phone: undefined,
          }),
          after: expect.objectContaining({
            name: '张三',
            phone: '13800138000',
          })
        })
      })
    );
  });

  it('应该在删除联系人时触发 contact.deleted 事件', () => {
    const listener = jest.fn();
    
    // 先创建联系人
    const contact = ContactService.addContact({
      name: '张三',
      email: 'zhangsan@example.com',
    });
    
    // 订阅删除事件
    ContactService.addEventListener('contact.deleted', listener);
    
    // 删除联系人
    ContactService.deleteContact(contact.id!);
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'contact.deleted',
        data: expect.objectContaining({
          id: contact.id,
          contact: expect.objectContaining({
            name: '张三',
          })
        })
      })
    );
  });

  it('应该支持移除事件监听器', () => {
    const listener = jest.fn();
    
    // 添加监听器
    ContactService.addEventListener('contact.created', listener);
    
    // 创建第一个联系人
    ContactService.addContact({ name: '张三' });
    expect(listener).toHaveBeenCalledTimes(1);
    
    // 移除监听器
    ContactService.removeEventListener('contact.created', listener);
    
    // 创建第二个联系人
    ContactService.addContact({ name: '李四' });
    expect(listener).toHaveBeenCalledTimes(1); // 仍然是 1 次
  });

  it('应该支持多个监听器订阅同一事件', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    ContactService.addEventListener('contact.created', listener1);
    ContactService.addEventListener('contact.created', listener2);
    
    ContactService.addContact({ name: '张三' });
    
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});

describe('EventService 订阅 ContactService 事件', () => {
  beforeEach(() => {
    // 初始化 EventService（使用 mock sync manager）
    EventService.initialize({
      recordLocalAction: jest.fn(),
    });
  });

  it('联系人更新时，应该同步到相关事件的参会人', () => {
    // 1. 创建联系人
    const contact = ContactService.addContact({
      name: '张三',
      email: 'zhangsan@example.com',
    });
    
    // 2. 创建包含该联系人的事件
    const event = EventService.createEvent({
      title: '会议',
      attendees: [contact],
    });
    
    // 3. 更新联系人
    ContactService.updateContact(contact.id!, {
      phone: '13800138000',
    });
    
    // 4. 验证事件中的联系人信息已更新
    const updatedEvent = EventService.getEventById(event.id!);
    expect(updatedEvent?.attendees?.[0].phone).toBe('13800138000');
  });

  it('联系人删除时，应该从相关事件中移除', () => {
    // 1. 创建联系人
    const contact = ContactService.addContact({
      name: '张三',
      email: 'zhangsan@example.com',
    });
    
    // 2. 创建包含该联系人的事件
    const event = EventService.createEvent({
      title: '会议',
      attendees: [contact],
    });
    
    expect(event.attendees?.length).toBe(1);
    
    // 3. 删除联系人
    ContactService.deleteContact(contact.id!);
    
    // 4. 验证事件中的参会人已被移除
    const updatedEvent = EventService.getEventById(event.id!);
    expect(updatedEvent?.attendees?.length).toBe(0);
  });

  it('联系人更新时，应该同步到相关事件的发起人', () => {
    // 1. 创建联系人
    const organizer = ContactService.addContact({
      name: '张三',
      email: 'zhangsan@example.com',
    });
    
    // 2. 创建事件（该联系人是发起人）
    const event = EventService.createEvent({
      title: '会议',
      organizer,
    });
    
    // 3. 更新联系人
    ContactService.updateContact(organizer.id!, {
      organization: '字节跳动',
    });
    
    // 4. 验证事件的发起人信息已更新
    const updatedEvent = EventService.getEventById(event.id!);
    expect(updatedEvent?.organizer?.organization).toBe('字节跳动');
  });
});

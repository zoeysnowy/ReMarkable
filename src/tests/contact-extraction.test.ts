/**
 * 联系人自动提取功能测试
 * 
 * 测试目的：验证从事件中自动提取联系人到联系人库的功能
 */

import { EventService } from '../services/EventService';
import { ContactService } from '../services/ContactService';
import { Event, Contact } from '../types';

// 初始化服务
EventService.initialize();
ContactService.initialize();

console.log('='.repeat(60));
console.log('🧪 联系人自动提取功能测试');
console.log('='.repeat(60));

// 测试 1: 创建新事件，验证联系人自动提取
console.log('\n📝 测试 1: 创建新事件，验证联系人自动提取');
console.log('-'.repeat(60));

const testEvent: Partial<Event> = {
  id: 'test-event-' + Date.now(),
  title: '产品评审会',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 3600000).toISOString(),
  organizer: {
    name: '测试组织者',
    email: 'organizer@test.com',
    organization: '产品部',
    position: '产品总监',
  },
  attendees: [
    {
      name: '测试参会人1',
      email: 'attendee1@test.com',
      organization: '设计部',
    },
    {
      name: '测试参会人2',
      email: 'attendee2@test.com',
      organization: '研发部',
    },
    {
      name: '无邮箱参会人',
      // 没有邮箱，不应该被提取
    },
  ],
};

console.log('创建测试事件:', {
  title: testEvent.title,
  organizer: testEvent.organizer?.name,
  attendees: testEvent.attendees?.map(a => a.name).join(', '),
});

// 保存事件前，检查联系人库
const contactsBeforeSave = ContactService.getAllContacts();
console.log('保存前联系人总数:', contactsBeforeSave.length);

// 保存事件（应该自动触发联系人提取）
EventService.saveEvent(testEvent as Event).then(result => {
  console.log('事件保存结果:', result.success ? '✅ 成功' : '❌ 失败');
  
  // 保存后，检查联系人库
  const contactsAfterSave = ContactService.getAllContacts();
  console.log('保存后联系人总数:', contactsAfterSave.length);
  console.log('新增联系人数:', contactsAfterSave.length - contactsBeforeSave.length);
  
  // 验证是否成功提取
  const extractedOrganizer = ContactService.getContactByEmail('organizer@test.com');
  const extractedAttendee1 = ContactService.getContactByEmail('attendee1@test.com');
  const extractedAttendee2 = ContactService.getContactByEmail('attendee2@test.com');
  
  console.log('\n验证结果:');
  console.log('组织者提取:', extractedOrganizer ? '✅ 成功' : '❌ 失败', extractedOrganizer?.name);
  console.log('参会人1提取:', extractedAttendee1 ? '✅ 成功' : '❌ 失败', extractedAttendee1?.name);
  console.log('参会人2提取:', extractedAttendee2 ? '✅ 成功' : '❌ 失败', extractedAttendee2?.name);
  
  // 测试 2: 搜索提取的联系人
  console.log('\n📝 测试 2: 搜索提取的联系人');
  console.log('-'.repeat(60));
  
  const searchResults = ContactService.searchContacts('测试');
  console.log('搜索 "测试" 的结果数:', searchResults.length);
  searchResults.forEach(contact => {
    console.log('  -', contact.name, contact.email || '(无邮箱)');
  });
  
  // 测试 3: 验证去重机制（重复保存同一事件）
  console.log('\n📝 测试 3: 验证去重机制');
  console.log('-'.repeat(60));
  
  const contactsBeforeDuplicate = ContactService.getAllContacts();
  console.log('重复保存前联系人数:', contactsBeforeDuplicate.length);
  
  // 再次保存相同的联系人
  ContactService.extractAndAddFromEvent(testEvent.organizer, testEvent.attendees);
  
  const contactsAfterDuplicate = ContactService.getAllContacts();
  console.log('重复保存后联系人数:', contactsAfterDuplicate.length);
  console.log('去重验证:', contactsBeforeDuplicate.length === contactsAfterDuplicate.length ? '✅ 成功（未重复添加）' : '❌ 失败（有重复）');
  
  // 测试 4: 更新事件的参会人
  console.log('\n📝 测试 4: 更新事件参会人');
  console.log('-'.repeat(60));
  
  const updatedAttendees: Contact[] = [
    ...testEvent.attendees!,
    {
      name: '新增参会人',
      email: 'new-attendee@test.com',
      organization: '市场部',
    },
  ];
  
  const contactsBeforeUpdate = ContactService.getAllContacts();
  console.log('更新前联系人数:', contactsBeforeUpdate.length);
  
  EventService.updateEvent(testEvent.id!, {
    attendees: updatedAttendees,
  }).then(updateResult => {
    console.log('事件更新结果:', updateResult.success ? '✅ 成功' : '❌ 失败');
    
    const contactsAfterUpdate = ContactService.getAllContacts();
    console.log('更新后联系人数:', contactsAfterUpdate.length);
    console.log('新增联系人数:', contactsAfterUpdate.length - contactsBeforeUpdate.length);
    
    const newAttendee = ContactService.getContactByEmail('new-attendee@test.com');
    console.log('新增参会人提取:', newAttendee ? '✅ 成功' : '❌ 失败', newAttendee?.name);
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));
    console.log('最终联系人库状态:');
    console.log('  - 总联系人数:', ContactService.getAllContacts().length);
    console.log('  - 4DNote 联系人数:', ContactService.searchLocalContacts('').length);
    console.log('');
    console.log('✅ 所有测试完成！');
    console.log('');
    console.log('💡 提示: 可在浏览器控制台执行以下命令查看详细数据:');
    console.log('  JSON.parse(localStorage.getItem("4dnote-contacts"))');
  });
});

// 导出测试函数，可在浏览器控制台调用
(window as any).testContactExtraction = () => {
  console.clear();
  // 重新执行测试
  location.reload();
};

console.log('\n💡 在浏览器控制台执行 testContactExtraction() 可重新运行测试');

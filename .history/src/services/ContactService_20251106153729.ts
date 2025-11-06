/**
 * ContactService - 联系人管理服务
 * 
 * 功能：
 * - 统一管理 ReMarkable 本地联系人和各云平台联系人
 * - 支持联系人的增删改查
 * - 提供联系人搜索和过滤功能
 * - 支持头像管理（Gravatar 集成）
 */

import { Contact, ContactSource } from '../types';
import md5 from 'crypto-js/md5';

const STORAGE_KEY = 'remarkable-contacts';

export class ContactService {
  private static contacts: Contact[] = [];
  private static initialized = false;

  /**
   * 初始化联系人服务
   */
  static initialize(): void {
    if (this.initialized) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.contacts = JSON.parse(stored);
      }
      this.initialized = true;
      console.log('[ContactService] Initialized with', this.contacts.length, 'contacts');
    } catch (error) {
      console.error('[ContactService] Failed to initialize:', error);
      this.contacts = [];
    }
  }

  /**
   * 保存联系人到本地存储
   */
  private static save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.contacts));
    } catch (error) {
      console.error('[ContactService] Failed to save contacts:', error);
    }
  }

  /**
   * 获取所有联系人
   */
  static getAllContacts(): Contact[] {
    this.initialize();
    return [...this.contacts];
  }

  /**
   * 根据 ID 获取联系人
   */
  static getContactById(id: string): Contact | undefined {
    this.initialize();
    return this.contacts.find(c => c.id === id);
  }

  /**
   * 根据邮箱获取联系人
   */
  static getContactByEmail(email: string): Contact | undefined {
    this.initialize();
    return this.contacts.find(c => c.email?.toLowerCase() === email.toLowerCase());
  }

  /**
   * 搜索联系人
   * @param query 搜索关键词（匹配姓名、邮箱、组织）
   * @param source 筛选平台来源
   */
  static searchContacts(query: string, source?: ContactSource): Contact[] {
    this.initialize();
    
    const lowerQuery = query.toLowerCase();
    let results = this.contacts.filter(contact => {
      const matchesQuery = 
        contact.name?.toLowerCase().includes(lowerQuery) ||
        contact.email?.toLowerCase().includes(lowerQuery) ||
        contact.organization?.toLowerCase().includes(lowerQuery);
      
      if (!matchesQuery) return false;

      // 平台来源过滤
      if (source) {
        switch (source) {
          case 'remarkable':
            return contact.isReMarkable === true;
          case 'outlook':
            return contact.isOutlook === true;
          case 'google':
            return contact.isGoogle === true;
          case 'icloud':
            return contact.isiCloud === true;
        }
      }

      return true;
    });

    return results;
  }

  /**
   * 添加联系人
   */
  static addContact(contact: Omit<Contact, 'id'>): Contact {
    this.initialize();
    
    const newContact: Contact = {
      ...contact,
      id: this.generateContactId(),
    };

    // 设置头像（如果有邮箱但没有头像）
    if (newContact.email && !newContact.avatarUrl) {
      newContact.avatarUrl = this.getGravatarUrl(newContact.email);
    }

    this.contacts.push(newContact);
    this.save();
    
    console.log('[ContactService] Added contact:', newContact.name);
    return newContact;
  }

  /**
   * 批量添加联系人
   */
  static addContacts(contacts: Omit<Contact, 'id'>[]): Contact[] {
    this.initialize();
    
    const newContacts = contacts.map(contact => {
      const newContact: Contact = {
        ...contact,
        id: this.generateContactId(),
      };

      if (newContact.email && !newContact.avatarUrl) {
        newContact.avatarUrl = this.getGravatarUrl(newContact.email);
      }

      return newContact;
    });

    this.contacts.push(...newContacts);
    this.save();
    
    console.log('[ContactService] Added', newContacts.length, 'contacts');
    return newContacts;
  }

  /**
   * 更新联系人
   */
  static updateContact(id: string, updates: Partial<Contact>): Contact | null {
    this.initialize();
    
    const index = this.contacts.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.contacts[index] = { ...this.contacts[index], ...updates };
    
    // 更新头像
    if (updates.email && !updates.avatarUrl) {
      this.contacts[index].avatarUrl = this.getGravatarUrl(updates.email);
    }

    this.save();
    console.log('[ContactService] Updated contact:', this.contacts[index].name);
    return this.contacts[index];
  }

  /**
   * 删除联系人
   */
  static deleteContact(id: string): boolean {
    this.initialize();
    
    const index = this.contacts.findIndex(c => c.id === id);
    if (index === -1) return false;

    const deleted = this.contacts.splice(index, 1)[0];
    this.save();
    
    console.log('[ContactService] Deleted contact:', deleted.name);
    return true;
  }

  /**
   * 从 Event 的 organizer/attendees 中提取联系人并自动添加到联系人列表
   */
  static extractAndAddFromEvent(organizer?: Contact, attendees?: Contact[]): void {
    this.initialize();
    
    const contactsToAdd: Contact[] = [];

    // 提取组织者
    if (organizer && organizer.email) {
      const existing = this.getContactByEmail(organizer.email);
      if (!existing) {
        contactsToAdd.push({ ...organizer, isReMarkable: true });
      }
    }

    // 提取参会人
    if (attendees) {
      attendees.forEach(attendee => {
        if (attendee.email) {
          const existing = this.getContactByEmail(attendee.email);
          if (!existing) {
            contactsToAdd.push({ ...attendee, isReMarkable: true });
          }
        }
      });
    }

    if (contactsToAdd.length > 0) {
      this.addContacts(contactsToAdd);
    }
  }

  /**
   * 生成联系人 ID
   */
  private static generateContactId(): string {
    return `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取 Gravatar 头像 URL
   * @param email 邮箱地址
   * @param size 头像尺寸（默认 200）
   */
  static getGravatarUrl(email: string, size: number = 200): string {
    const hash = md5(email.toLowerCase().trim()).toString();
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
  }

  /**
   * 获取联系人头像 URL
   * 优先级：自定义头像 > Gravatar > 默认头像
   */
  static getAvatarUrl(contact: Contact): string {
    if (contact.avatarUrl) {
      return contact.avatarUrl;
    }
    
    if (contact.email) {
      return this.getGravatarUrl(contact.email);
    }

    // 返回默认头像（使用首字母）
    const initial = contact.name?.charAt(0).toUpperCase() || '?';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&size=200&background=random`;
  }

  /**
   * 获取平台来源显示文本
   */
  static getSourceLabel(contact: Contact): string {
    if (contact.isReMarkable) return 'ReMarkable';
    if (contact.isOutlook) return 'Outlook';
    if (contact.isGoogle) return 'Google';
    if (contact.isiCloud) return 'iCloud';
    return '未知';
  }

  /**
   * 导出联系人为 JSON
   */
  static exportContacts(): string {
    this.initialize();
    return JSON.stringify(this.contacts, null, 2);
  }

  /**
   * 从 JSON 导入联系人
   */
  static importContacts(json: string): number {
    try {
      const imported = JSON.parse(json) as Contact[];
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array');
      }

      const added = this.addContacts(imported);
      return added.length;
    } catch (error) {
      console.error('[ContactService] Failed to import contacts:', error);
      throw error;
    }
  }
}

// 自动初始化
ContactService.initialize();

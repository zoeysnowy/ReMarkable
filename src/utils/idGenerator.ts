/**
 * ID 生成器 - 使用 nanoid 生成全局唯一 ID
 * 
 * 特性：
 * - URL 安全（无特殊字符）
 * - 短小精悍（16 字符 vs UUID 的 36 字符）
 * - 全局唯一（碰撞概率极低，类似 UUID）
 * - 多设备离线创建安全（无需服务器协调）
 * 
 * @version 1.0.0
 * @date 2025-12-02
 */

import { nanoid } from 'nanoid';

/**
 * 生成事件 ID
 * 格式: event_V1StGXR8_Z5jdHi6B-JnuZ4
 * 长度: 6 (前缀) + 21 (nanoid) = 27 字符
 */
export function generateEventId(): string {
  return `event_${nanoid(21)}`;
}

/**
 * 生成标签 ID
 * 格式: tag_V1StGXR8_Z5jdHi6B-JnuZ4
 * 长度: 4 (前缀) + 21 (nanoid) = 25 字符
 */
export function generateTagId(): string {
  return `tag_${nanoid(21)}`;
}

/**
 * 生成联系人 ID
 * 格式: contact_V1StGXR8_Z5jdHi6B-JnuZ4
 * 长度: 8 (前缀) + 21 (nanoid) = 29 字符
 */
export function generateContactId(): string {
  return `contact_${nanoid(21)}`;
}

/**
 * 生成附件 ID
 * 格式: attach_V1StGXR8_Z5jdHi6B-JnuZ4
 * 长度: 7 (前缀) + 21 (nanoid) = 28 字符
 */
export function generateAttachmentId(): string {
  return `attach_${nanoid(21)}`;
}

/**
 * 生成用户 ID
 * 格式: user_V1StGXR8_Z5jdHi6B-JnuZ4
 * 长度: 5 (前缀) + 21 (nanoid) = 26 字符
 */
export function generateUserId(): string {
  return `user_${nanoid(21)}`;
}

/**
 * 生成通用 ID（用于未分类的实体）
 * 格式: V1StGXR8_Z5jdHi6B-JnuZ4
 * 长度: 21 字符
 */
export function generateId(): string {
  return nanoid(21);
}

/**
 * 验证 ID 格式是否有效
 * @param id 待验证的 ID
 * @param type 可选：验证特定类型的 ID（如 'event', 'tag'）
 */
export function isValidId(id: string, type?: 'event' | 'tag' | 'contact' | 'attach' | 'user'): boolean {
  if (!id || typeof id !== 'string') return false;
  
  // 如果指定了类型，验证前缀
  if (type) {
    const prefixMap = {
      event: 'event_',
      tag: 'tag_',
      contact: 'contact_',
      attach: 'attach_',
      user: 'user_',
    };
    
    const prefix = prefixMap[type];
    if (!id.startsWith(prefix)) return false;
    
    // 验证 nanoid 部分长度
    const nanoidPart = id.slice(prefix.length);
    return nanoidPart.length === 21 && /^[A-Za-z0-9_-]+$/.test(nanoidPart);
  }
  
  // 通用验证：至少 10 字符，只包含字母数字和 _-
  return id.length >= 10 && /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * 从旧格式 ID 迁移到新格式
 * 用于数据迁移场景
 * 
 * @example
 * migrateId('event_1733126400000') -> 'event_V1StGXR8_Z5jdHi6B-JnuZ4'
 */
export function migrateId(oldId: string, type: 'event' | 'tag' | 'contact' | 'attach' | 'user'): string {
  // 如果已经是新格式，直接返回
  if (isValidId(oldId, type)) {
    return oldId;
  }
  
  // 生成新 ID
  const generators = {
    event: generateEventId,
    tag: generateTagId,
    contact: generateContactId,
    attach: generateAttachmentId,
    user: generateUserId,
  };
  
  return generators[type]();
}

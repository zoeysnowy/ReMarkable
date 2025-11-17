# 🔧 联系人搜索功能快速测试指南

## 问题诊断

根据您的截图，搜索框显示"无搜索结果"，这说明联系人库是空的。

---

## ✅ 已修复

刚刚修复了关键问题：

1. **EventEditModalV2Demo 现在会自动提取联系人**
   - 组件挂载时，自动提取演示数据中的联系人（Zoey Gong, Jenny Wong, Cindy Cai）
   - 每次修改参会人时，立即提取到联系人库

2. **不再需要保存事件**
   - 直接在 onChange 回调中提取联系人
   - 实时更新联系人库

---

## 🧪 立即测试（3步验证）

### 步骤 1: 刷新页面

**强制刷新**（清除缓存）：
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### 步骤 2: 打开控制台，检查初始化日志

按 `F12` 打开控制台，应该看到：

```
[EventEditModalV2Demo] 初始化：手动提取演示联系人
[ContactService] Added contact: Zoey Gong
[ContactService] Added contact: Jenny Wong  
[ContactService] Added contact: Cindy Cai
```

如果看到这些日志，说明联系人已成功添加！

### 步骤 3: 测试搜索

1. **点击任意参会人名字**（例如 "Zoey Gong"）
2. **搜索框应该打开**
3. **输入 "Zoey"**
4. **应该能看到 "Zoey Gong" 出现在搜索结果中**

---

## 🔍 浏览器控制台验证命令

### 查看所有联系人

在控制台执行：

```javascript
// 查看联系人库
const contacts = JSON.parse(localStorage.getItem('remarkable-contacts') || '[]');
console.log('联系人总数:', contacts.length);
console.table(contacts.map(c => ({
  姓名: c.name,
  邮箱: c.email,
  公司: c.organization,
  来源: c.isOutlook ? 'Outlook' : c.isGoogle ? 'Google' : c.isReMarkable ? 'ReMarkable' : '未知'
})));
```

**预期结果**：应该看到至少 3 个联系人（Zoey Gong, Jenny Wong, Cindy Cai）

### 测试搜索功能

```javascript
// 搜索 "Zoey"
const results = JSON.parse(localStorage.getItem('remarkable-contacts') || '[]')
  .filter(c => c.name?.includes('Zoey') || c.email?.includes('Zoey'));
console.log('搜索结果:', results);
```

### 手动添加测试联系人

如果还是没有联系人，可以手动添加一个：

```javascript
const contacts = JSON.parse(localStorage.getItem('remarkable-contacts') || '[]');
contacts.push({
  id: 'test-' + Date.now(),
  name: 'Test User',
  email: 'test@example.com',
  organization: 'Test Company',
  isReMarkable: true
});
localStorage.setItem('remarkable-contacts', JSON.stringify(contacts));
console.log('✅ 已添加测试联系人');
location.reload();
```

---

## 🐛 如果还是不行

### 问题 1: 控制台没有初始化日志

**可能原因**：
- 页面缓存未清除
- ContactService 未正确导入

**解决方案**：
```javascript
// 在控制台强制提取联系人
const testData = {
  organizer: {
    name: 'Zoey Gong',
    email: 'zoey.gong@company.com',
    organization: '产品部'
  },
  attendees: [
    { name: 'Jenny Wong', email: 'jenny.wong@company.com' },
    { name: 'Cindy Cai', email: 'cindy.cai@company.com' }
  ]
};

// 需要先确保在实际页面中执行（不是这个 markdown）
// window.ContactService.extractAndAddFromEvent(testData.organizer, testData.attendees);
```

### 问题 2: 有联系人但搜索不到

**检查 AttendeeDisplay 的搜索逻辑**：

在控制台执行调试脚本：
```javascript
// 加载调试脚本
const script = document.createElement('script');
script.src = '/src/utils/debug-contacts.js';
document.body.appendChild(script);
```

### 问题 3: 清空重来

```javascript
// 清空所有数据，重新开始
localStorage.removeItem('remarkable-contacts');
localStorage.removeItem('remarkable-events');
console.log('✅ 已清空所有数据');
location.reload();
```

---

## 📊 预期行为（修复后）

### 页面加载时

1. ✅ 自动提取演示数据中的 3 个联系人
2. ✅ 控制台输出提取日志
3. ✅ 联系人保存到 localStorage

### 点击参会人搜索时

1. ✅ 搜索框打开
2. ✅ 输入 "Zoey" 能搜索到 "Zoey Gong"
3. ✅ 输入 "Jenny" 能搜索到 "Jenny Wong"
4. ✅ 输入 "Cindy" 能搜索到 "Cindy Cai"

### 鼠标悬浮参会人时

1. ✅ 1 秒后显示悬浮卡片
2. ✅ 显示联系人详细信息
3. ✅ 字段可点击编辑

---

## 🎯 核心修改说明

**Before** (问题代码):
```typescript
// 只更新本地状态，不保存到联系人库
onChange={(attendees, organizer) => {
  setFormData(prev => ({ ...prev, attendees, organizer }));
}}
```

**After** (修复后):
```typescript
// 更新状态 + 立即保存到联系人库
onChange={(attendees, organizer) => {
  setFormData(prev => ({ ...prev, attendees, organizer }));
  
  // ✨ 立即提取并保存联系人
  ContactService.extractAndAddFromEvent(organizer, attendees);
  console.log('✅ 已自动提取联系人到联系人库');
}}
```

**额外添加** (组件挂载时):
```typescript
useEffect(() => {
  // 初始化时提取演示数据的联系人
  ContactService.extractAndAddFromEvent(formData.organizer, formData.attendees);
}, []);
```

---

## ✅ 现在请测试

1. **刷新页面** (Ctrl+Shift+R)
2. **打开控制台** (F12)
3. **查看是否有初始化日志**
4. **点击任意参会人**
5. **在搜索框输入 "Zoey"**
6. **应该能看到搜索结果了！** 🎉

如果还有问题，请截图控制台的日志，我可以进一步诊断！

/**
 * TagService 性能测试脚本
 * 用法：在浏览器控制台运行此脚本
 */

console.group('🔍 TagService 性能测试');

// 测试 1: getTags() 引用稳定性
console.log('\n📊 测试 1: getTags() 引用稳定性');
const tags1 = window.TagService.getTags();
const tags2 = window.TagService.getTags();
const isStable = tags1 === tags2;
console.log('引用稳定:', isStable ? '✅ 通过' : '❌ 失败');
console.log('第一次调用:', tags1);
console.log('第二次调用:', tags2);

// 测试 2: getFlatTags() 引用稳定性
console.log('\n📊 测试 2: getFlatTags() 引用稳定性');
const flatTags1 = window.TagService.getFlatTags();
const flatTags2 = window.TagService.getFlatTags();
const isFlatStable = flatTags1 === flatTags2;
console.log('引用稳定:', isFlatStable ? '✅ 通过' : '❌ 失败');
console.log('第一次调用:', flatTags1);
console.log('第二次调用:', flatTags2);

// 测试 3: level 字段正确性
console.log('\n📊 测试 3: level 字段正确性');
const flatTags = window.TagService.getFlatTags();
const hasInvalidLevel = flatTags.some(tag => tag.parentId && tag.level === 0);
console.log('level 字段正确:', hasInvalidLevel ? '❌ 失败（存在 parentId 但 level=0）' : '✅ 通过');
console.table(flatTags.map(tag => ({
  name: tag.name,
  parentId: tag.parentId || '无',
  level: tag.level,
  valid: !tag.parentId || tag.level > 0 ? '✅' : '❌'
})));

// 测试 4: flattenTags() 性能
console.log('\n📊 测试 4: flattenTags() 性能');
const hierarchicalTags = window.TagService.getTags();
const iterations = 100;
console.time(`flattenTags() ${iterations}次平均`);
for (let i = 0; i < iterations; i++) {
  // 访问私有方法需要特殊处理，这里只测试公开方法
  window.TagService.getFlatTags();
}
console.timeEnd(`flattenTags() ${iterations}次平均`);

// 测试 5: 初始化状态
console.log('\n📊 测试 5: 初始化状态');
console.log('标签总数:', flatTags.length);
console.log('根级标签:', flatTags.filter(t => !t.parentId).length);
console.log('子级标签:', flatTags.filter(t => t.parentId).length);

console.groupEnd();

console.log('\n✅ 所有测试完成！');
console.log('如果看到警告 "⚠️ [TagService] getFlatTags() 被频繁调用"，说明测试 4 触发了监控（正常）');

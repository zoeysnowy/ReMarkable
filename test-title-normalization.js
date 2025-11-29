/**
 * Test Title Normalization with Tag elements
 * Tests bidirectional conversion: fulltitle ↔ colorTitle/simpleTitle
 */

console.log('🧪 Title Normalization Test - Tag Element Handling\n');

// Test 1: fulltitle with Tags → colorTitle/simpleTitle (Tags stripped)
console.log('📝 Test 1: fulltitle with Tags → colorTitle/simpleTitle');
const fullTitleWithTags = JSON.stringify([
  {
    type: 'paragraph',
    children: [
      { type: 'tag', tagId: 'tag-work', tagName: 'work', tagColor: '#FF5722', children: [{ text: '' }] },
      { text: ' meeting with ' },
      { type: 'tag', tagId: 'tag-team', tagName: 'team', tagColor: '#4CAF50', children: [{ text: '' }] }
    ]
  }
]);

console.log('Input fulltitle:', fullTitleWithTags);
console.log('Expected colorTitle: " meeting with " (Tags stripped)');
console.log('Expected simpleTitle: " meeting with "');
console.log('');

// Test 2: simpleTitle with #hashtags → fulltitle (Tags created)
console.log('📝 Test 2: simpleTitle with #hashtags → fulltitle');
const simpleTitleWithHashtags = '#work meeting with #team';

console.log('Input simpleTitle:', simpleTitleWithHashtags);
console.log('Expected fulltitle: Contains Tag nodes for #work and #team');
console.log('Expected structure:');
console.log(JSON.stringify([
  {
    type: 'paragraph',
    children: [
      { type: 'tag', tagName: 'work', children: [{ text: '' }] },
      { text: ' meeting with ' },
      { type: 'tag', tagName: 'team', children: [{ text: '' }] }
    ]
  }
], null, 2));
console.log('');

// Test 3: Round-trip conversion
console.log('📝 Test 3: Round-trip conversion');
console.log('simpleTitle "#project update" → fulltitle (Tag created) → colorTitle (Tag stripped) → should equal " update"');
console.log('');

console.log('✅ To test in browser console:');
console.log(`
// Test creating event with hashtags in simpleTitle
const testEvent = {
  id: 'test-tag-' + Date.now(),
  title: { simpleTitle: '#work meeting with #team' }
};

// This will trigger normalizeTitle() which should:
// 1. Detect simpleTitle only
// 2. Generate fullTitle with Tag nodes
// 3. Generate colorTitle without Tags (plain text)
EventService.addEvent(testEvent).then(() => {
  const event = EventService.getEventById(testEvent.id);
  console.log('Event title:', event.title);
  console.log('fulltitle:', event.title.fullTitle);
  console.log('colorTitle:', event.title.colorTitle);
  console.log('simpleTitle:', event.title.simpleTitle);
});
`);

console.log('\n🔬 To manually test in PlanManager:');
console.log('1. Create new event with title: #work meeting #urgent');
console.log('2. Check that fullTitle contains Tag nodes');
console.log('3. Check that colorTitle shows "meeting" (Tags stripped)');
console.log('4. Check that simpleTitle shows "#work meeting #urgent"');

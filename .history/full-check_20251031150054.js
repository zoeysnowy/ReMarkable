const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

console.log('Scanning entire file for encoding issues...\n');

let issuesFound = 0;

lines.forEach((line, index) => {
  const lineNum = index + 1;
  const chars = [...line];
  
  chars.forEach((c, pos) => {
    const code = c.charCodeAt(0);
    
    // Check for replacement character or other problematic codes
    if (code === 0xFFFD || (code >= 0xDC80 && code <= 0xDCFF)) {
      console.log(`⚠️  Line ${lineNum}, Position ${pos}: Bad char '${c}' (U+${code.toString(16)})`);
      console.log(`    Context: ${line.substring(Math.max(0, pos - 10), Math.min(line.length, pos + 10))}`);
      issuesFound++;
    }
    
    // Check for smart quotes
    if (code === 8220 || code === 8221 || code === 8216 || code === 8217) {
      if (lineNum >= 1395 && lineNum <= 1405) {
        console.log(`📝 Line ${lineNum}, Position ${pos}: Smart quote '${c}' (U+${code.toString(16)})`);
        console.log(`    Context: ...${line.substring(Math.max(0, pos - 5), Math.min(line.length, pos + 15))}...`);
        issuesFound++;
      }
    }
  });
});

console.log(`\nTotal issues found: ${issuesFound}`);

if (issuesFound === 0) {
  console.log('\n✅ No encoding issues detected!');
  console.log('\nChecking for other syntax issues around line 1399...');
  
  // Print lines 1395-1405 with hex dump
  for (let i = 1395; i <= 1405; i++) {
    const line = lines[i - 1];
    console.log(`\nLine ${i}:`);
    console.log(`  Text: ${line}`);
    console.log(`  Hex:  ${Buffer.from(line, 'utf8').toString('hex').match(/.{1,2}/g).join(' ')}`);
  }
}

// 超详细检查 - 看看为什么行高度是0
console.log('=== 超详细月视图检查 ===');

const monthView = document.querySelector('.toastui-calendar-month');
if (!monthView) {
  console.error('❌ 月视图不存在！');
} else {
  console.log('✓ 月视图存在');
  
  // 1. 检查 month-body
  const body = monthView.querySelector('.toastui-calendar-month-body');
  if (body) {
    const rect = body.getBoundingClientRect();
    const styles = window.getComputedStyle(body);
    console.log('\n📦 month-body:', {
      高度: rect.height.toFixed(1) + 'px',
      宽度: rect.width.toFixed(1) + 'px',
      CSS: {
        height: styles.height,
        display: styles.display,
        flex: styles.flex,
        flexDirection: styles.flexDirection
      }
    });
  }
  
  // 2. 检查 daygrid
  const daygrid = monthView.querySelector('.toastui-calendar-month-daygrid');
  if (daygrid) {
    const rect = daygrid.getBoundingClientRect();
    const styles = window.getComputedStyle(daygrid);
    console.log('\n📦 daygrid:', {
      高度: rect.height.toFixed(1) + 'px',
      CSS: {
        height: styles.height,
        flex: styles.flex,
        display: styles.display,
        minHeight: styles.minHeight
      }
    });
    
    // 3. 检查 daygrid-layout
    const layout = daygrid.querySelector('.toastui-calendar-month-daygrid-layout');
    if (layout) {
      const layoutRect = layout.getBoundingClientRect();
      const layoutStyles = window.getComputedStyle(layout);
      console.log('\n📦 daygrid-layout:', {
        高度: layoutRect.height.toFixed(1) + 'px',
        CSS: {
          height: layoutStyles.height,
          flex: layoutStyles.flex,
          display: layoutStyles.display
        }
      });
      
      // 4. 检查所有的行 (daygrid-row)
      const rows = layout.querySelectorAll('.toastui-calendar-daygrid-row');
      console.log(`\n📊 找到 ${rows.length} 个日期行:`);
      rows.forEach((row, i) => {
        const rowRect = row.getBoundingClientRect();
        const rowStyles = window.getComputedStyle(row);
        console.log(`  行 ${i+1}:`, {
          高度: rowRect.height.toFixed(1) + 'px',
          CSS: {
            height: rowStyles.height,
            flex: rowStyles.flex,
            minHeight: rowStyles.minHeight,
            display: rowStyles.display
          }
        });
      });
    }
  }
}

console.log('\n=== 检查完成 ===');

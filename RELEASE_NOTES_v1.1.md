# ReMarkable v1.1 Release Notes

**Release Date:** October 20, 2025  
**Version:** 1.1.0  
**Status:** Stable Release

## 🎉 Overview

Version 1.1 brings major improvements to calendar integration and event management, with a focus on user experience, data integrity, and multi-tag support. This release addresses all critical bugs from v1.0 and introduces a powerful event editing system.

---

## ✨ Major Features

### 1. **TUI Calendar Integration**
- Full integration of TOAST UI Calendar library
- Interactive calendar view with drag-and-drop support
- Week/Month view modes
- Real-time event rendering with color-coded calendars
- Seamless synchronization with Outlook

### 2. **Enhanced Event Editor**
- **EventEditModal Component**: Custom modal for editing events
- **Multi-Tag Selection**: Choose multiple tags per event with hierarchical display
- **Tag Search**: Quick filter tags by name
- **Tag Hierarchy Visualization**: Parent tags shown with indentation
- **Click-Outside-to-Close**: Intuitive dropdown behavior
- **Time Validation**: Prevents saving invalid time formats

### 3. **Calendar Filter System**
- **CalendarSettingsPanel**: Toggle calendar visibility
- **Auto-Select-All**: First-time users see all calendars by default
- **Whitelist Mode**: Only checked calendars are displayed
- **Real-Time Updates**: Instant filter application without reload

### 4. **Event Deduplication Mechanism**
- **Inline Cleanup**: Detects and removes duplicates during migration
- **Periodic Scan**: Runs after every sync cycle
- **Smart Retention**: Keeps the event with the most recent `lastSyncTime`
- **Console Logging**: Detailed duplicate detection reports

### 5. **Multi-Format Time Parsing**
- Supports ISO 8601 with timezone: `2025-09-24T00:00:00.000Z`
- Supports ISO with offset: `2025-09-24T08:00:00+08:00`
- Supports local format: `2025-09-24 14:30:00`
- Automatic format detection
- Fallback to current time for invalid inputs

---

## 🐛 Bug Fixes

### Event Management
- ✅ **Fixed event click handler not firing** (Closure issue with stale `events` array)
  - Solution: `useCallback` with empty dependencies + direct `localStorage` read
- ✅ **Fixed TUI Calendar event binding** (Incorrect event name `'clickevent'` → `'clickEvent'`)
- ✅ **Fixed NaN:NaN time display**
  - Root cause: `Number('00.000Z')` returns `NaN`
  - Solution: Strip milliseconds before parsing: `timePart.split('.')[0]`

### Calendar Filters
- ✅ **Fixed confusing empty-array semantics**
  - Old behavior: `visibleCalendars.length === 0` meant "show all"
  - New behavior: Empty array triggers auto-select-all on first settings open
  - Result: Clearer whitelist mode (checked = visible)

### Tag Dropdown
- ✅ **Added close functionality**
  - Click outside dropdown to close (using `useRef` + `useEffect`)
  - Close button (×) in dropdown header
  - Prevents dropdown from staying open permanently

### Data Integrity
- ✅ **Fixed duplicate events during calendar migration**
  - Problem: Changing tag mapping triggered delete → create → duplicate
  - Solution: `updateLocalEventExternalId` now checks for existing `externalId`
  - Bonus: `deduplicateEvents()` runs in sync cycle for extra safety

---

## 🛠️ Technical Improvements

### Code Quality
- **Type Safety**: Enhanced TypeScript types for events and calendars
- **Error Handling**: Defensive checks for time parsing and event updates
- **Logging**: Comprehensive console logs for debugging
- **Performance**: Optimized event rendering with `useMemo`

### Architecture
- **New Components**:
  - `TimeCalendar.tsx`: Main calendar view component
  - `ToastUIReactCalendar.tsx`: TUI Calendar React wrapper
  - `EventEditModal.tsx`: Event editor with multi-tag support
  - `CalendarSettingsPanel.tsx`: Calendar filter UI
  
- **New Utilities**:
  - `calendarUtils.ts`: Calendar-specific helper functions
  
- **Removed Legacy Code**:
  - `TagManager.tsx` (replaced by `FigmaTagManagerV3.tsx`)
  - `TagManagement.tsx` (deprecated)

### Sync Manager Enhancements
- **Calendar Migration**: Handles tag-triggered calendar moves
- **Duplicate Detection**: Two-layer protection (inline + periodic)
- **Event ID Management**: Consistent `externalId` updates

---

## 📚 Documentation

New documentation added to `/docs`:

1. **TIMECALENDAR_README.md**: Complete TimeCalendar implementation guide
2. **timecalendar-tui-integration.md**: TUI Calendar integration details
3. **timecalendar-testing-guide.md**: Testing procedures and scenarios
4. **timecalendar-completion-summary.md**: Development completion report
5. **ui-verification-framework.md**: UI testing framework documentation

---

## 🧪 Testing & Debugging Tools

New utilities in project root:

- **test-deduplication.js**: Verify event deduplication logic
- **diagnose-duplicates.js**: Detect duplicate events in localStorage
- **ui-verification.js**: UI component testing framework
- **clear-calendar-filters.html**: Reset calendar filter settings

---

## 📊 Statistics

- **76 files changed**
- **15,187 insertions**
- **3,096 deletions**
- **11 new components**
- **5 major bug fixes**
- **4 new utility tools**

---

## 🚀 Migration Guide

### Upgrading from v1.0

1. **Pull the latest code**:
   ```bash
   git pull origin master
   git checkout v1.1
   ```

2. **Install dependencies** (if needed):
   ```bash
   npm install
   ```

3. **Clear browser cache** (recommended):
   - Open DevTools → Application → Clear storage
   - Or use `clear-calendar-filters.html` utility

4. **Run the app**:
   ```bash
   npm start
   ```

### Data Compatibility

- ✅ **Full backward compatibility** with v1.0 events
- ✅ **Automatic migration** of calendar settings
- ✅ **Duplicate cleanup** runs on first sync

---

## 🔮 What's Next (v1.2 Preview)

Planned features for next release:

- 🎨 Custom color themes for calendars
- 🔔 Event reminder notifications
- 📱 Mobile responsive design
- 🔍 Advanced event search and filtering
- 📈 Calendar analytics and insights
- 🌍 Timezone support improvements

---

## 🙏 Acknowledgments

Special thanks to:
- **TOAST UI Calendar** team for the excellent calendar library
- **Microsoft Graph API** for reliable Outlook integration
- All beta testers who reported bugs and provided feedback

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/zoeysnowy/ReMarkable/issues)
- **Discussions**: [GitHub Discussions](https://github.com/zoeysnowy/ReMarkable/discussions)
- **Email**: zoeysnowy@example.com

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

---

**Happy organizing! 🎯**  
*The ReMarkable Team*

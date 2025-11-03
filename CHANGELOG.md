# Changelog

All notable changes to ReMarkable will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Reverted
- **Tiptap Phase 2 Integration**: Rolled back due to runtime Schema conflicts
  - Error: "No node type or group 'paragraph' found"
  - Impact: Persistent runtime error despite multiple fix attempts
  - Resolution: Reverted to original `FreeFormEditor` (contentEditable)
  - Files disabled: PlanEditor, EventTitle, EventDescription (renamed to .backup)
  - Documentation: `TIPTAP_PHASE2_FAILURE_ANALYSIS.md`
  - **User Impact**: LocalStorage data lost during cache clearing
  - **Lesson**: Tiptap requires complete isolation testing before production integration

### Added
- **Tiptap Phase 2 Integration** (Code Complete, Runtime Failed):
  - `TiptapLine`: Single-line Tiptap wrapper component (179 lines)
  - `TiptapFreeFormEditor`: Tiptap-powered FreeFormEditor replacement (299 lines)
  - Tab/Shift+Tab keyboard shortcuts for indentation
  - ArrowUp/ArrowDown navigation between lines
  - Documentation: `TIPTAP_PHASE2_INTEGRATION.md`, `TIPTAP_PHASE2_QUICKSTART.md`
  - Status: Code preserved for future v2.0 integration

### Changed
- **FloatingToolbar**: 快捷键从 Ctrl+/ 改为 Alt+1-5
  - Alt+1: 标签功能
  - Alt+2: 表情功能
  - Alt+3: 日期功能
  - Alt+4: 优先级功能
  - Alt+5: 颜色功能
  - 快捷键仅在编辑器内激活（有焦点）时生效
- **PlanManager**: Now uses `TiptapFreeFormEditor` instead of `FreeFormEditor`
- Updated documentation in `docs/FLOATING_TOOLBAR_GUIDE.md`

## [1.1.0] - 2025-10-20

### Added
- TUI Calendar integration with interactive week/month views
- EventEditModal component with multi-tag selection
- Calendar filter system (CalendarSettingsPanel)
- Event deduplication mechanism (inline + periodic scan)
- Multi-format ISO 8601 time parsing support
- Tag search functionality in event editor
- Click-outside-to-close for tag dropdown
- Auto-select-all calendars on first settings open
- Comprehensive documentation (5 new docs)
- Testing utilities (4 diagnostic tools)
- CalendarSettingsPanel with visibility toggles
- Time validation before save (NaN rejection)

### Fixed
- Event click handler closure issue (stale events array)
- TUI Calendar event binding (incorrect event name)
- NaN:NaN time display (ISO format parsing)
- Calendar filter empty-array semantics
- Tag dropdown unable to close
- Duplicate events during calendar migration
- Time parsing for .000Z millisecond format

### Changed
- Replaced legacy TagManager with FigmaTagManagerV3
- Calendar filter logic: removed "empty = show all" behavior
- Event time fields now use ISO 8601 strings
- Updated parseLocalTimeString to handle multiple formats
- Enhanced ActionBasedSyncManager with duplicate detection

### Removed
- Legacy TagManagement component
- Old TagManager component
- Confusing calendar filter logic

### Technical
- New files: 11 components, 5 docs, 4 test utilities
- Code changes: 76 files, +15,187 / -3,096 lines
- Dependencies: @toast-ui/calendar, @toast-ui/react-calendar

### Documentation
- TIMECALENDAR_README.md: Implementation guide
- timecalendar-tui-integration.md: TUI Calendar integration
- timecalendar-testing-guide.md: Testing procedures
- timecalendar-completion-summary.md: Development report
- ui-verification-framework.md: UI testing framework

## [1.0.0] - 2024

### Added
- Initial stable release
- Microsoft Outlook calendar synchronization
- Event management (create, edit, delete)
- Task management system
- Tag management system
- Pomodoro timer
- Azure MSAL authentication
- localStorage persistence
- Action-based sync manager
- Conflict resolution system

### Technical
- React 19.2.0 + TypeScript
- Microsoft Graph API integration
- MSAL Browser authentication
- Create React App foundation

## [1.0.0-dev] - 2024

### Added
- Beta development version
- Core calendar sync functionality
- Basic event and task management
- Initial tag system
- Development documentation

## [0.1.0] - 2024

### Added
- Project initialization
- Basic UI structure
- React setup
- TypeScript configuration

---

## Version Links

- [1.1.0 Release Notes](./RELEASE_NOTES_v1.1.md)
- [GitHub Releases](https://github.com/zoeysnowy/ReMarkable/releases)
- [Documentation](./docs/)

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

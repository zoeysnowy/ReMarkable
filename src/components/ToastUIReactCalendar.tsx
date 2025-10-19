import type { EventObject, ExternalEventTypes, Options } from '@toast-ui/calendar';
import ToastUICalendar from '@toast-ui/calendar';
import React from 'react';

// Helper function to check equality
function isEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, index) => isEqual(val, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as any);
    const keysB = Object.keys(b as any);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => isEqual((a as any)[key], (b as any)[key]));
  }
  return false;
}

type ReactCalendarOptions = Omit<Options, 'defaultView'>;
type CalendarView = Required<Options>['defaultView'];

type CalendarExternalEventNames = Extract<keyof ExternalEventTypes, string>;
type ReactCalendarEventNames = `on${Capitalize<CalendarExternalEventNames>}`;
type ReactCalendarEventHandler = ExternalEventTypes[CalendarExternalEventNames];
type ReactCalendarExternalEvents = {
  [events in ReactCalendarEventNames]: ReactCalendarEventHandler;
};

type Props = ReactCalendarOptions & {
  height: string;
  events?: Partial<EventObject>[];
  view?: CalendarView;
} & Partial<ReactCalendarExternalEvents>;

const optionsProps: (keyof ReactCalendarOptions)[] = [
  'useFormPopup',
  'useDetailPopup',
  'isReadOnly',
  'week',
  'month',
  'gridSelection',
  'usageStatistics',
  'eventFilter',
  'timezone',
  'template',
];

const reactCalendarEventNames: ReactCalendarEventNames[] = [
  'onSelectDateTime',
  'onBeforeCreateEvent',
  'onBeforeUpdateEvent',
  'onBeforeDeleteEvent',
  'onAfterRenderEvent',
  'onClickDayName',
  'onClickEvent',
  'onClickMoreEventsBtn',
  'onClickTimezonesCollapseBtn',
];

export default class ToastUIReactCalendar extends React.Component<Props> {
  containerElementRef = React.createRef<HTMLDivElement>();
  calendarInstance: ToastUICalendar | null = null;
  currentEventsRef: Partial<EventObject>[] = []; // ✅ 追踪当前实际渲染的事件

  static defaultProps = {
    height: '800px',
    view: 'week' as CalendarView,
  };

  componentDidMount() {
    const { height, events = [], view, ...options } = this.props;
    const container = this.containerElementRef.current;

    if (container) {
      // Extract only the options that belong to TUI Calendar
      const calendarOptions = optionsProps.reduce((acc, prop) => {
        if (prop in options) {
          (acc as any)[prop] = (options as any)[prop];
        }
        return acc;
      }, {});

      this.calendarInstance = new ToastUICalendar(container, { 
        ...calendarOptions, 
        defaultView: view || 'week' 
      });

      container.style.height = height;
    }

    this.setEvents(events);
    this.bindEventHandlers();
  }

  shouldComponentUpdate(nextProps: Readonly<Props>) {
    const { calendars, height, events, theme, view } = this.props;
    const {
      calendars: nextCalendars,
      height: nextHeight,
      events: nextEvents,
      theme: nextTheme = {},
      view: nextView = 'week',
    } = nextProps;

    if (!isEqual(height, nextHeight) && this.containerElementRef.current) {
      this.containerElementRef.current.style.height = nextHeight;
    }

    if (!isEqual(calendars, nextCalendars)) {
      this.setCalendars(nextCalendars);
    }

    // 🔄 优化事件更新：使用增量更新而不是全量刷新
    if (!isEqual(events, nextEvents)) {
      console.log(`📊 [TUI] Events props changed: ${(events || []).length} → ${(nextEvents || []).length}`);
      this.updateEventsIncremental(nextEvents || []);
    }

    if (!isEqual(theme, nextTheme)) {
      this.calendarInstance?.setTheme(nextTheme);
    }

    if (!isEqual(view, nextView)) {
      this.calendarInstance?.changeView(nextView);
    }

    return false;
  }

  componentWillUnmount() {
    this.calendarInstance?.destroy();
  }

  setCalendars = (calendars: ReactCalendarOptions['calendars']) => {
    if (calendars) {
      this.calendarInstance?.setCalendars(calendars);
    }
  };

  setEvents = (events: Partial<EventObject>[]) => {
    if (events && events.length > 0) {
      this.calendarInstance?.createEvents(events);
      this.currentEventsRef = [...events]; // ✅ 更新当前事件引用
    }
  };

  // 🔄 增量更新事件：只更新变化的部分
  updateEventsIncremental = (newEvents: Partial<EventObject>[]) => {
    if (!this.calendarInstance) return;

    const startTime = performance.now(); // ⏱️ 性能监控

    // ✅ 使用当前实际渲染的事件进行比较
    const currentEvents = this.currentEventsRef;
    
    // 创建快速查找映射
    const currentEventsMap = new Map(currentEvents.map(e => [e.id, e]));
    const newEventsMap = new Map(newEvents.map(e => [e.id, e]));

    const toDelete: Partial<EventObject>[] = [];  // ✅ 改为保存完整事件对象
    const toUpdate: Partial<EventObject>[] = [];
    const toCreate: Partial<EventObject>[] = [];

    // 找出需要删除的事件（在当前渲染中存在，但在新事件列表中不存在）
    currentEvents.forEach(currentEvent => {
      if (currentEvent.id && !newEventsMap.has(currentEvent.id)) {
        toDelete.push(currentEvent);  // ✅ 保存完整对象而不只是ID
      }
    });

    // 找出需要创建或更新的事件
    newEvents.forEach(newEvent => {
      const currentEvent = newEvent.id ? currentEventsMap.get(newEvent.id) : undefined;
      if (!currentEvent) {
        toCreate.push(newEvent);
      } else {
        // ✅ 智能比较：忽略视觉样式变化，只比较核心数据
        const coreFieldsChanged = 
          currentEvent.title !== newEvent.title ||
          currentEvent.start?.toString() !== newEvent.start?.toString() ||
          currentEvent.end?.toString() !== newEvent.end?.toString() ||
          currentEvent.location !== newEvent.location ||
          currentEvent.body !== newEvent.body ||
          currentEvent.isAllday !== newEvent.isAllday ||
          currentEvent.category !== newEvent.category ||
          currentEvent.calendarId !== newEvent.calendarId;
        
        if (coreFieldsChanged) {
          toUpdate.push(newEvent);
        }
      }
    });

    const diffTime = performance.now() - startTime;
    console.log(`🔄 [TUI] Update: -${toDelete.length} ~${toUpdate.length} +${toCreate.length} (${currentEvents.length} → ${newEvents.length}) in ${diffTime.toFixed(2)}ms`);

    // 只有在有实际变化时才执行操作
    if (toDelete.length > 0 || toUpdate.length > 0 || toCreate.length > 0) {
      // 删除不再存在的事件
      toDelete.forEach(event => {
        try {
          if (event.id && event.calendarId) {
            this.calendarInstance?.deleteEvent(event.id, event.calendarId);
          }
        } catch (e) {
          console.warn('[TUI] Failed to delete event:', event.id, e);
        }
      });

      // 更新已存在的事件
      toUpdate.forEach(event => {
        try {
          if (event.id && event.calendarId) {
            this.calendarInstance?.updateEvent(event.id, event.calendarId, event);
          }
        } catch (e) {
          console.warn('[TUI] Failed to update event:', event.id, e);
        }
      });

      // 创建新事件
      if (toCreate.length > 0) {
        this.calendarInstance?.createEvents(toCreate);
      }
      
      // ✅ 更新当前事件引用
      this.currentEventsRef = [...newEvents];
    }
  };

  bindEventHandlers = () => {
    const { props } = this;
    
    // 绑定 clickEvent（已确认这是正确的事件名）
    if (props.onClickEvent && this.calendarInstance) {
      this.calendarInstance.on('clickEvent' as any, (eventInfo: any) => {
        props.onClickEvent?.(eventInfo);
      });
    }
    
    // 绑定其他事件
    reactCalendarEventNames.forEach((eventName) => {
      const eventHandler = props[eventName];
      if (eventHandler && this.calendarInstance && eventName !== 'onClickEvent') {
        const calendarEventName = eventName.replace('on', '').toLowerCase() as CalendarExternalEventNames;
        this.calendarInstance.on(calendarEventName, eventHandler);
      }
    });
  };

  getInstance = () => {
    return this.calendarInstance;
  };

  render() {
    return <div ref={this.containerElementRef} />;
  }
}
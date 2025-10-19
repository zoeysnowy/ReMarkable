// 本地化的 TUI Calendar 实现
// 使用 UTF-8 编码，支持中文

export interface CalendarOptions {
  defaultView?: 'month' | 'week' | 'day';
  calendars?: CalendarInfo[];
  isReadOnly?: boolean;
  theme?: any;
  template?: any;
  timezones?: any[];
  useCreationPopup?: boolean;
  useDetailPopup?: boolean;
  week?: any;
  month?: any;
}

export interface CalendarInfo {
  id: string;
  name: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
}

export interface EventObject {
  id: string;
  title: string;
  start: Date;
  end: Date;
  category: 'allday' | 'time';
  isAllDay: boolean;
  location?: string;
  body?: string;
  calendarId: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
}

// 简化的 Calendar 类实现
export class Calendar {
  private container: HTMLElement;
  private options: CalendarOptions;
  private events: EventObject[] = [];
  private currentDate: Date = new Date();
  private currentView: 'month' | 'week' | 'day' = 'month';

  constructor(container: HTMLElement, options: CalendarOptions = {}) {
    this.container = container;
    this.options = {
      defaultView: 'month',
      isReadOnly: false,
      useCreationPopup: false,
      useDetailPopup: false,
      ...options
    };
    this.currentView = options.defaultView || 'month';
    this.init();
  }

  private init() {
    this.container.innerHTML = '';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.fontFamily = "'Microsoft YaHei', Arial, sans-serif";
    
    this.render();
  }

  private render() {
    const calendarWrapper = document.createElement('div');
    calendarWrapper.style.width = '100%';
    calendarWrapper.style.height = '100%';
    calendarWrapper.style.backgroundColor = '#ffffff';
    calendarWrapper.style.border = '1px solid #e5e7eb';
    calendarWrapper.style.borderRadius = '8px';
    calendarWrapper.style.overflow = 'hidden';

    // 创建头部
    const header = this.createHeader();
    calendarWrapper.appendChild(header);

    // 创建日历主体
    const body = this.createBody();
    calendarWrapper.appendChild(body);

    this.container.appendChild(calendarWrapper);
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.padding = '16px';
    header.style.borderBottom = '1px solid #e5e7eb';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.backgroundColor = '#f9fafb';

    // 导航按钮
    const nav = document.createElement('div');
    nav.style.display = 'flex';
    nav.style.gap = '8px';
    nav.style.alignItems = 'center';

    const prevBtn = this.createNavButton('上一月', () => this.prev());
    const nextBtn = this.createNavButton('下一月', () => this.next());
    const todayBtn = this.createNavButton('今天', () => this.today());

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    nav.appendChild(todayBtn);

    // 当前日期显示
    const dateDisplay = document.createElement('div');
    dateDisplay.style.fontSize = '18px';
    dateDisplay.style.fontWeight = '600';
    dateDisplay.style.color = '#1f2937';
    dateDisplay.textContent = this.formatCurrentDate();

    // 视图切换
    const viewButtons = document.createElement('div');
    viewButtons.style.display = 'flex';
    viewButtons.style.gap = '4px';

    const monthBtn = this.createViewButton('月视图', 'month');
    const weekBtn = this.createViewButton('周视图', 'week');
    const dayBtn = this.createViewButton('日视图', 'day');

    viewButtons.appendChild(monthBtn);
    viewButtons.appendChild(weekBtn);
    viewButtons.appendChild(dayBtn);

    header.appendChild(nav);
    header.appendChild(dateDisplay);
    header.appendChild(viewButtons);

    return header;
  }

  private createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.padding = '16px';

    if (this.currentView === 'month') {
      return this.createMonthView();
    } else if (this.currentView === 'week') {
      return this.createWeekView();
    } else {
      return this.createDayView();
    }
  }

  private createMonthView(): HTMLElement {
    const monthView = document.createElement('div');
    monthView.style.display = 'grid';
    monthView.style.gridTemplateColumns = 'repeat(7, 1fr)';
    monthView.style.gap = '1px';
    monthView.style.backgroundColor = '#e5e7eb';
    monthView.style.height = '100%';

    // 添加星期头
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    weekdays.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.style.padding = '12px';
      dayHeader.style.backgroundColor = '#f3f4f6';
      dayHeader.style.textAlign = 'center';
      dayHeader.style.fontWeight = '600';
      dayHeader.style.color = '#374151';
      dayHeader.textContent = day;
      monthView.appendChild(dayHeader);
    });

    // 生成日期格子
    const startOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    const endOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);
      
      const cell = this.createDateCell(cellDate);
      monthView.appendChild(cell);
    }

    return monthView;
  }

  private createWeekView(): HTMLElement {
    const weekView = document.createElement('div');
    weekView.style.padding = '16px';
    weekView.textContent = '周视图 (开发中)';
    weekView.style.textAlign = 'center';
    weekView.style.color = '#6b7280';
    return weekView;
  }

  private createDayView(): HTMLElement {
    const dayView = document.createElement('div');
    dayView.style.padding = '16px';
    dayView.textContent = '日视图 (开发中)';
    dayView.style.textAlign = 'center';
    dayView.style.color = '#6b7280';
    return dayView;
  }

  private createDateCell(date: Date): HTMLElement {
    const cell = document.createElement('div');
    cell.style.minHeight = '80px';
    cell.style.backgroundColor = '#ffffff';
    cell.style.padding = '8px';
    cell.style.position = 'relative';
    cell.style.cursor = 'pointer';

    const isCurrentMonth = date.getMonth() === this.currentDate.getMonth();
    const isToday = this.isSameDate(date, new Date());

    if (!isCurrentMonth) {
      cell.style.backgroundColor = '#f9fafb';
      cell.style.color = '#9ca3af';
    }

    if (isToday) {
      cell.style.backgroundColor = '#dbeafe';
      cell.style.borderLeft = '3px solid #3b82f6';
    }

    // 日期数字
    const dateNumber = document.createElement('div');
    dateNumber.style.fontSize = '14px';
    dateNumber.style.fontWeight = isToday ? '600' : '400';
    dateNumber.style.marginBottom = '4px';
    dateNumber.textContent = date.getDate().toString();

    cell.appendChild(dateNumber);

    // 添加事件
    const dayEvents = this.getEventsForDate(date);
    dayEvents.forEach(event => {
      const eventElement = this.createEventElement(event);
      cell.appendChild(eventElement);
    });

    return cell;
  }

  private createEventElement(event: EventObject): HTMLElement {
    const eventEl = document.createElement('div');
    eventEl.style.fontSize = '11px';
    eventEl.style.padding = '2px 4px';
    eventEl.style.marginBottom = '2px';
    eventEl.style.borderRadius = '2px';
    eventEl.style.backgroundColor = event.backgroundColor || '#3b82f6';
    eventEl.style.color = event.color || '#ffffff';
    eventEl.style.overflow = 'hidden';
    eventEl.style.textOverflow = 'ellipsis';
    eventEl.style.whiteSpace = 'nowrap';
    eventEl.style.cursor = 'pointer';
    eventEl.textContent = event.title;

    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onEventClick(event);
    });

    return eventEl;
  }

  private createNavButton(text: string, onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.style.padding = '8px 12px';
    button.style.border = '1px solid #d1d5db';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = '#ffffff';
    button.style.color = '#374151';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.textContent = text;

    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#f3f4f6';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#ffffff';
    });

    return button;
  }

  private createViewButton(text: string, view: 'month' | 'week' | 'day'): HTMLElement {
    const button = document.createElement('button');
    button.style.padding = '8px 12px';
    button.style.border = '1px solid #d1d5db';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = this.currentView === view ? '#3b82f6' : '#ffffff';
    button.style.color = this.currentView === view ? '#ffffff' : '#374151';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.textContent = text;

    button.addEventListener('click', () => {
      this.currentView = view;
      this.render();
    });

    return button;
  }

  private formatCurrentDate(): string {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;
    return `${year}年${month}月`;
  }

  private getEventsForDate(date: Date): EventObject[] {
    return this.events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      return this.isSameDate(date, eventStart) || 
             this.isSameDate(date, eventEnd) ||
             (date > eventStart && date < eventEnd);
    });
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private onEventClick(event: EventObject) {
    console.log('Event clicked:', event);
    // 这里可以添加事件点击的处理逻辑
  }

  // 公共 API 方法
  public createEvents(events: EventObject[]) {
    this.events = [...events];
    this.render();
  }

  public clear() {
    this.events = [];
    this.render();
  }

  public today() {
    this.currentDate = new Date();
    this.render();
  }

  public prev() {
    if (this.currentView === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (this.currentView === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
    }
    this.render();
  }

  public next() {
    if (this.currentView === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else if (this.currentView === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
    }
    this.render();
  }

  public changeView(view: 'month' | 'week' | 'day') {
    this.currentView = view;
    this.render();
  }

  public destroy() {
    this.container.innerHTML = '';
  }

  // 事件监听
  public on(eventType: string, handler: (event: any) => void) {
    // 简化的事件监听实现
    console.log(`Event listener added for: ${eventType}`);
  }
}

export default Calendar;
// Lightweight debug logger with category filtering via localStorage or window flag
// Enable by setting localStorage.RE_DEBUG = '1' or a comma-separated list of tags (e.g., 'time,picker')
// Alternatively, set (window as any).RE_DEBUG = true or an array of tags

type DebugData = Record<string, any> | undefined;

function isEnabled(tag: string) {
  try {
    const w: any = window as any;
    if (Array.isArray(w.RE_DEBUG)) {
      return w.RE_DEBUG.includes(tag) || w.RE_DEBUG.includes('*');
    }
    if (w.RE_DEBUG === true || w.RE_DEBUG === '*') return true;
    const v = localStorage.getItem('RE_DEBUG');
    if (!v) return false;
    if (v === '1' || v.toLowerCase() === 'true' || v === '*') return true;
    return v.split(',').map(s => s.trim()).filter(Boolean).includes(tag);
  } catch {
    return false;
  }
}

export function dbg(tag: string, msg: string, data?: DebugData) {
  if (!isEnabled(tag)) return;
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  if (data) {
    // eslint-disable-next-line no-console
    console.log(`%c[${timestamp}] [${tag}] ${msg}`, 'color: #3b82f6; font-weight: bold', data);
  } else {
    // eslint-disable-next-line no-console
    console.log(`%c[${timestamp}] [${tag}] ${msg}`, 'color: #3b82f6; font-weight: bold');
  }
}

export function warn(tag: string, msg: string, data?: DebugData) {
  if (!isEnabled(tag)) return;
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  if (data) {
    // eslint-disable-next-line no-console
    console.warn(`%c[${timestamp}] [${tag}] ${msg}`, 'color: #f59e0b; font-weight: bold', data);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`%c[${timestamp}] [${tag}] ${msg}`, 'color: #f59e0b; font-weight: bold');
  }
}

export function error(tag: string, msg: string, data?: DebugData) {
  if (!isEnabled(tag)) return;
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  if (data) {
    // eslint-disable-next-line no-console
    console.error(`%c[${timestamp}] [${tag}] ${msg}`, 'color: #ef4444; font-weight: bold', data);
  } else {
    // eslint-disable-next-line no-console
    console.error(`%c[${timestamp}] [${tag}] ${msg}`, 'color: #ef4444; font-weight: bold');
  }
}

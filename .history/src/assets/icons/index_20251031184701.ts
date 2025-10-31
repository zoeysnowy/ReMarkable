// 导入所有图标
import logoSvg from './LOGO.svg';
import searchSvg from './Search.svg';
import homeSvg from './Home.svg';
import timeSvg from './Time.svg';
import logSvg from './Log.svg';
import tagSvg from './Tag.svg';
import planSvg from './Plan.svg';
import syncSvg from './Sync.svg';
import notificationSvg from './Notification.svg';
import settingSvg from './Setting.svg';
import outlookSvg from './Outlook.svg';
import multiCheckinColorSvg from './MultiCheckin_color.svg';
import timerColorSvg from './timer_color.svg';
import pauseSvg from './pause.svg';
import stopSvg from './stop.svg';
import cancelSvg from './cancel.svg';
import emojiSvg from './emoji.svg';

export const icons = {
  logo: logoSvg,
  search: searchSvg,
  home: homeSvg,
  time: timeSvg,
  log: logSvg,
  tag: tagSvg,
  plan: planSvg,
  sync: syncSvg,
  notification: notificationSvg,
  setting: settingSvg,
  outlook: outlookSvg,
  multiCheckinColor: multiCheckinColorSvg,
  timerColor: timerColorSvg,
  pause: pauseSvg,
  stop: stopSvg,
  cancel: cancelSvg,
  emoji: emojiSvg,
};

// 图标类型定义
export type IconType = keyof typeof icons;
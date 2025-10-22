/**/**

 * Widget Page - 悬浮窗口页面 * Widget Page - 悬浮窗口页面

 *  * 

 * 直接渲染 TimeCalendar，不使用 DesktopCalendarWidgetV3 的 overlay * 直接渲染 TimeCalendar，不使用 DesktopCalendarWidgetV3 的 overlay

 * 因为 Electron 窗口本身就是独立容器，不需要额外的 fixed 定位层 * 因为 Electron 窗口本身就是独立容器，不需要额外的 fixed 定位层

 */ */



import React, { useState, useEffect } from 'react';import React, { useState, useEffect } from 'react';

import TimeCalendar from '../components/TimeCalendar';import TimeCalendar from '../components/TimeCalendar';

import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';



const WidgetPage: React.FC = () => {const WidgetPage: React.FC = () => {

  // 创建Microsoft Calendar服务实例  // 创建Microsoft Calendar服务实例

  const [microsoftService] = useState(() => new MicrosoftCalendarService());  const [microsoftService] = useState(() => new MicrosoftCalendarService());



  // 设置body为透明背景（widget模式）  // 设置body为透明背景（widget模式）

  useEffect(() => {  useEffect(() => {

    document.body.classList.add('widget-mode');    document.body.classList.add('widget-mode');

    document.body.style.backgroundColor = 'transparent';    document.body.style.backgroundColor = 'transparent';

    document.body.style.overflow = 'hidden';    document.body.style.overflow = 'hidden';

    document.body.style.margin = '0';    document.body.style.margin = '0';

    document.body.style.padding = '0';    document.body.style.padding = '0';

        

    return () => {    return () => {

      document.body.classList.remove('widget-mode');      document.body.classList.remove('widget-mode');

      document.body.style.backgroundColor = '';      document.body.style.backgroundColor = '';

      document.body.style.overflow = '';      document.body.style.overflow = '';

      document.body.style.margin = '';      document.body.style.margin = '';

      document.body.style.padding = '';      document.body.style.padding = '';

    };    };

  }, []);  }, []);



  return (  return (

    <div style={{     <div style={{ 

      width: '100vw',       width: '100vw', 

      height: '100vh',       height: '100vh', 

      overflow: 'hidden',      overflow: 'hidden',

      margin: 0,      margin: 0,

      padding: 0,      padding: 0,

      backgroundColor: 'transparent',      backgroundColor: 'transparent',

      display: 'flex',      display: 'flex',

      flexDirection: 'column'      flexDirection: 'column'

    }}>    }}>

      {/* 直接渲染 TimeCalendar，无需 overlay wrapper */}      {/* 直接渲染 TimeCalendar，无需 overlay wrapper */}

      <TimeCalendar      <TimeCalendar

        onStartTimer={(taskTitle: string) => {        onStartTimer={(taskTitle: string) => {

          console.log('📝 Timer started for task:', taskTitle);          console.log('📝 Timer started for task:', taskTitle);

        }}        }}

        microsoftService={microsoftService}        microsoftService={microsoftService}

        style={{        style={{

          width: '100%',          width: '100%',

          height: '100%',          height: '100%',

          border: 'none',          border: 'none',

          borderRadius: '0',          borderRadius: '0',

          background: 'transparent'          background: 'transparent'

        }}        }}

      />      />

    </div>    </div>

  );  );

};};



export default WidgetPage;export default WidgetPage;


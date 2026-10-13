import React from 'react';
import { SinopWidget } from './SinopWidget';
import { freshen, loadWidgetData } from './data';

export async function widgetTaskHandler(props) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK': {
      const data = freshen(await loadWidgetData());
      props.renderWidget(<SinopWidget data={data} />);
      break;
    }
    default:
      break;
  }
}

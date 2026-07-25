import type { Component } from 'vue';
import GenericWidget from '@/astraStudio/widgets/GenericWidget.vue';
import CrmRecordWidget from '@/astraStudio/widgets/CrmRecordWidget.vue';
import AiTextWidget from '@/astraStudio/widgets/AiTextWidget.vue';
import AnalyticsChartWidget from '@/astraStudio/widgets/AnalyticsChartWidget.vue';
import RichTextWidget from '@/astraStudio/widgets/RichTextWidget.vue';
import ChecklistWidget from '@/astraStudio/widgets/ChecklistWidget.vue';
import StickyWidget from '@/astraStudio/widgets/StickyWidget.vue';
import TimelineWidget from '@/astraStudio/widgets/TimelineWidget.vue';
import KanbanWidget from '@/astraStudio/widgets/KanbanWidget.vue';
import WhiteboardWidget from '@/astraStudio/widgets/WhiteboardWidget.vue';
import ProcessGraphWidget from '@/astraStudio/widgets/ProcessGraphWidget.vue';
import CommsWidget from '@/astraStudio/widgets/CommsWidget.vue';
import type { WidgetType } from '@/astraStudio/types';

const CRM_PREFIX = 'crm.';
const AI_PREFIX = 'ai.';
const ANALYTICS_PREFIX = 'analytics.';
const COMMS_PREFIX = 'comms.';

function resolveWidgetComponent(type: string): Component {
  if (type.startsWith(CRM_PREFIX)) return CrmRecordWidget;
  if (type.startsWith(AI_PREFIX)) return AiTextWidget;
  if (type.startsWith(ANALYTICS_PREFIX)) return AnalyticsChartWidget;
  if (type === 'content.rich_text' || type === 'content.markdown') return RichTextWidget;
  if (type === 'content.checklist') return ChecklistWidget;
  if (type === 'content.sticky') return StickyWidget;
  if (type === 'viz.timeline') return TimelineWidget;
  if (type === 'viz.kanban') return KanbanWidget;
  if (type === 'viz.whiteboard') return WhiteboardWidget;
  if (type === 'viz.process' || type === 'viz.bpmn' || type === 'viz.uml') return ProcessGraphWidget;
  if (type.startsWith(COMMS_PREFIX)) return CommsWidget;
  return GenericWidget;
}

export const widgetRegistry: Record<WidgetType | string, Component> = {};

export function getWidgetComponent(type: string): Component {
  if (widgetRegistry[type]) return widgetRegistry[type];
  return resolveWidgetComponent(type);
}

export { GenericWidget, CrmRecordWidget, AiTextWidget };

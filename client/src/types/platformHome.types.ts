export type PlatformHomeBuiltinWidgetType =
  | 'intent-bar'
  | 'today-brief'
  | 'alerts'
  | 'apps'
  | 'up-next'
  | 'recent-work'
  | 'inbox';

export type PlatformHomeWidgetType = PlatformHomeBuiltinWidgetType | 'analytics';

export interface PlatformHomeLayoutItem {
  instanceId: string;
  type: PlatformHomeWidgetType;
  widgetId?: string | null;
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export type PlatformHomeWidthMode = 'compact' | 'wide';

export interface PlatformHomeLayout {
  items: PlatformHomeLayoutItem[];
  widthMode?: PlatformHomeWidthMode;
}

export interface PlatformHomeBuiltinWidgetDefinition {
  type: PlatformHomeBuiltinWidgetType;
  labelKey: string;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}

import type { InjectionKey, Ref } from 'vue';

export interface PlatformHomeWidgetChrome {
  showDragHandle: Ref<boolean | undefined>;
}

export const PLATFORM_HOME_WIDGET_CHROME_KEY: InjectionKey<PlatformHomeWidgetChrome> = Symbol(
  'platformHomeWidgetChrome',
);

import { captureHeadlessHelpViewed } from '@/config/posthogArticles';

export function trackHeadlessHelpViewed(page, properties = {}) {
  captureHeadlessHelpViewed({
    page,
    ...properties,
  });
}

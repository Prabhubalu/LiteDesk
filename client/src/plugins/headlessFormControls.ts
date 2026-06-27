import type { App } from 'vue';

let registered = false;

/** Register global HeadlessCheckbox / HeadlessSwitch after auth (not on /login). */
export async function registerHeadlessFormControls(app: App): Promise<void> {
  if (registered) return;

  const [{ default: HeadlessCheckbox }, { default: HeadlessSwitch }] = await Promise.all([
    import('@/components/ui/HeadlessCheckbox.vue'),
    import('@/components/ui/HeadlessSwitch.vue'),
  ]);

  app.component('HeadlessCheckbox', HeadlessCheckbox);
  app.component('HeadlessSwitch', HeadlessSwitch);
  registered = true;
}

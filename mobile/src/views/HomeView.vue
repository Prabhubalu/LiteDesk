<script setup lang="ts">
import { computed, onActivated } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePlatformHomeData } from '@/composables/usePlatformHomeData'
import { sortedEnabledWidgets } from '@/config/platformHomeWidgets'
import { extractBriefSignals, formatPlatformFocus } from '@/utils/platformHomeMobile'
import MobileHomeIntentBar from '@/components/platformHome/MobileHomeIntentBar.vue'
import MobileHomeTodayBrief from '@/components/platformHome/MobileHomeTodayBrief.vue'
import MobileHomeAlertsWidget from '@/components/platformHome/MobileHomeAlertsWidget.vue'
import MobileHomeAppsWidget from '@/components/platformHome/MobileHomeAppsWidget.vue'
import MobileHomeUpNextWidget from '@/components/platformHome/MobileHomeUpNextWidget.vue'
import MobileHomeRecentWorkWidget from '@/components/platformHome/MobileHomeRecentWorkWidget.vue'
import MobileHomeInboxWidget from '@/components/platformHome/MobileHomeInboxWidget.vue'

const auth = useAuthStore()
const { refreshing, error, snapshot, layout, alerts, load } = usePlatformHomeData()

const widgets = computed(() => sortedEnabledWidgets(layout.value))

const focusText = computed(() => formatPlatformFocus(snapshot.value?.focus))
const briefSignals = computed(() => extractBriefSignals(snapshot.value?.appPulses || []))

async function refresh() {
  await load(auth.organization)
}

// Kick off during setup (not onMounted) so a frozen main thread after first paint
// cannot leave us stuck on a blocking spinner.
void refresh()

let homeActivated = false
onActivated(() => {
  if (!homeActivated) {
    homeActivated = true
    return
  }
  void refresh()
})
</script>

<template>
  <section class="hub">
    <div class="hub-body">
      <div v-if="error" class="banner banner-error">{{ error }}</div>
      <div v-if="refreshing" class="refresh-hint" aria-live="polite">Refreshing…</div>

      <div class="widgets">
        <template v-for="item in widgets" :key="item.instanceId">
          <MobileHomeIntentBar v-if="item.type === 'intent-bar'" />
          <MobileHomeTodayBrief
            v-else-if="item.type === 'today-brief'"
            :focus-text="focusText"
            :signals="briefSignals"
          />
          <MobileHomeAlertsWidget v-else-if="item.type === 'alerts'" :alerts="alerts" />
          <MobileHomeAppsWidget
            v-else-if="item.type === 'apps'"
            :app-pulses="snapshot.appPulses"
          />
          <MobileHomeUpNextWidget
            v-else-if="item.type === 'up-next'"
            :snapshot="snapshot"
            @refresh="refresh"
          />
          <MobileHomeRecentWorkWidget
            v-else-if="item.type === 'recent-work'"
            :items="snapshot.resume"
          />
          <MobileHomeInboxWidget
            v-else-if="item.type === 'inbox'"
            :notifications-preview="snapshot.shell.notifications.preview"
            :mail-preview="snapshot.shell.mail.preview"
            :notifications-unread="snapshot.shell.notifications.unread"
            :unread-mail="snapshot.shell.mail.unread"
          />
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hub {
  min-width: 0;
  max-width: 100%;
  min-height: 100%;
  overflow-x: hidden;
}

.hub-body {
  display: grid;
  gap: 1rem;
  min-width: 0;
  max-width: 100%;
  padding: 1rem;
}

.refresh-hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.widgets {
  display: grid;
  gap: 1rem;
  min-width: 0;
  max-width: 100%;
}

.widgets > * {
  min-width: 0;
  max-width: 100%;
}
</style>

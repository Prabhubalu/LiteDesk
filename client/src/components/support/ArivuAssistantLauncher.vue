<template>
  <button
    v-if="visible"
    type="button"
    class="arivu-ai-orb"
    :class="{
      'arivu-ai-orb--active': active,
      'arivu-ai-orb--invite': invitePulse,
    }"
    :aria-label="t('liveChat.inAppOpen')"
    :title="t('liveChat.inAppOpen')"
    :aria-pressed="active"
    @click.stop.prevent="onClick"
  >
    <span class="arivu-ai-orb__ring" aria-hidden="true" />
    <span class="arivu-ai-orb__face" aria-hidden="true">
      <img
        src="/assets/logo/Ai%20Logo.svg"
        alt=""
        class="arivu-ai-orb__icon h-4 w-4 object-contain"
      />
    </span>
    <span
      v-if="invitePulse"
      class="arivu-ai-orb__dot"
      aria-hidden="true"
    />
  </button>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { isAiSuiteEntitled } from '@/utils/aiSuiteEntitlement';

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const active = ref(false);
const invitePulse = ref(false);

const visible = computed(() => {
  if (!authStore.isAuthenticated) return false;
  if (authStore.isExternalUser) return false;
  if (!isAiSuiteEntitled(authStore.user)) return false;
  const path = String(route.path || '');
  if (path.startsWith('/live-chat') || path.startsWith('/portal')) return false;
  return true;
});

function introStorageKey() {
  const userId = authStore.user?._id ? String(authStore.user._id) : '';
  const orgId = authStore.organization?._id
    ? String(authStore.organization._id)
    : (authStore.user?.organizationId ? String(authStore.user.organizationId) : '');
  if (!userId || !orgId) return null;
  return `litedesk_astra_intro_seen_v1:${orgId}:${userId}`;
}

function syncInvitePulse() {
  const key = introStorageKey();
  if (!key) {
    invitePulse.value = false;
    return;
  }
  try {
    invitePulse.value = localStorage.getItem(key) !== '1';
  } catch {
    invitePulse.value = false;
  }
}

function syncActive(event) {
  if (event?.detail && typeof event.detail.open === 'boolean') {
    active.value = event.detail.open;
    return;
  }
  active.value = document.body.classList.contains('arivu-assistant-rail-open');
}

function onIntroEvent(event) {
  if (event?.detail?.seen) {
    invitePulse.value = false;
    return;
  }
  syncInvitePulse();
}

function onClick() {
  window.dispatchEvent(new CustomEvent('arivu:open-assistant'));
}

onMounted(() => {
  syncActive();
  syncInvitePulse();
  window.addEventListener('arivu:assistant-rail', syncActive);
  window.addEventListener('arivu:astra-intro', onIntroEvent);
});

onBeforeUnmount(() => {
  window.removeEventListener('arivu:assistant-rail', syncActive);
  window.removeEventListener('arivu:astra-intro', onIntroEvent);
});
</script>

<style scoped>
.arivu-ai-orb {
  /* Logo palette: violet / blue / cyan / pink / coral */
  --ai-c1: #8e2ef7;
  --ai-c2: #3277fe;
  --ai-c3: #06d0fa;
  --ai-c4: #d633eb;
  --ai-c5: #ff4e66;
  --ai-c6: #ff8948;
  position: relative;
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  cursor: pointer;
  background: transparent;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.arivu-ai-orb__ring {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: conic-gradient(
    from 0deg,
    var(--ai-c1),
    var(--ai-c2),
    var(--ai-c3),
    var(--ai-c4),
    var(--ai-c5),
    var(--ai-c6),
    var(--ai-c1)
  );
  animation: arivu-ai-orb-spin 3.2s linear infinite;
  pointer-events: none;
}

.arivu-ai-orb__face {
  position: relative;
  z-index: 1;
  display: inline-flex;
  height: calc(100% - 3px);
  width: calc(100% - 3px);
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.04);
}

.arivu-ai-orb__icon {
  display: block;
}

.arivu-ai-orb__dot {
  position: absolute;
  top: -1px;
  right: -1px;
  z-index: 2;
  height: 0.45rem;
  width: 0.45rem;
  border-radius: 9999px;
  background: var(--ai-c5);
  box-shadow: 0 0 0 2px #fff;
  animation: arivu-ai-orb-dot 1.6s ease-in-out infinite;
}

.arivu-ai-orb:hover {
  transform: scale(1.06);
}

.arivu-ai-orb:focus {
  outline: none;
}

.arivu-ai-orb:focus-visible {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px var(--ai-c2);
}

.arivu-ai-orb--active .arivu-ai-orb__ring {
  animation-duration: 1.6s;
}

.arivu-ai-orb--active .arivu-ai-orb__face {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ai-c2) 25%, transparent);
}

.arivu-ai-orb--invite .arivu-ai-orb__ring {
  animation-duration: 1.8s;
  filter: saturate(1.15) brightness(1.05);
}

.arivu-ai-orb--invite {
  animation: arivu-ai-orb-invite 2.4s ease-in-out infinite;
}

@keyframes arivu-ai-orb-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes arivu-ai-orb-invite {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

@keyframes arivu-ai-orb-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.25);
    opacity: 0.75;
  }
}

@media (prefers-reduced-motion: reduce) {
  .arivu-ai-orb__ring,
  .arivu-ai-orb--invite,
  .arivu-ai-orb__dot {
    animation: none;
  }
}

:global(html.dark) .arivu-ai-orb__face {
  background: rgb(23 23 23);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
}

:global(html.dark) .arivu-ai-orb__dot {
  box-shadow: 0 0 0 2px rgb(23 23 23);
}

:global(html.dark) .arivu-ai-orb:focus-visible {
  box-shadow:
    0 0 0 2px rgb(23 23 23),
    0 0 0 4px var(--ai-c1);
}
</style>

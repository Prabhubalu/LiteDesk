<template>
  <div
    class="arivu-shimmer-logo"
    :aria-hidden="ariaHidden"
    :style="maskStyle"
  >
    <img
      :src="logoSrc"
      alt=""
      :class="imgClass"
      decoding="async"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useColorMode } from '@/composables/useColorMode';

const LOGO_LIGHT_SRC = '/assets/logo/Logo_light.svg';
const LOGO_DARK_SRC = '/assets/logo/Logo_dark.svg';

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    /** Set false when the logo is the sole accessible name for a status region */
    ariaHidden?: boolean;
  }>(),
  { size: 'md', ariaHidden: true },
);

const { effectiveDark } = useColorMode();

/** Dark UI → light glyph; light UI → dark glyph */
const logoSrc = computed(() => (effectiveDark.value ? LOGO_LIGHT_SRC : LOGO_DARK_SRC));

const maskStyle = computed(() => {
  const url = `url('${logoSrc.value}')`;
  return {
    '--arivu-logo-mask': url,
  } as Record<string, string>;
});

const imgClass = computed(() => {
  if (props.size === 'sm') return 'h-8 w-auto object-contain';
  if (props.size === 'lg') return 'h-16 w-auto object-contain sm:h-[4.5rem]';
  return 'h-12 w-auto object-contain';
});
</script>

<style scoped>
.arivu-shimmer-logo {
  position: relative;
  display: inline-flex;
  isolation: isolate;
}

.arivu-shimmer-logo img {
  position: relative;
  z-index: 0;
  display: block;
  filter: drop-shadow(0 8px 20px rgb(15 23 42 / 0.12));
}

.arivu-shimmer-logo::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.12) 40%,
    rgb(255 255 255 / 0.85) 50%,
    rgb(255 255 255 / 0.12) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
  animation: arivu-shimmer-logo-sweep 2.8s linear infinite;
  pointer-events: none;
  -webkit-mask-image: var(--arivu-logo-mask);
  mask-image: var(--arivu-logo-mask);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  will-change: background-position;
}

:global(html.dark) .arivu-shimmer-logo::after {
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.1) 40%,
    rgb(255 255 255 / 0.7) 50%,
    rgb(255 255 255 / 0.1) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
}

:global(html.dark) .arivu-shimmer-logo img {
  filter: drop-shadow(0 8px 20px rgb(0 0 0 / 0.35));
}

@keyframes arivu-shimmer-logo-sweep {
  0% {
    background-position: 140% 0;
  }
  100% {
    background-position: -40% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .arivu-shimmer-logo::after {
    animation: none;
    opacity: 0;
  }
}
</style>

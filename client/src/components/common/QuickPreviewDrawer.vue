<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-transform ease-out duration-300"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform ease-in duration-300"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="show"
        @click.stop
        class="fixed right-0 w-full max-w-3xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden z-[9999] record-right-pane-drawer"
        :style="{
          top: 'var(--quickpreview-offset, 4rem)',
          height: 'calc(100vh - var(--quickpreview-offset, 4rem))'
        }"
      >
        <div v-if="!row" class="flex-1 flex items-center justify-center p-8">
          <div class="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
        <ModuleRecordPage
          v-else
          embed
          :record-id="row._id"
          :module-key="moduleKey"
          class="flex-1 min-h-0 overflow-hidden"
          @close="$emit('close')"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref, watch, onMounted, onUnmounted, nextTick, provide } from 'vue';
import ModuleRecordPage from '@/pages/ModuleRecordPage.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  row: {
    type: Object,
    default: null
  },
  columns: {
    type: Array,
    required: true
  },
  moduleTitle: {
    type: String,
    required: true
  },
  moduleKey: {
    type: String,
    required: true
  },
  /** When true, show Previous button (quick preview prev/next). */
  canNavigatePrevious: {
    type: Boolean,
    default: false
  },
  /** When true, show Next button (quick preview prev/next). */
  canNavigateNext: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'update', 'navigate-prev', 'navigate-next']);

const { t } = useI18n();

// Provide quick-preview prev/next so embedded record pages (Task, Deal, Generic) can show them in the right-pane header
provide('quickPreviewNav', computed(() => ({
  canPrevious: props.canNavigatePrevious,
  canNext: props.canNavigateNext,
  onPrev: () => emit('navigate-prev'),
  onNext: () => emit('navigate-next')
})));

// Provide RecordPageLayout mobile context so embedded record page behaves as mobile view
provide('recordLayoutIsMobile', ref(true));
provide('recordLayoutSummaryTeleportReady', ref(false));

// Prevent body scroll when drawer is open
const preventBodyScroll = () => {
  if (props.show) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
};

const updateQuickPreviewOffset = () => {
  const allFixedElements = Array.from(document.querySelectorAll('[class*="fixed"]'));
  const tabbar = allFixedElements.find(el => {
    const styles = getComputedStyle(el);
    const classes = el.className || '';
    return (
      styles.position === 'fixed' &&
      styles.zIndex === '30' &&
      (classes.includes('border-b') || classes.includes('border-gray')) &&
      el.querySelector('[class*="flex"]')
    );
  });

  if (tabbar) {
    const rect = tabbar.getBoundingClientRect();
    const calculatedOffset = Math.round(rect.bottom);
    if (calculatedOffset > 0) {
      document.documentElement.style.setProperty('--quickpreview-offset', `${calculatedOffset}px`);
      return;
    }
  }

  const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--tabbar-offset');
  if (cssVar && cssVar.trim()) {
    const value = parseInt(cssVar.trim());
    if (!isNaN(value) && value > 0) {
      document.documentElement.style.setProperty('--quickpreview-offset', `${value}px`);
      return;
    }
  }

  const isMobile = window.innerWidth < 1024;
  const fallbackOffset = isMobile ? 112 : 48;
  document.documentElement.style.setProperty('--quickpreview-offset', `${fallbackOffset}px`);
};

const resetDrawerScrollPosition = () => {
  nextTick(() => {
    const drawer = document.querySelector('.record-right-pane-drawer');
    if (!drawer) return;
    const scrollables = drawer.querySelectorAll('.overflow-y-auto, .overflow-auto, [style*="overflow"]');
    scrollables.forEach((el) => {
      if (el.scrollLeft !== 0) {
        el.scrollLeft = 0;
      }
    });
  });
};

// Keyboard: Prev/Next in quick preview (Ctrl/Cmd + Left/Right)
const handleDrawerKeydown = (e) => {
  if (!props.show) return;
  if (e.repeat) return;
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (!ctrlOrMeta) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isEditable = tag === 'input' || tag === 'textarea' || document.activeElement?.getAttribute?.('contenteditable') === 'true';
  if (isEditable) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (props.canNavigatePrevious) emit('navigate-prev');
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (props.canNavigateNext) emit('navigate-next');
  }
};

watch(() => props.show, (newVal) => {
  if (newVal) {
    preventBodyScroll();
    resetDrawerScrollPosition();
    setTimeout(resetDrawerScrollPosition, 50);
    nextTick(() => {
      updateQuickPreviewOffset();
      setTimeout(() => updateQuickPreviewOffset(), 100);
    });
  } else {
    preventBodyScroll();
    document.documentElement.style.removeProperty('--quickpreview-offset');
  }
});

const handleResize = () => {
  if (props.show) updateQuickPreviewOffset();
};

const handleSidebarToggle = () => {
  if (props.show) setTimeout(() => updateQuickPreviewOffset(), 350);
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && props.show) resetDrawerScrollPosition();
};

let observer = null;

onMounted(() => {
  updateQuickPreviewOffset();
  window.addEventListener('resize', handleResize);
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('keydown', handleDrawerKeydown);

  observer = new MutationObserver(() => {
    if (props.show) updateQuickPreviewOffset();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style']
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.removeEventListener('keydown', handleDrawerKeydown);
  if (observer) observer.disconnect();
  document.body.style.overflow = '';
  document.documentElement.style.removeProperty('--quickpreview-offset');
});
</script>


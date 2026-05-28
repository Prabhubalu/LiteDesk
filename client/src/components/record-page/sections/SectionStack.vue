<template>
  <div class="space-y-10">
    <section
      v-for="(section, index) in visibleSections"
      :key="getSectionKey(section, index)"
      :class="getSectionClass(section)"
    >
      <div class="pb-2 flex items-center justify-between gap-3">
        <h3 :class="getSectionTitleClass()">{{ section.title }}</h3>
        <div v-if="section.actions?.length" class="inline-flex items-center gap-1.5">
          <button
            v-for="(action, actionIndex) in section.actions"
            :key="`${getSectionKey(section, index)}-action-${action.key || action.type || actionIndex}`"
            type="button"
            :class="getActionClass(action)"
            :aria-label="action.label || action.type || 'Section action'"
            :title="action.label || action.type || t('records.sectionActionFallback')"
            @click="handleAction(action, section)"
          >
            <component
              v-if="resolveActionIcon(action)"
              :is="resolveActionIcon(action)"
              :class="getActionIconClass(action)"
            />
            <span v-else-if="action.type !== 'expand'" class="text-xs font-semibold">{{ action.label || action.type }}</span>
            <span v-if="action.type !== 'expand' && resolveActionIcon(action)" class="text-xs font-semibold">{{ action.label || action.type }}</span>
          </button>
        </div>
      </div>

      <component
        :is="section.component"
        :record="record"
        :adapter="adapter"
        :context="getSectionContext(section)"
        @updated="(payload) => props.context?.onSectionUpdated?.({ sectionKey: section.key, payload })"
      />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { PlusIcon, ArrowsPointingOutIcon, LinkIcon, BoltIcon, ClockIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  sections: { type: Array, default: () => [] },
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({ module: '' })
  }
});

const isExpandedMode = computed(() => Boolean(props.context?.expandedLeftSection));

const ACTION_ICON_MAP = {
  plus: PlusIcon,
  add: PlusIcon,
  expand: ArrowsPointingOutIcon,
  history: ClockIcon,
  link: LinkIcon,
  quick: BoltIcon,
  bolt: BoltIcon
};

const normalizeSection = (section, index) => {
  if (!section) return null;

  if (typeof section === 'object' && section.component) {
    return {
      key: section.key || section.component?.name || section.component?.__name || `section-${index}`,
      title: section.title || section.component?.name || 'Section',
      component: section.component,
      className: section.className || '',
      actions: Array.isArray(section.actions) ? section.actions : []
    };
  }

  return {
    key: section?.name || section?.__name || `section-${index}`,
    title: section?.name || section?.__name || 'Section',
    component: section,
    className: '',
    actions: []
  };
};

const visibleSections = computed(() => {
  return (props.sections || []).map((section, index) => normalizeSection(section, index)).filter((section) => {
    if (!section || !section.component) return false;
    if (typeof props.adapter?.shouldRenderSection === 'function') {
      return props.adapter.shouldRenderSection(section, props.record, props.context) !== false;
    }
    return true;
  });
});

const getSectionKey = (section, index) => {
  return section?.key || section?.component?.name || section?.component?.__name || `section-${index}`;
};

const getSectionClass = (section) => {
  return ['group/section-stack', section?.className || ''];
};

const resolveActionIcon = (action) => {
  const candidate = action?.icon || action?.type;
  if (!candidate) return null;
  return ACTION_ICON_MAP[String(candidate).trim().toLowerCase()] || null;
};

const getSectionTitleClass = () => {
  return [
    'font-semibold text-gray-900 dark:text-white',
    isExpandedMode.value ? 'text-2xl' : 'text-base'
  ];
};

const getActionClass = (action) => {
  return [
    'inline-flex items-center justify-center gap-1.5 h-8 px-1.5 rounded-md border border-gray-200 bg-white text-gray-600 opacity-100 transition-opacity hover:text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800',
    isExpandedMode.value
      ? 'lg:opacity-100'
      : 'lg:opacity-0 lg:group-hover/section-stack:opacity-100',
    action?.type === 'expand' ? 'w-8 h-8 px-0 justify-center' : ''
  ];
};

const getActionIconClass = (action) => {
  return action?.type === 'expand' ? 'h-6 w-6' : 'h-4 w-4';
};

const getSectionContext = (section) => {
  return {
    ...props.context,
    sectionKey: section?.key,
    hideHeader: true
  };
};

const handleAction = (action, section) => {
  if (!action || !section) return;

  if (typeof action.handler === 'function') {
    action.handler({ action, section, record: props.record, context: props.context, adapter: props.adapter });
    return;
  }

  if (typeof props.adapter?.invokeSectionAction === 'function') {
    props.adapter.invokeSectionAction(action, {
      section,
      record: props.record,
      context: props.context
    });
  }
};
</script>

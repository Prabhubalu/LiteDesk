<template>
  <Disclosure
    v-slot="{ open }"
    as="section"
    :default-open="defaultOpen"
    :class="['border-t', ui.border, bordered ? 'pt-2' : 'border-t-0 pt-0']"
  >
    <DisclosureButton :class="ui.disclosureBtn">
      <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{{ title }}</span>
      <ChevronDownIcon
        class="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </DisclosureButton>
    <DisclosurePanel :class="ui.disclosurePanel">
      <slot />
    </DisclosurePanel>
  </Disclosure>
</template>

<script setup>
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  title: { type: String, required: true },
  defaultOpen: { type: Boolean, default: true },
  bordered: { type: Boolean, default: true }
});

const ui = useBuilderUi();
</script>

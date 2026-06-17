<template>
  <div :class="[actionsContainerClasses(), actionsAlignClasses(formActions.align)]">
    <div
      v-for="item in visibleActionItems"
      :key="item.key"
      :class="[selectableWrapperClass(item.key), actionOuterClass(item.key)]"
      @click.stop="handleSelect(item.key)"
    >
      <component
        :is="staticPreview ? 'div' : 'button'"
        :type="item.submitType"
        class="rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition"
        :class="[
          item.colorClass,
          actionInnerClass(item.key),
          staticPreview ? 'pointer-events-none' : 'disabled:opacity-60',
          builderMutedClass(),
        ]"
        :disabled="staticPreview ? undefined : (disabled || submitting)"
        @click="item.onClick?.($event)"
      >
        {{ item.label }}
      </component>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  actionsAlignClasses,
  actionsContainerClasses,
  buttonColorClasses,
  buttonWidthClasses,
  mergeFormActions,
  resolveButtonLabel
} from '@/utils/webformFormActions';
import { WEBFORM_FIELD_SELECTED_CLASS, WEBFORM_THEMED_PRIMARY_BTN_CLASS } from '@/utils/webformUiClasses';

const props = defineProps({
  formActions: { type: Object, default: () => ({}) },
  preview: { type: Boolean, default: false },
  staticPreview: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
  selectedButtonKey: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  submitLabel: { type: String, default: '' },
  themeColor: { type: String, default: '' },
  stepMode: { type: Boolean, default: false },
  showBack: { type: Boolean, default: false },
  showNext: { type: Boolean, default: false },
  showSubmit: { type: Boolean, default: true }
});

const emit = defineEmits(['reset', 'back', 'next', 'select-button']);

const { t } = useI18n();

const formActions = computed(() => mergeFormActions(props.formActions));

const themedAccent = computed(() => /^#[0-9a-f]{6}$/i.test(String(props.themeColor || '').trim()));

const pairedWithBack = computed(() => {
  if (!props.stepMode || !props.showBack || !props.showSubmit) return false;
  const width = formActions.value.submit.width;
  return width === 'full' || width === 'half';
});

function themedPrimaryClass(color) {
  if (themedAccent.value && color === 'blue') return WEBFORM_THEMED_PRIMARY_BTN_CLASS;
  return buttonColorClasses(color);
}

const visibleActionItems = computed(() => {
  const items = [];
  const actions = formActions.value;

  if (actions.cancel.enabled) {
    items.push({
      key: 'cancel',
      label: resolveButtonLabel(actions.cancel.label, t('webforms.formActionCancel')),
      colorClass: buttonColorClasses(actions.cancel.color),
      submitType: props.staticPreview ? undefined : 'button',
      onClick: () => !props.staticPreview && handleCancel()
    });
  }

  if (actions.reset.enabled) {
    items.push({
      key: 'reset',
      label: resolveButtonLabel(actions.reset.label, t('webforms.formActionReset')),
      colorClass: buttonColorClasses(actions.reset.color),
      submitType: props.staticPreview ? undefined : 'button',
      onClick: () => !props.staticPreview && emit('reset')
    });
  }

  if (props.stepMode && props.showBack) {
    items.push({
      key: 'back',
      label: resolveButtonLabel(actions.back.label, t('webforms.multiStepBack')),
      colorClass: buttonColorClasses(actions.back.color),
      submitType: props.staticPreview ? undefined : 'button',
      onClick: () => !props.staticPreview && emit('back')
    });
  }

  if (props.stepMode && props.showNext) {
    items.push({
      key: 'next',
      label: resolveButtonLabel(actions.next.label, t('webforms.multiStepNext')),
      colorClass: buttonColorClasses(actions.next.color),
      submitType: props.staticPreview ? undefined : 'button',
      onClick: () => !props.staticPreview && emit('next')
    });
  }

  if (props.showSubmit) {
    items.push({
      key: 'submit',
      label: props.submitting
        ? t('webforms.publicSubmitting')
        : (props.submitLabel || resolveButtonLabel(actions.submit.label, t('webforms.publicSubmit'))),
      colorClass: themedPrimaryClass(actions.submit.color),
      submitType: props.staticPreview ? undefined : 'submit',
      onClick: undefined
    });
  }

  return items;
});

function actionWidthOptions(key) {
  return {
    paired: key === 'submit' && pairedWithBack.value
  };
}

function actionOuterClass(key) {
  if (!props.selectable) return '';
  const width = formActions.value[key]?.width || 'fit';
  return buttonWidthClasses(width, formActions.value.align, actionWidthOptions(key));
}

function actionInnerClass(key) {
  const width = formActions.value[key]?.width || 'fit';
  const layout = buttonWidthClasses(width, formActions.value.align, actionWidthOptions(key));
  if (!props.selectable) {
    return [layout, width === 'fit' ? 'inline-block' : 'block min-w-0'].filter(Boolean).join(' ');
  }
  return width === 'fit' ? 'inline-block w-auto max-w-full' : 'block w-full min-w-0';
}

function selectableWrapperClass(key) {
  if (!props.selectable) return 'contents';
  return [
    'min-w-0 rounded-lg border-2 p-0.5 transition cursor-pointer',
    props.selectedButtonKey === key
      ? WEBFORM_FIELD_SELECTED_CLASS
      : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600'
  ];
}

function builderMutedClass() {
  return props.staticPreview ? 'opacity-90' : '';
}

function handleSelect(key) {
  if (!props.selectable) return;
  emit('select-button', key);
}

function handleCancel() {
  const url = String(formActions.value.cancel.redirectUrl || '').trim();
  if (url && !props.preview) {
    window.location.href = url;
    return;
  }
  emit('reset');
}
</script>

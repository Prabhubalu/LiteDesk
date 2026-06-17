<template>
  <div :class="[actionsContainerClasses(), actionsAlignClasses(formActions.align)]">
    <component
      :is="staticPreview ? 'div' : 'button'"
      v-if="formActions.cancel.enabled"
      :type="staticPreview ? undefined : 'button'"
      class="rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition"
      :class="[
        buttonColorClasses(formActions.cancel.color),
        buttonWidthClasses(formActions.cancel.width, formActions.align),
        staticPreview ? 'pointer-events-none opacity-90' : 'disabled:opacity-60'
      ]"
      :disabled="staticPreview ? undefined : (disabled || submitting)"
      @click="!staticPreview && handleCancel()"
    >
      {{ cancelLabel }}
    </component>

    <component
      :is="staticPreview ? 'div' : 'button'"
      v-if="formActions.reset.enabled"
      :type="staticPreview ? undefined : 'button'"
      class="rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition"
      :class="[
        buttonColorClasses(formActions.reset.color),
        buttonWidthClasses(formActions.reset.width, formActions.align),
        staticPreview ? 'pointer-events-none opacity-90' : 'disabled:opacity-60'
      ]"
      :disabled="staticPreview ? undefined : (disabled || submitting)"
      @click="!staticPreview && emit('reset')"
    >
      {{ resetLabel }}
    </component>

    <component
      :is="staticPreview ? 'div' : 'button'"
      v-if="stepMode && showBack"
      :type="staticPreview ? undefined : 'button'"
      class="rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition"
      :class="[
        secondaryButtonClass(formActions.back.color),
        buttonWidthClasses(formActions.back.width, formActions.align),
        staticPreview ? 'pointer-events-none opacity-90' : 'disabled:opacity-60'
      ]"
      :disabled="staticPreview ? undefined : (disabled || submitting)"
      @click="!staticPreview && emit('back')"
    >
      {{ backLabelResolved }}
    </component>

    <component
      :is="staticPreview ? 'div' : 'button'"
      v-if="stepMode && showNext"
      :type="staticPreview ? undefined : 'button'"
      class="rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition"
      :class="[
        secondaryButtonClass(formActions.next.color),
        buttonWidthClasses(formActions.next.width, formActions.align),
        staticPreview ? 'pointer-events-none opacity-90' : 'disabled:opacity-60'
      ]"
      :disabled="staticPreview ? undefined : (disabled || submitting)"
      @click="!staticPreview && emit('next')"
    >
      {{ nextLabelResolved }}
    </component>

    <component
      :is="staticPreview ? 'div' : 'button'"
      v-if="showSubmit"
      :type="staticPreview ? undefined : 'submit'"
      class="rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition"
      :class="[
        submitButtonClass,
        buttonWidthClasses(formActions.submit.width, formActions.align, { paired: pairedWithBack }),
        staticPreview ? 'pointer-events-none opacity-90' : 'disabled:opacity-60'
      ]"
      :style="submitButtonStyle"
      :disabled="staticPreview ? undefined : (disabled || submitting)"
    >
      {{ submitLabelResolved }}
    </component>
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

const props = defineProps({
  formActions: { type: Object, default: () => ({}) },
  preview: { type: Boolean, default: false },
  staticPreview: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  submitLabel: { type: String, default: '' },
  themeColor: { type: String, default: '' },
  stepMode: { type: Boolean, default: false },
  showBack: { type: Boolean, default: false },
  showNext: { type: Boolean, default: false },
  showSubmit: { type: Boolean, default: true }
});

const emit = defineEmits(['reset', 'back', 'next']);

const { t } = useI18n();

const formActions = computed(() => mergeFormActions(props.formActions));

const pairedWithBack = computed(() => {
  if (!props.stepMode || !props.showBack || !props.showSubmit) return false;
  const width = formActions.value.submit.width;
  return width === 'full' || width === 'half';
});

const submitLabelResolved = computed(() => {
  if (props.submitting) return t('webforms.publicSubmitting');
  if (props.submitLabel) return props.submitLabel;
  return resolveButtonLabel(formActions.value.submit.label, t('webforms.publicSubmit'));
});

const resetLabel = computed(() =>
  resolveButtonLabel(formActions.value.reset.label, t('webforms.formActionReset'))
);

const cancelLabel = computed(() =>
  resolveButtonLabel(formActions.value.cancel.label, t('webforms.formActionCancel'))
);

const backLabelResolved = computed(() =>
  resolveButtonLabel(formActions.value.back.label, t('webforms.multiStepBack'))
);

const nextLabelResolved = computed(() =>
  resolveButtonLabel(formActions.value.next.label, t('webforms.multiStepNext'))
);

const themedAccent = computed(() => /^#[0-9a-f]{6}$/i.test(String(props.themeColor || '').trim()));

function secondaryButtonClass(color) {
  return buttonColorClasses(color);
}

function themedPrimaryClass(color) {
  if (themedAccent.value && color === 'blue') return 'text-white hover:opacity-90';
  return buttonColorClasses(color);
}

function themedPrimaryStyle(color) {
  if (!themedAccent.value || color !== 'blue') return undefined;
  return { backgroundColor: String(props.themeColor).trim() };
}

const submitButtonClass = computed(() => themedPrimaryClass(formActions.value.submit.color));
const submitButtonStyle = computed(() => themedPrimaryStyle(formActions.value.submit.color));

function handleCancel() {
  const url = String(formActions.value.cancel.redirectUrl || '').trim();
  if (url && !props.preview) {
    window.location.href = url;
    return;
  }
  emit('reset');
}
</script>

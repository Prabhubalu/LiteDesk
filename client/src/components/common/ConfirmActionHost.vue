<template>
  <DeleteConfirmationModal
    :show="confirmActionState.show"
    :title="confirmActionState.title"
    :message="confirmActionState.message"
    :confirm-label="confirmActionState.confirmLabel"
    :secondary-label="confirmActionState.secondaryLabel"
    :cancel-label="confirmActionState.cancelLabel"
    :tone="confirmActionState.tone"
    @close="resolveConfirmAction(confirmActionState.mode === 'choice' ? 'cancel' : false)"
    @confirm="resolveConfirmAction(confirmActionState.mode === 'choice' ? 'confirm' : true)"
    @secondary="resolveConfirmAction('secondary')"
  />
</template>

<script setup>
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import {
  confirmActionState,
  resolveConfirmAction
} from '@/composables/useConfirmAction';
</script>

<template>
  <DeleteConfirmationModal
    :show="confirmActionState.show"
    :title="confirmActionState.title"
    :message="confirmActionState.message"
    :confirm-label="confirmActionState.confirmLabel"
    :tone="confirmActionState.tone"
    @close="resolveConfirmAction(false)"
    @confirm="resolveConfirmAction(true)"
  />
</template>

<script setup>
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import {
  confirmActionState,
  resolveConfirmAction
} from '@/composables/useConfirmAction';
</script>

<!--
  RecognitionOnly - Semantic wrapper component
  Purpose: Prevent action creep in recognition-first components
  
  This component is a no-op visually but serves as a guardrail:
  - Documents that content is recognition-only
  - Prevents accidental addition of primary actions
  - Prevents workflow state or inline editing by default
  
  Usage: Wrap IdentityLayer content to enforce recognition-only contract
-->
<template>
  <div>
    <slot></slot>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
// RecognitionOnly - Semantic wrapper
// No props, no logic, pure guardrail component
</script>


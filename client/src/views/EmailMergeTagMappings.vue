<template>
  <div class="mx-auto w-full">
    <TemplatesModuleNav />
    <div class="max-w-5xl space-y-6">
      <OrgMergeTagMappingsPanel />
      <OrgEmailCssAllowlistPanel />
    </div>
  </div>
</template>

<script setup>
import TemplatesModuleNav from '@/components/templates/TemplatesModuleNav.vue';
import OrgMergeTagMappingsPanel from '@/modules/template/components/html/OrgMergeTagMappingsPanel.vue';
import OrgEmailCssAllowlistPanel from '@/modules/template/components/html/OrgEmailCssAllowlistPanel.vue';
</script>

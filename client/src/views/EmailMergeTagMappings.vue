<template>
  <div class="mx-auto w-full max-w-5xl">
    <TemplatesModuleNav />
    <OrgMergeTagMappingsPanel />
    <OrgEmailCssAllowlistPanel />
  </div>
</template>

<script setup>
import TemplatesModuleNav from '@/components/templates/TemplatesModuleNav.vue';
import OrgMergeTagMappingsPanel from '@/modules/template/components/html/OrgMergeTagMappingsPanel.vue';
import OrgEmailCssAllowlistPanel from '@/modules/template/components/html/OrgEmailCssAllowlistPanel.vue';
</script>

import { ref } from 'vue';
import {
  fetchOrgMergeMappings,
  saveOrgMergeMappings,
  type MergeMapping,
  type MergeMappingRecord
} from '../services/htmlImportApi';
import { captureEmailTemplateMergeMappingsSaved } from '@/config/posthogTemplates';

export function applyOrgMappingsToTags(
  orgMappings: MergeMappingRecord,
  tagRaws: string[],
  target: Record<string, MergeMapping>
): number {
  let applied = 0;
  for (const raw of tagRaws) {
    const saved = orgMappings[raw];
    if (!saved) continue;
    target[raw] = saved.skip ? { skip: true } : { path: saved.path, skip: false };
    applied += 1;
  }
  return applied;
}

export function pickMappingsToPersist(
  mappings: MergeMappingRecord
): MergeMappingRecord {
  const output: MergeMappingRecord = {};
  for (const [raw, mapping] of Object.entries(mappings || {})) {
    if (!raw || !mapping) continue;
    if (mapping.skip) {
      output[raw] = { skip: true };
      continue;
    }
    if (mapping.path) {
      output[raw] = { path: mapping.path, skip: false };
    }
  }
  return output;
}

export function useOrgMergeMappings() {
  const orgMappings = ref<MergeMappingRecord>({});
  const loading = ref(false);
  const saving = ref(false);

  async function loadOrgMappings() {
    loading.value = true;
    try {
      orgMappings.value = await fetchOrgMergeMappings();
      return orgMappings.value;
    } finally {
      loading.value = false;
    }
  }

  async function persistMappings(mappings: MergeMappingRecord) {
    const payload = pickMappingsToPersist(mappings);
    if (!Object.keys(payload).length) return orgMappings.value;

    saving.value = true;
    try {
      orgMappings.value = await saveOrgMergeMappings(payload);
      captureEmailTemplateMergeMappingsSaved({ count: Object.keys(payload).length });
      return orgMappings.value;
    } finally {
      saving.value = false;
    }
  }

  async function replaceMappings(mappings: MergeMappingRecord) {
    saving.value = true;
    try {
      orgMappings.value = await saveOrgMergeMappings(mappings, { replace: true });
      captureEmailTemplateMergeMappingsSaved({ count: Object.keys(mappings).length });
      return orgMappings.value;
    } finally {
      saving.value = false;
    }
  }

  return {
    orgMappings,
    loading,
    saving,
    loadOrgMappings,
    persistMappings,
    replaceMappings,
    applyOrgMappingsToTags
  };
}

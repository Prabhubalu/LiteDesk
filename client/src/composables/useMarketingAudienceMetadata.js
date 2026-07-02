import { ref } from 'vue';
import apiClient from '@/utils/apiClient';

export function useMarketingAudienceMetadata() {
  const metadata = ref(null);
  const loading = ref(false);
  const error = ref(null);

  async function fetchMetadata(options = {}) {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.get('/marketing/segments/metadata', {
        params: {
          primaryModuleKey: options.primaryModuleKey || undefined
        },
        cache: 'no-store'
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to load audience metadata');
      }
      metadata.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function getModuleFields(moduleKey) {
    return metadata.value?.modules?.[moduleKey]?.fields || [];
  }

  function getRelationshipOptions(fromModuleKey) {
    const graph = metadata.value?.relationshipGraph || {};
    const keys = graph[fromModuleKey] || [];
    const rels = metadata.value?.relationships || [];
    return keys
      .map((relationshipKey) => rels.find((row) => row.relationshipKey === relationshipKey))
      .filter(Boolean);
  }

  function resolvePathTargetModule(relationshipPath) {
    if (!relationshipPath?.length) return null;
    let current = metadata.value?.primaryEntity?.moduleKey || 'people';
    const rels = metadata.value?.relationships || [];
    for (const key of relationshipPath) {
      const edge = rels.find(
        (row) => row.fromModuleKey === current && row.relationshipKey === key
      );
      if (!edge) return null;
      current = edge.toModuleKey;
    }
    return current;
  }

  return {
    metadata,
    loading,
    error,
    fetchMetadata,
    getModuleFields,
    getRelationshipOptions,
    resolvePathTargetModule
  };
}

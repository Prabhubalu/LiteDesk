import { ref } from 'vue';

/** Incremented when tenant org participation types change so composables can refetch. */
export const organizationParticipationTypesCacheVersion = ref(0);

export function invalidateOrganizationParticipationTypesCache() {
  organizationParticipationTypesCacheVersion.value += 1;
}

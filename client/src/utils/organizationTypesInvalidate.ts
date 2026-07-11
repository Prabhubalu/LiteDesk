import { ref } from 'vue';

export const organizationTypesCacheVersion = ref(0);

export function invalidateOrganizationTypesCache(): void {
  organizationTypesCacheVersion.value += 1;
}

<template>
  <div class="organization-detail">
    <div class="page-header">
      <button @click="goBack" class="btn-back">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Organizations
      </button>
    </div>

    <div v-if="loading" class="loading">Loading organization...</div>

    <div v-else-if="organization" class="content">
      <div class="organization-header">
        <div class="org-avatar">{{ getInitials(organization.name) }}</div>
        <div class="org-info">
          <h1>{{ organization.name }}</h1>
          <p class="industry">{{ organization.industry || 'No industry specified' }}</p>
          <div class="badges">
            <span :class="['badge', 'tier', organization.subscription?.tier]">
              {{ organization.subscription?.tier || 'trial' }}
            </span>
            <span :class="['badge', 'status', organization.isActive ? 'active' : 'inactive']">
              {{ organization.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Contacts</h3>
          <p class="stat-value">{{ organizationStats.contacts || 0 }}</p>
        </div>
        <div class="stat-card">
          <h3>Users</h3>
          <p class="stat-value">{{ organizationStats.users || 0 }}</p>
        </div>
        <div class="stat-card">
          <h3>Deals</h3>
          <p class="stat-value">{{ organizationStats.deals || 0 }}</p>
        </div>
        <div class="stat-card">
          <h3>Created</h3>
          <p class="stat-value">{{ formatDate(organization.createdAt) }}</p>
        </div>
      </div>

      <!-- Details -->
      <div class="details-section">
        <h2>Organization Details</h2>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Slug</label>
            <p>{{ organization.slug }}</p>
          </div>
          <div class="detail-item">
            <label>Industry</label>
            <p>{{ organization.industry || '-' }}</p>
          </div>
          <div class="detail-item">
            <label>Subscription Tier</label>
            <p>{{ organization.subscription?.tier || 'trial' }}</p>
          </div>
          <div class="detail-item">
            <label>Subscription Status</label>
            <p>{{ organization.subscription?.status || 'trial' }}</p>
          </div>
          <div class="detail-item">
            <label>Enabled Modules</label>
            <p>{{ (organization.enabledModules || []).join(', ') || 'None' }}</p>
          </div>
          <div class="detail-item">
            <label>Max Users</label>
            <p>{{ organization.limits?.maxUsers || 0 }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>Organization not found</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';

const router = useRouter();
const route = useRoute();

const organization = ref(null);
const organizationStats = ref({
  contacts: 0,
  users: 0,
  deals: 0
});
const loading = ref(false);

const fetchOrganization = async () => {
  loading.value = true;
  try {
    // This endpoint doesn't exist yet, but we can create it later
    const data = await apiClient(`/admin/organizations/${route.params.id}`, {
      method: 'GET'
    });
    
    if (data.success) {
      organization.value = data.data;
      organizationStats.value = data.stats || organizationStats.value;
    }
  } catch (error) {
    console.error('Error fetching organization:', error);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/organizations');
};

const getInitials = (name) => {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

onMounted(() => {
  fetchOrganization();
});
</script>

<style scoped>
.organization-detail {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  color: #374151;
  font-weight: 500;
}

.btn-back svg {
  width: 20px;
  height: 20px;
}

.btn-back:hover {
  background: #f9fafb;
}

.organization-header {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}

.org-avatar {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.5rem;
}

.org-info h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.industry {
  color: #6b7280;
  margin-bottom: 1rem;
}

.badges {
  display: flex;
  gap: 0.5rem;
}

.badge {
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.tier.trial {
  background: #fef3c7;
  color: #92400e;
}

.badge.tier.starter {
  background: #dbeafe;
  color: #1e40af;
}

.badge.tier.professional {
  background: #ddd6fe;
  color: #5b21b6;
}

.badge.tier.enterprise {
  background: #d1fae5;
  color: #065f46;
}

.badge.status.active {
  background: #d1fae5;
  color: #065f46;
}

.badge.status.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-card h3 {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.details-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.details-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.detail-item label {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.detail-item p {
  color: #1f2937;
  font-size: 1rem;
}

.loading, .empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}
</style>


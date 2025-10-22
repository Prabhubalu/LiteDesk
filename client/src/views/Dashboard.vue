<template>
  <div class="dashboard">
    <!-- Trial Banner -->
    <div v-if="showTrialBanner" class="trial-banner" :class="{'urgent': trialDaysRemaining <= 3}">
      <div class="banner-content">
        <div class="banner-left">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p class="banner-title">
              <span v-if="trialDaysRemaining === 0">Your trial expires today!</span>
              <span v-else-if="trialDaysRemaining === 1">Your trial expires in 1 day</span>
              <span v-else>Your trial expires in {{ trialDaysRemaining }} days</span>
            </p>
            <p class="banner-subtitle">Upgrade now to continue using all features</p>
          </div>
        </div>
        <button @click="navigateToUpgrade" class="banner-button">
          Upgrade Now
        </button>
      </div>
    </div>

    <!-- Header -->
    <div class="dashboard-header">
      <div>
        <h1>Good {{ getTimeOfDay() }}, {{ userName }}! 👋</h1>
        <p class="subtitle">Here's what's happening with your business today.</p>
      </div>
      <div class="header-actions">
        <button @click="$router.push('/contacts?action=new')" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Contact
        </button>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon contacts">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div class="metric-info">
          <p class="metric-label">Total Contacts</p>
          <h3 class="metric-value">{{ contactStats.total || 0 }}</h3>
          <p class="metric-change positive" v-if="contactStats.newThisWeek > 0">
            +{{ contactStats.newThisWeek }} this week
          </p>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon leads">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div class="metric-info">
          <p class="metric-label">Active Leads</p>
          <h3 class="metric-value">{{ contactStats.leads || 0 }}</h3>
          <p class="metric-change">{{ contactStats.conversionRate || 0 }}% conversion</p>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon customers">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="metric-info">
          <p class="metric-label">Customers</p>
          <h3 class="metric-value">{{ contactStats.customers || 0 }}</h3>
          <p class="metric-change positive" v-if="contactStats.newCustomers > 0">
            +{{ contactStats.newCustomers }} new
          </p>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon activity">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="metric-info">
          <p class="metric-label">Activities Today</p>
          <h3 class="metric-value">{{ activityStats.today || 0 }}</h3>
          <p class="metric-change">{{ activityStats.pending || 0 }} pending</p>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Recent Contacts -->
      <div class="widget recent-contacts">
        <div class="widget-header">
          <h2>Recent Contacts</h2>
          <router-link to="/contacts" class="widget-link">View All</router-link>
        </div>
        
        <div v-if="loading" class="widget-loading">
          <div class="spinner"></div>
          <p>Loading contacts...</p>
        </div>

        <div v-else-if="recentContacts.length === 0" class="widget-empty">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>No contacts yet</p>
          <button @click="$router.push('/contacts')" class="btn-secondary">Add Your First Contact</button>
        </div>

        <div v-else class="contact-list">
          <div v-for="contact in recentContacts" :key="contact._id" class="contact-item" @click="$router.push(`/contacts/${contact._id}`)">
            <div class="contact-avatar">{{ getInitials(contact) }}</div>
            <div class="contact-info">
              <h4>{{ contact.first_name }} {{ contact.last_name }}</h4>
              <p>{{ contact.email }}</p>
            </div>
            <span :class="['contact-stage', contact.lifecycle_stage?.toLowerCase()]">
              {{ contact.lifecycle_stage || 'Lead' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Contact Growth Chart -->
      <div class="widget growth-chart">
        <div class="widget-header">
          <h2>Contact Growth</h2>
          <select v-model="chartPeriod" @change="fetchChartData" class="period-select">
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>

        <div class="chart-container">
          <svg class="growth-chart-svg" viewBox="0 0 400 200">
            <!-- Grid lines -->
            <line x1="40" y1="20" x2="40" y2="180" stroke="#e5e7eb" stroke-width="1"/>
            <line x1="40" y1="180" x2="380" y2="180" stroke="#e5e7eb" stroke-width="1"/>
            
            <!-- Y-axis labels -->
            <text x="30" y="25" text-anchor="end" font-size="10" fill="#9ca3af">{{ maxChartValue }}</text>
            <text x="30" y="105" text-anchor="end" font-size="10" fill="#9ca3af">{{ Math.floor(maxChartValue / 2) }}</text>
            <text x="30" y="185" text-anchor="end" font-size="10" fill="#9ca3af">0</text>
            
            <!-- Line chart -->
            <polyline
              :points="chartPoints"
              fill="none"
              stroke="#3b82f6"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            
            <!-- Area fill -->
            <polygon
              :points="chartAreaPoints"
              fill="url(#gradient)"
              opacity="0.3"
            />
            
            <!-- Gradient definition -->
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0" />
              </linearGradient>
            </defs>
            
            <!-- Data points -->
            <circle
              v-for="(point, index) in chartData"
              :key="index"
              :cx="40 + (index * (340 / (chartData.length - 1)))"
              :cy="180 - ((point.count / maxChartValue) * 160)"
              r="4"
              fill="#3b82f6"
            />
          </svg>
        </div>

        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color" style="background: #3b82f6;"></span>
            <span>Total Contacts</span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="widget quick-actions">
        <div class="widget-header">
          <h2>Quick Actions</h2>
        </div>
        
        <div class="actions-grid">
          <button @click="$router.push('/contacts?action=new')" class="action-button">
            <div class="action-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <span>Add Contact</span>
          </button>

          <button @click="$router.push('/contacts?action=import')" class="action-button">
            <div class="action-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span>Import Contacts</span>
          </button>

          <button @click="$router.push('/contacts')" class="action-button">
            <div class="action-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span>Search Contacts</span>
          </button>

          <button @click="exportContacts" class="action-button">
            <div class="action-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <span>Export Data</span>
          </button>
        </div>
      </div>

      <!-- Activity Feed -->
      <div class="widget activity-feed">
        <div class="widget-header">
          <h2>Recent Activity</h2>
        </div>

        <div v-if="recentActivity.length === 0" class="widget-empty">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No recent activity</p>
        </div>

        <div v-else class="activity-list">
          <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
            <div :class="['activity-icon', activity.type]">
              <svg v-if="activity.type === 'contact'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <svg v-else-if="activity.type === 'note'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="activity-content">
              <p class="activity-text">{{ activity.text }}</p>
              <p class="activity-time">{{ formatTime(activity.time) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';

const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const recentContacts = ref([]);
const contactStats = ref({
  total: 0,
  leads: 0,
  customers: 0,
  newThisWeek: 0,
  newCustomers: 0,
  conversionRate: 0
});
const activityStats = ref({
  today: 0,
  pending: 0
});
const chartData = ref([]);
const chartPeriod = ref('30');
const recentActivity = ref([]);

// Trial info
const trialDaysRemaining = ref(0);
const showTrialBanner = computed(() => {
  return authStore.isTrialActive && trialDaysRemaining.value >= 0;
});

const userName = computed(() => {
  return authStore.user?.firstName || authStore.user?.username || 'there';
});

// Chart computations
const maxChartValue = computed(() => {
  if (chartData.value.length === 0) return 100;
  const max = Math.max(...chartData.value.map(d => d.count));
  return Math.ceil(max / 10) * 10 || 100;
});

const chartPoints = computed(() => {
  if (chartData.value.length === 0) return '';
  return chartData.value.map((point, index) => {
    const x = 40 + (index * (340 / (chartData.value.length - 1)));
    const y = 180 - ((point.count / maxChartValue.value) * 160);
    return `${x},${y}`;
  }).join(' ');
});

const chartAreaPoints = computed(() => {
  if (chartData.value.length === 0) return '';
  const points = chartPoints.value;
  const lastX = 40 + ((chartData.value.length - 1) * (340 / (chartData.value.length - 1)));
  return `${points} ${lastX},180 40,180`;
});

// Methods
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

const getInitials = (contact) => {
  return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
};

const formatTime = (time) => {
  const date = new Date(time);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const getTrialDaysRemaining = () => {
  if (authStore.organization?.subscription?.trialEndDate) {
    const endDate = new Date(authStore.organization.subscription.trialEndDate);
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    trialDaysRemaining.value = Math.max(0, diffDays);
  }
};

const navigateToUpgrade = () => {
  router.push({ name: 'settings', query: { tab: 'subscription' } });
};

const fetchDashboardData = async () => {
  loading.value = true;
  
  try {
    // Fetch recent contacts
    const contactsData = await apiClient('/contacts?limit=5&sortBy=createdAt&sortOrder=desc', {
      method: 'GET'
    });
    
    if (contactsData.success) {
      recentContacts.value = contactsData.data;
      
      // Extract stats
      if (contactsData.statistics) {
        contactStats.value = {
          total: contactsData.statistics.totalContacts || 0,
          leads: contactsData.statistics.leadContacts || 0,
          customers: contactsData.statistics.customerContacts || 0,
          newThisWeek: contactsData.statistics.newThisWeek || 0,
          newCustomers: contactsData.statistics.newCustomers || 0,
          conversionRate: contactsData.statistics.conversionRate || 0
        };
      }
      
      // Generate activity feed
      recentActivity.value = recentContacts.value.slice(0, 5).map(contact => ({
        id: contact._id,
        type: 'contact',
        text: `New contact added: ${contact.first_name} ${contact.last_name}`,
        time: contact.createdAt
      }));
    }
    
    // Fetch chart data
    await fetchChartData();
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  } finally {
    loading.value = false;
  }
};

const fetchChartData = async () => {
  // Generate sample data for the chart
  // In production, this would come from an analytics API endpoint
  const days = parseInt(chartPeriod.value);
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString(),
      count: Math.floor(Math.random() * 20) + contactStats.value.total / days
    });
  }
  
  chartData.value = data;
};

const exportContacts = async () => {
  try {
    const data = await apiClient('/contacts?limit=10000', {
      method: 'GET'
    });
    
    if (data.success) {
      const csv = [
        ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Stage', 'Status'].join(','),
        ...data.data.map(c => [
          c.first_name,
          c.last_name,
          c.email,
          c.phone || '',
          c.account_id?.name || '',
          c.lifecycle_stage,
          c.status
        ].map(field => `"${field}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting contacts:', error);
  }
};

// Lifecycle
onMounted(() => {
  getTrialDaysRemaining();
  fetchDashboardData();
});
</script>

<style scoped>
.dashboard {
  padding: 2rem;
  max-width: 1800px;
  margin: 0 auto;
  background: #f9fafb;
  min-height: 100vh;
}

/* Trial Banner */
.trial-banner {
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 2rem;
}

.trial-banner.urgent {
  background: #fee2e2;
  border-color: #fecaca;
}

.banner-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.banner-left svg {
  width: 24px;
  height: 24px;
  color: #f59e0b;
}

.trial-banner.urgent svg {
  color: #dc2626;
}

.banner-title {
  font-weight: 600;
  color: #92400e;
  margin-bottom: 0.25rem;
}

.trial-banner.urgent .banner-title {
  color: #991b1b;
}

.banner-subtitle {
  font-size: 0.875rem;
  color: #b45309;
}

.trial-banner.urgent .banner-subtitle {
  color: #b91c1c;
}

.banner-button {
  padding: 0.75rem 1.5rem;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.trial-banner.urgent .banner-button {
  background: #dc2626;
}

.banner-button:hover {
  background: #d97706;
}

.trial-banner.urgent .banner-button:hover {
  background: #b91c1c;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6b7280;
  font-size: 0.95rem;
}

.header-actions .btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.header-actions .btn-primary:hover {
  background: #2563eb;
}

.header-actions .btn-primary svg {
  width: 20px;
  height: 20px;
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 1rem;
  transition: all 0.2s;
}

.metric-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.metric-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.metric-icon svg {
  width: 28px;
  height: 28px;
  color: white;
}

.metric-icon.contacts { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.metric-icon.leads { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.metric-icon.customers { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.metric-icon.activity { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }

.metric-info {
  flex: 1;
}

.metric-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.metric-change {
  font-size: 0.875rem;
  color: #6b7280;
}

.metric-change.positive {
  color: #059669;
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

/* Widget Styles */
.widget {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.widget-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.widget-link {
  font-size: 0.875rem;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.widget-link:hover {
  color: #2563eb;
}

.period-select {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

/* Loading & Empty States */
.widget-loading, .widget-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #9ca3af;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.widget-empty svg {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  color: #d1d5db;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 1rem;
}

/* Contact List */
.contact-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.contact-item:hover {
  background: #f9fafb;
}

.contact-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-info h4 {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.contact-info p {
  font-size: 0.8rem;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-stage {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.contact-stage.lead { background: #fef3c7; color: #92400e; }
.contact-stage.qualified { background: #dbeafe; color: #1e40af; }
.contact-stage.customer { background: #d1fae5; color: #065f46; }

/* Chart */
.chart-container {
  margin-bottom: 1rem;
}

.growth-chart-svg {
  width: 100%;
  height: 200px;
}

.chart-legend {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

/* Quick Actions */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover {
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.action-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon svg {
  width: 24px;
  height: 24px;
  color: white;
}

.action-button span {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

/* Activity Feed */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-icon.contact { background: #eff6ff; }
.activity-icon.note { background: #fef3c7; }

.activity-icon svg {
  width: 18px;
  height: 18px;
}

.activity-icon.contact svg { color: #3b82f6; }
.activity-icon.note svg { color: #f59e0b; }

.activity-content {
  flex: 1;
}

.activity-text {
  font-size: 0.9rem;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.activity-time {
  font-size: 0.8rem;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>

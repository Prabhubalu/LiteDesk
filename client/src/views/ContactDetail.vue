<template>
  <div class="contact-detail-page">
    <!-- Loading -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading contact...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <h2>Error loading contact</h2>
      <p>{{ error }}</p>
      <button @click="$router.push('/contacts')" class="btn-primary">Back to Contacts</button>
    </div>

    <!-- Contact Detail -->
    <div v-else-if="contact" class="contact-detail">
      <!-- Header -->
      <div class="detail-header">
        <button @click="$router.push('/contacts')" class="btn-back">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Contacts
        </button>

        <div class="header-actions">
          <button @click="editContact" class="btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button @click="deleteContact" class="btn-danger">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="content-grid">
        <!-- Left Column - Profile & Info -->
        <div class="left-column">
          <!-- Profile Card -->
          <div class="profile-card">
            <div class="avatar-large">{{ getInitials() }}</div>
            <h1>{{ contact.salutation }} {{ contact.first_name }} {{ contact.last_name }}</h1>
            <p class="job-title">{{ contact.job_title || 'No title' }}</p>
            <span :class="['badge', 'stage', contact.lifecycle_stage?.toLowerCase()]">
              {{ contact.lifecycle_stage || 'Lead' }}
            </span>

            <div class="contact-methods">
              <a v-if="contact.email" :href="`mailto:${contact.email}`" class="contact-method">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {{ contact.email }}
              </a>
              
              <a v-if="contact.phone" :href="`tel:${contact.phone}`" class="contact-method">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {{ contact.phone }}
              </a>

              <a v-if="contact.mobile" :href="`tel:${contact.mobile}`" class="contact-method">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {{ contact.mobile }}
              </a>

              <a v-if="contact.linkedin_url" :href="contact.linkedin_url" target="_blank" class="contact-method">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn
              </a>

              <a v-if="contact.website" :href="contact.website" target="_blank" class="contact-method">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {{ contact.website }}
              </a>
            </div>

            <div v-if="contact.tags && contact.tags.length > 0" class="tags">
              <span v-for="tag in contact.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <!-- Details Card -->
          <div class="info-card">
            <h3>Details</h3>
            
            <div class="info-row">
              <span class="label">Department</span>
              <span class="value">{{ contact.department || '-' }}</span>
            </div>

            <div class="info-row">
              <span class="label">Lead Source</span>
              <span class="value">{{ contact.lead_source || '-' }}</span>
            </div>

            <div class="info-row">
              <span class="label">Owner</span>
              <span class="value">{{ contact.owner_id?.firstName || 'Unassigned' }}</span>
            </div>

            <div class="info-row">
              <span class="label">Status</span>
              <span :class="['badge', contact.status?.toLowerCase()]">{{ contact.status || 'Active' }}</span>
            </div>

            <div class="info-row">
              <span class="label">Do Not Contact</span>
              <span class="value">{{ contact.do_not_contact ? 'Yes' : 'No' }}</span>
            </div>

            <div class="info-row">
              <span class="label">Last Contacted</span>
              <span class="value">{{ formatDate(contact.last_contacted_at) }}</span>
            </div>

            <div class="info-row">
              <span class="label">Created</span>
              <span class="value">{{ formatDate(contact.createdAt) }}</span>
            </div>
          </div>

          <!-- Address Card -->
          <div v-if="hasAddress" class="info-card">
            <h3>Address</h3>
            
            <div class="info-row">
              <span class="label">Street</span>
              <span class="value">{{ contact.address?.street || '-' }}</span>
            </div>

            <div class="info-row">
              <span class="label">City</span>
              <span class="value">{{ contact.address?.city || '-' }}</span>
            </div>

            <div class="info-row">
              <span class="label">State</span>
              <span class="value">{{ contact.address?.state || '-' }}</span>
            </div>

            <div class="info-row">
              <span class="label">Postal Code</span>
              <span class="value">{{ contact.address?.postal_code || '-' }}</span>
            </div>

            <div class="info-row">
              <span class="label">Country</span>
              <span class="value">{{ contact.address?.country || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- Right Column - Activity & Notes -->
        <div class="right-column">
          <!-- Activity Feed -->
          <div class="activity-card">
            <div class="card-header">
              <h3>Activity</h3>
              <button @click="showNoteForm = true" class="btn-small">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Note
              </button>
            </div>

            <!-- Note Form -->
            <div v-if="showNoteForm" class="note-form">
              <textarea 
                v-model="newNote" 
                placeholder="Add a note about this contact..."
                rows="3"
              ></textarea>
              <div class="form-actions">
                <button @click="showNoteForm = false" class="btn-text">Cancel</button>
                <button @click="addNote" :disabled="!newNote.trim()" class="btn-primary">Save Note</button>
              </div>
            </div>

            <!-- Notes List -->
            <div class="activity-list">
              <div v-if="contact.notes && contact.notes.length > 0">
                <div v-for="(note, index) in contact.notes" :key="index" class="activity-item">
                  <div class="activity-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div class="activity-content">
                    <p class="activity-text">{{ note.text }}</p>
                    <p class="activity-meta">{{ formatDate(note.created_at) }} by {{ note.created_by?.firstName || 'Unknown' }}</p>
                  </div>
                </div>
              </div>

              <div v-else class="empty-activity">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p>No notes yet. Add one to start tracking activity.</p>
              </div>
            </div>
          </div>

          <!-- Quick Stats -->
          <div class="stats-card">
            <h3>Quick Stats</h3>
            
            <div class="stat-item">
              <span class="stat-label">Lead Score</span>
              <span class="stat-value">{{ contact.score || 0 }}</span>
            </div>

            <div class="stat-item">
              <span class="stat-label">Total Notes</span>
              <span class="stat-value">{{ contact.notes?.length || 0 }}</span>
            </div>

            <div class="stat-item">
              <span class="stat-label">Days Since Contact</span>
              <span class="stat-value">{{ daysSinceContact }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <ContactFormModal 
      v-if="showEditModal"
      :contact="contact"
      @close="showEditModal = false"
      @saved="handleContactUpdated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import ContactFormModal from '@/components/contacts/ContactFormModal.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const contact = ref(null);
const loading = ref(true);
const error = ref(null);
const showEditModal = ref(false);
const showNoteForm = ref(false);
const newNote = ref('');

const hasAddress = computed(() => {
  return contact.value?.address && (
    contact.value.address.street ||
    contact.value.address.city ||
    contact.value.address.state ||
    contact.value.address.postal_code ||
    contact.value.address.country
  );
});

const daysSinceContact = computed(() => {
  if (!contact.value?.last_contacted_at) return '-';
  const days = Math.floor((new Date() - new Date(contact.value.last_contacted_at)) / (1000 * 60 * 60 * 24));
  return days;
});

const fetchContact = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    // Admins/Owners can view contacts from any organization
    const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
    const endpoint = isAdmin 
      ? `/admin/contacts/${route.params.id}`
      : `/contacts/${route.params.id}`;
    
    console.log('Fetching contact:', { endpoint, isAdmin });
    
    const data = await apiClient(endpoint, {
      method: 'GET'
    });
    
    if (data.success) {
      contact.value = data.data;
      console.log('Contact loaded:', contact.value);
    }
  } catch (err) {
    console.error('Error fetching contact:', err);
    error.value = err.message || 'Failed to load contact';
  } finally {
    loading.value = false;
  }
};

const getInitials = () => {
  if (!contact.value) return '';
  return `${contact.value.first_name?.[0] || ''}${contact.value.last_name?.[0] || ''}`.toUpperCase();
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const editContact = () => {
  showEditModal.value = true;
};

const handleContactUpdated = () => {
  showEditModal.value = false;
  fetchContact();
};

const deleteContact = async () => {
  if (!confirm('Are you sure you want to delete this contact?')) return;
  
  try {
    await apiClient(`/contacts/${route.params.id}`, {
      method: 'DELETE'
    });
    router.push('/contacts');
  } catch (err) {
    console.error('Error deleting contact:', err);
    alert('Failed to delete contact');
  }
};

const addNote = async () => {
  if (!newNote.value.trim()) return;
  
  try {
    const data = await apiClient(`/contacts/${route.params.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text: newNote.value.trim() })
    });
    
    if (data.success) {
      contact.value = data.data;
      newNote.value = '';
      showNoteForm.value = false;
    }
  } catch (err) {
    console.error('Error adding note:', err);
    alert('Failed to add note');
  }
};

onMounted(() => {
  fetchContact();
});
</script>

<style scoped>
.contact-detail-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  color: #374151;
  transition: all 0.2s;
}

.btn-back:hover {
  background: #f9fafb;
}

.btn-back svg {
  width: 20px;
  height: 20px;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-secondary, .btn-danger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-secondary svg, .btn-danger svg {
  width: 18px;
  height: 18px;
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 2rem;
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.right-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Profile Card */
.profile-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.avatar-large {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 auto 1.5rem;
}

.profile-card h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.job-title {
  color: #6b7280;
  font-size: 0.95rem;
  margin-bottom: 1rem;
}

.badge {
  display: inline-block;
  padding: 0.4rem 1rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
}

.badge.stage.lead { background: #fef3c7; color: #92400e; }
.badge.stage.qualified { background: #dbeafe; color: #1e40af; }
.badge.stage.opportunity { background: #e0e7ff; color: #3730a3; }
.badge.stage.customer { background: #d1fae5; color: #065f46; }
.badge.stage.lost { background: #fee2e2; color: #991b1b; }
.badge.active { background: #d1fae5; color: #065f46; }
.badge.inactive { background: #e5e7eb; color: #374151; }

.contact-methods {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.contact-method {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
  color: #374151;
  text-decoration: none;
  transition: all 0.2s;
}

.contact-method:hover {
  background: #f3f4f6;
  color: #3b82f6;
}

.contact-method svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.tag {
  padding: 0.25rem 0.75rem;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

/* Info Card */
.info-card, .activity-card, .stats-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.info-card h3, .activity-card h3, .stats-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.value {
  font-size: 0.9rem;
  color: #1f2937;
  font-weight: 500;
}

/* Activity Card */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.btn-small {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-small:hover {
  background: #2563eb;
}

.btn-small svg {
  width: 16px;
  height: 16px;
}

.note-form {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.note-form textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  resize: vertical;
  font-family: inherit;
}

.note-form textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.btn-text, .btn-primary {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-size: 0.875rem;
}

.btn-text {
  background: transparent;
  color: #6b7280;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.activity-list {
  max-height: 600px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  width: 36px;
  height: 36px;
  background: #eff6ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-icon svg {
  width: 18px;
  height: 18px;
  color: #3b82f6;
}

.activity-content {
  flex: 1;
}

.activity-text {
  color: #1f2937;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.activity-meta {
  color: #9ca3af;
  font-size: 0.8rem;
}

.empty-activity {
  text-align: center;
  padding: 3rem 1rem;
  color: #9ca3af;
}

.empty-activity svg {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  color: #d1d5db;
}

/* Stats Card */
.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #3b82f6;
}

/* Loading & Error */
.loading, .error-state {
  text-align: center;
  padding: 4rem 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>


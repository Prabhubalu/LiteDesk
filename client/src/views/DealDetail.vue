<template>
  <div class="deal-detail-placeholder">
    <div class="container">
      <div class="back-nav">
        <button @click="$router.push('/deals')" class="back-button">
          ← Back to Deals
        </button>
      </div>
      
      <div class="coming-soon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        
        <h1>Deal Detail View</h1>
        <p>This view is coming soon!</p>
        <p class="subtitle">For now, you can edit deals from the Deals list page.</p>
        
        <div class="actions">
          <button @click="$router.push('/deals')" class="btn-primary">
            Go to Deals
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
const dealId = route.params.id;

// TODO: Implement full deal detail view with:
// - Deal overview card
// - Stage timeline
// - Notes & activities
// - Linked contacts
// - Document attachments
// - Edit functionality
</script>

<style scoped>
.deal-detail-placeholder {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

.back-nav {
  margin-bottom: 2rem;
}

.back-button {
  padding: 0.75rem 1.5rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  background: #f9fafb;
}

.coming-soon {
  background: white;
  border-radius: 12px;
  padding: 4rem 2rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.coming-soon svg {
  width: 80px;
  height: 80px;
  margin: 0 auto 2rem;
  color: #3b82f6;
}

.coming-soon h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.coming-soon p {
  font-size: 1.125rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 0.95rem;
  color: #9ca3af;
  margin-bottom: 2rem;
}

.actions {
  margin-top: 2rem;
}

.btn-primary {
  padding: 0.75rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.btn-primary:hover {
  background: #2563eb;
}
</style>


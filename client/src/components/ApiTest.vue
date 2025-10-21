<script setup>
import { ref, onMounted } from 'vue';

const message = ref('Loading...');

onMounted(async () => {
  try {
    // This requests /api/ which Vite proxies to http://localhost:3000/
    const response = await fetch('/api');
    const text = await response.text();
    message.value = 'API Response: ' + text;
  } catch (error) {
    message.value = 'API Error: ' + error.message;
  }
});
</script>

<template>
  <div>
    <h2>Backend Status</h2>
    <p>{{ message }}</p>
  </div>
</template>
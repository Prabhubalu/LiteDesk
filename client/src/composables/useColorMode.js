import { ref, watch, onMounted } from 'vue';

const colorMode = ref('light'); // Global state shared across the app

// Inside src/composables/useColorMode.js

const applyMode = (mode) => {
  // Target the root <html> element
  const root = document.documentElement;
  
  console.log('Applying color mode:', mode);
  
  // 1. **CRITICAL STEP:** Remove the 'dark' class (and 'light', if used)
  // This ensures a clean slate, especially important when switching FROM dark TO light.
  root.classList.remove('dark', 'light'); 

  // 2. Conditionally apply the 'dark' class based on the mode
  if (mode === 'system') {
    // Check OS preference and apply 'dark' if preferred
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('System mode - prefers dark:', prefersDark);
    if (prefersDark) {
      root.classList.add('dark');
    }
  } else if (mode === 'dark') {
    // Explicitly set to dark mode
    console.log('Adding dark class');
    root.classList.add('dark');
  } else if (mode === 'light') {
    console.log('Light mode - no dark class added');
  }
  
  // Debug: Check if dark class is actually present
  console.log('HTML classes after applyMode:', root.classList.toString());
  console.log('Dark class present:', root.classList.contains('dark'));
  console.log('Current mode:', mode);
  // If mode is 'light', the 'dark' class remains removed, 
  // and Tailwind defaults to the base (light mode) styles.
};

// ... the rest of your useColorMode logic ...

// Listen for system preference changes while in 'system' mode
const setupSystemListener = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    if (colorMode.value === 'system') {
      applyMode('system');
    }
  });
};

export function useColorMode() {
  
  const toggleColorMode = (mode) => {
    console.log('toggleColorMode called with:', mode);
    if (!['light', 'dark', 'system'].includes(mode)) {
      console.log('Invalid mode:', mode);
      return;
    }
    console.log('Setting color mode to:', mode);
    colorMode.value = mode;
    localStorage.setItem('color-mode', mode);
    applyMode(mode);
  };

  // Initial setup: check local storage and apply mode
  onMounted(() => {
    const storedMode = localStorage.getItem('color-mode');
    console.log('Stored color mode:', storedMode);
    if (['light', 'dark', 'system'].includes(storedMode)) {
      colorMode.value = storedMode;
      console.log('Using stored mode:', storedMode);
    } else {
      console.log('Using default mode:', colorMode.value);
    }
    
    applyMode(colorMode.value);
    setupSystemListener();
  });

  // Watch for manual changes via the switcher and apply
  watch(colorMode, (newMode) => {
    applyMode(newMode);
  });

  // Clear stored mode (for debugging)
  const clearStoredMode = () => {
    localStorage.removeItem('color-mode');
    console.log('Cleared stored color mode');
  };

  // Expose the current mode for use in templates (e.g., to switch logos)
  return {
    colorMode,
    toggleColorMode,
    clearStoredMode,
  };
}
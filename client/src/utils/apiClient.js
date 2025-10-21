import { useAuthStore } from '@/stores/auth';

const apiClient = async (url, options = {}) => {
    const authStore = useAuthStore();
    const token = authStore.user?.token; // Get token from Pinia store

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        // Attach the JWT to the request header for protected routes
        headers['Authorization'] = `Bearer ${token}`; 
    }

    const response = await fetch(`/api${url}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // If unauthorized, force logout
        authStore.logout();
        throw new Error('Session expired. Please log in again.');
    }

    // Check for other errors
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }

    return response.json();
};

export default apiClient;
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

    // Handle URL params for GET requests
    let fullUrl = `/api${url}`;
    if (options.params) {
        const queryString = new URLSearchParams(options.params).toString();
        fullUrl += `?${queryString}`;
    }

    const response = await fetch(fullUrl, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : options.body,
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

// Add convenient methods
apiClient.get = (url, options = {}) => {
    return apiClient(url, { ...options, method: 'GET' });
};

apiClient.post = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'POST', body: data });
};

apiClient.put = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'PUT', body: data });
};

apiClient.patch = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'PATCH', body: data });
};

apiClient.delete = (url, options = {}) => {
    return apiClient(url, { ...options, method: 'DELETE' });
};

export default apiClient;
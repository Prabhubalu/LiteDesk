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
        body: options.body,
    });

    if (response.status === 401) {
        // If unauthorized, force logout
        authStore.logout();
        throw new Error('Session expired. Please log in again.');
    }

    // Check for other errors
    if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
            // If response is not JSON (e.g., HTML error page), get text content
            const textContent = await response.text();
            console.error('Non-JSON response received:', textContent.substring(0, 200));
            errorMessage = `Server returned non-JSON response (${response.status}): ${textContent.substring(0, 100)}...`;
        }
        throw new Error(errorMessage);
    }

    return response.json();
};

// Add convenient methods
apiClient.get = (url, options = {}) => {
    return apiClient(url, { ...options, method: 'GET' });
};

apiClient.post = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'POST', body: JSON.stringify(data) });
};

apiClient.put = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'PUT', body: JSON.stringify(data) });
};

apiClient.patch = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'PATCH', body: JSON.stringify(data) });
};

apiClient.delete = (url, options = {}) => {
    return apiClient(url, { ...options, method: 'DELETE' });
};

export default apiClient;
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

    try {
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
            const is404 = response.status === 404;
            let errorMessage = `HTTP error! Status: ${response.status}`;
            
            // For 404 errors, don't try to parse the response body
            if (is404) {
                const error = new Error(errorMessage);
                error.status = 404;
                error.is404 = true;
                throw error;
            }
            
            try {
                // Clone response before reading to avoid "body stream already read" error
                const clonedResponse = response.clone();
                const errorData = await clonedResponse.json();
                errorMessage = errorData.message || errorMessage;
            } catch (parseError) {
                // If response is not JSON (e.g., HTML error page), get text content
                try {
                    const clonedResponse = response.clone();
                    const textContent = await clonedResponse.text();
                    console.error('Non-JSON response received:', textContent.substring(0, 200));
                    errorMessage = `Server returned non-JSON response (${response.status}): ${textContent.substring(0, 100)}...`;
                } catch (textError) {
                    // If even text reading fails, use status text
                    errorMessage = `HTTP error! Status: ${response.status} ${response.statusText}`;
                }
            }
            
            const error = new Error(errorMessage);
            error.status = response.status;
            error.is404 = false;
            throw error;
        }

        return response.json();
    } catch (error) {
        // Re-throw if it's already our custom error
        if (error.status !== undefined) {
            throw error;
        }
        // For network errors or other issues, wrap them
        const wrappedError = new Error(error.message || 'Network error');
        wrappedError.status = 0;
        wrappedError.is404 = false;
        throw wrappedError;
    }
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
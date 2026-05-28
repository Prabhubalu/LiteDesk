import { getPortalApiUrl } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

/**
 * Portal API Client
 *
 * Centralized API client for Portal application endpoints (/portal/*).
 * Requires Bearer token and Portal app entitlement on the server.
 */
function resolveAuthToken() {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }
  return token;
}

const portalApiClient = async (url, options = {}) => {
  const authStore = useAuthStore();
  const token = resolveAuthToken();

  if (!token) {
    console.error('[PortalApiClient] No authentication token available');
    throw new Error('Authentication required. Please log in again.');
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  let fullUrl = getPortalApiUrl(url);
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
      const message = 'Session expired or invalid. Please sign in again.';
      console.error('[PortalApiClient] 401 Unauthorized:', fullUrl);
      const error = new Error(message);
      error.status = 401;
      throw error;
    }

    if (!response.ok) {
      const is404 = response.status === 404;
      let errorMessage = `HTTP error! Status: ${response.status}`;

      if (is404) {
        const error = new Error(errorMessage);
        error.status = 404;
        error.is404 = true;
        throw error;
      }

      let errorData = null;
      try {
        const clonedResponse = response.clone();
        errorData = await clonedResponse.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        try {
          const clonedResponse = response.clone();
          const textContent = await clonedResponse.text();
          console.error('[PortalApiClient] Non-JSON response received:', textContent.substring(0, 200));
          errorMessage = `Server returned non-JSON response (${response.status})`;
        } catch {
          errorMessage = `HTTP error! Status: ${response.status} ${response.statusText}`;
        }
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.is404 = false;
      if (errorData) {
        error.response = { data: errorData };
      }
      throw error;
    }

    return response.json();
  } catch (error) {
    if (error.status !== undefined) {
      throw error;
    }
    const wrappedError = new Error(error.message || 'Network error');
    wrappedError.status = 0;
    wrappedError.is404 = false;
    throw wrappedError;
  }
};

portalApiClient.get = (url, options = {}) => {
  return portalApiClient(url, { ...options, method: 'GET' });
};

portalApiClient.post = (url, data, options = {}) => {
  return portalApiClient(url, { ...options, method: 'POST', body: JSON.stringify(data) });
};

portalApiClient.put = (url, data, options = {}) => {
  return portalApiClient(url, { ...options, method: 'PUT', body: JSON.stringify(data) });
};

portalApiClient.patch = (url, data, options = {}) => {
  return portalApiClient(url, { ...options, method: 'PATCH', body: JSON.stringify(data) });
};

portalApiClient.delete = (url, options = {}) => {
  return portalApiClient(url, { ...options, method: 'DELETE' });
};

export default portalApiClient;

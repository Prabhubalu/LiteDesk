import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        loading: false,
        error: null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.user,
    },
    actions: {
        setUser(userData) {
            this.user = userData;
            localStorage.setItem('user', JSON.stringify(userData));
        },
        clearUser() {
            this.user = null;
            // CRITICAL: Must remove the user data from localStorage
            localStorage.removeItem('user');
            // Also, clear the error state just in case
            this.error = null;
        },
    logout() {
        this.clearUser();
    },

    async authenticate(endpoint, credentials) {
            this.loading = true;
            this.error = null;
            try {
                const url = `/api/auth/${endpoint}`;
                console.log('Auth request ->', url, credentials);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(credentials),
                });

                const text = await response.text();
                console.log('Auth response status', response.status);
                console.log('Auth response body:', text.slice(0, 1000)); // log first 1000 chars

                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    throw new Error(`Server returned non-JSON response (status ${response.status})`);
                }

                const data = JSON.parse(text);
                if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);

                this.setUser(data);
                return true;
            } catch (err) {
                console.error('Auth error:', err);
                this.error = err.message || 'An unexpected error occurred';
                return false;
            } finally {
                this.loading = false;
            }
        },
        // --- Public Actions ---
        async register(userData) {
            return this.authenticate('register', userData);
        },
        async login(credentials) {
            return this.authenticate('login', credentials);
        },
        logout() {
            this.clearUser();
        }
    },
});
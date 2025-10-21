import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        organization: JSON.parse(localStorage.getItem('organization')) || null,
        loading: false,
        error: null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.user,
        isOwner: (state) => state.user?.isOwner || false,
        userRole: (state) => state.user?.role || null,
        hasPermission: (state) => {
            return (module, action) => {
                if (state.user?.isOwner) return true;
                return state.user?.permissions?.[module]?.[action] || false;
            };
        },
        isTrialActive: (state) => state.organization?.subscription?.status === 'trial',
        subscriptionTier: (state) => state.organization?.subscription?.tier || 'trial',
        enabledModules: (state) => state.organization?.enabledModules || [],
    },
    actions: {
        setUser(userData) {
            this.user = {
                _id: userData._id,
                username: userData.username,
                email: userData.email,
                role: userData.role,
                isOwner: userData.isOwner,
                permissions: userData.permissions,
                token: userData.token
            };
            
            if (userData.organization) {
                this.organization = userData.organization;
                localStorage.setItem('organization', JSON.stringify(userData.organization));
            }
            
            localStorage.setItem('user', JSON.stringify(this.user));
        },
        
        clearUser() {
            this.user = null;
            this.organization = null;
            localStorage.removeItem('user');
            localStorage.removeItem('organization');
            this.error = null;
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
        },
        
        // Check if user has a specific permission
        can(module, action) {
            if (this.user?.isOwner) return true;
            return this.user?.permissions?.[module]?.[action] || false;
        },
        
        // Check if module is enabled for organization
        hasModule(moduleName) {
            return this.organization?.enabledModules?.includes(moduleName) || false;
        },
        
        // Refresh organization data
        async refreshOrganization() {
            try {
                const response = await fetch('/api/organization', {
                    headers: {
                        'Authorization': `Bearer ${this.user?.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.organization = data.data;
                    localStorage.setItem('organization', JSON.stringify(this.organization));
                }
            } catch (error) {
                console.error('Error refreshing organization:', error);
            }
        }
    },
});
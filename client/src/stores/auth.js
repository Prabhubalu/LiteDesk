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
        isAdminLike: (state) => {
            const role = state.user?.role || '';
            return state.user?.isOwner || role.toLowerCase() === 'admin';
        },
        hasPermission: (state) => {
            return (module, action) => {
                const role = state.user?.role || '';
                if (state.user?.isOwner || role.toLowerCase() === 'admin') return true;
                const normalized = module === 'people' ? 'contacts' : module;
                return state.user?.permissions?.[normalized]?.[action] || false;
            };
        },
        isTrialActive: (state) => state.organization?.subscription?.status === 'trial',
        subscriptionTier: (state) => state.organization?.subscription?.tier || 'trial',
        enabledModules: (state) => state.organization?.enabledModules || [],
        isMasterOrganization: (state) => state.organization?.name === 'LiteDesk Master',
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
            const role = this.user?.role || '';
            if (this.user?.isOwner || role.toLowerCase() === 'admin') return true;
            const normalized = module === 'people' ? 'contacts' : module;
            return this.user?.permissions?.[normalized]?.[action] || false;
        },
        
        // Check if module is enabled for organization
        hasModule(moduleName) {
            return this.organization?.enabledModules?.includes(moduleName) || false;
        },
        
        // Refresh organization data
        async refreshOrganization() {
            try {
                const response = await fetch('/api/v2/organization', {
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
        },
        
        // Refresh user profile and permissions
        async refreshUser() {
            if (!this.user?.token) {
                console.warn('No user token available for refresh');
                return false;
            }
            
            try {
                console.log('Refreshing user permissions...');
                const response = await fetch('/api/users/profile', {
                    headers: {
                        'Authorization': `Bearer ${this.user.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data) {
                        // Normalize/derive permissions if missing from server
                        const deriveFromRole = (rolePerms) => {
                            if (!rolePerms) return null;
                            const contacts = {
                                view: !!rolePerms.contacts?.read,
                                create: !!rolePerms.contacts?.create,
                                edit: !!rolePerms.contacts?.update,
                                delete: !!rolePerms.contacts?.delete,
                                viewAll: !!rolePerms.contacts?.viewAll,
                                exportData: !!rolePerms.contacts?.export,
                            };
                            const organizations = {
                                view: !!rolePerms.organizations?.read,
                                create: !!rolePerms.organizations?.create,
                                edit: !!rolePerms.organizations?.update,
                                delete: !!rolePerms.organizations?.delete,
                                viewAll: !!rolePerms.organizations?.viewAll,
                                exportData: !!rolePerms.organizations?.export,
                            };
                            const deals = {
                                view: !!rolePerms.deals?.read,
                                create: !!rolePerms.deals?.create,
                                edit: !!rolePerms.deals?.update,
                                delete: !!rolePerms.deals?.delete,
                                viewAll: !!rolePerms.deals?.viewAll,
                                exportData: !!rolePerms.deals?.export,
                            };
                            const tasks = {
                                view: !!rolePerms.tasks?.read,
                                create: !!rolePerms.tasks?.create,
                                edit: !!rolePerms.tasks?.update,
                                delete: !!rolePerms.tasks?.delete,
                                viewAll: !!rolePerms.tasks?.viewAll,
                            };
                            const events = {
                                view: !!rolePerms.events?.read,
                                create: !!rolePerms.events?.create,
                                edit: !!rolePerms.events?.update,
                                delete: !!rolePerms.events?.delete,
                                viewAll: !!rolePerms.events?.viewAll,
                            };
                            const imports = {
                                view: !!(rolePerms.contacts?.import || rolePerms.deals?.import),
                                create: !!(rolePerms.contacts?.import || rolePerms.deals?.import),
                                delete: false,
                            };
                            const settings = {
                                manageUsers: !!rolePerms.settings?.manageUsers,
                                manageBilling: !!rolePerms.settings?.manageBilling,
                                manageIntegrations: false,
                                customizeFields: !!rolePerms.settings?.edit,
                                edit: !!rolePerms.settings?.edit,
                            };
                            const reports = {
                                viewStandard: !!rolePerms.reports?.read,
                                viewCustom: !!rolePerms.reports?.read,
                                createCustom: !!rolePerms.reports?.create,
                                exportReports: !!rolePerms.reports?.export,
                            };
                            const built = { contacts, organizations, deals, tasks, events, imports, settings, reports };
                            built.people = built.contacts;
                            return built;
                        };

                        const incoming = data.data;
                        const ensuredPermissions = incoming.permissions || deriveFromRole(incoming.roleId?.permissions) || {};
                        if (ensuredPermissions.contacts && !ensuredPermissions.people) {
                            ensuredPermissions.people = ensuredPermissions.contacts;
                        }
                        // Update user data while preserving token
                        const token = this.user.token;
                        this.user = {
                            ...incoming,
                            permissions: ensuredPermissions,
                            token: token
                        };
                        localStorage.setItem('user', JSON.stringify(this.user));
                        console.log('User permissions refreshed successfully');
                        return true;
                    }
                } else if (response.status === 401) {
                    // Token expired, logout
                    console.warn('Session expired, logging out');
                    this.logout();
                    return false;
                }
            } catch (error) {
                console.error('Error refreshing user:', error);
                return false;
            }
            return false;
        }
    },
});
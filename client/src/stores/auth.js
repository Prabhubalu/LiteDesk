import { defineStore } from 'pinia';
import { logAuthAccessDebug, warnAuthAccessDebug } from '@/config/arivuDebug.js';
import { getApiUrlForFetch } from '@/config/apiBase';
import { isOnPublicShellRoute } from '@/utils/standaloneRoutes';
import { validateUserTypeForApp } from '@/utils/appUserTypeAccess';
import { identifyProductUser, captureUserLoggedIn, resetPosthog } from '@/config/posthogUser';
import { registerUseAuthStore } from './authRegistry';

const PROFILE_REFRESHED_AT_KEY = 'arivu:user-profile-refreshed-at';
const PROFILE_REFRESH_FRESH_MS = 5 * 60 * 1000;
const PROD_LOGOUT_REDIRECT_ORIGIN = (import.meta.env.VITE_MAIN_APP_ORIGIN || 'https://app.arivusystems.com').replace(/\/$/, '');

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        organization: JSON.parse(localStorage.getItem('organization')) || null,
        lastLoginResult: null,
        loading: false,
        error: null,
    }),
    getters: {
        isAuthenticated: (state) => {
            const token = state.user?.token;
            return Boolean(
                state.user
                && token
                && token !== 'undefined'
                && token !== 'null'
            );
        },
        isOwner: (state) => state.user?.isOwner || false,
        userRole: (state) => state.user?.role || null,
        isAdminLike: (state) => {
            const role = state.user?.role || '';
            return state.user?.isOwner || role.toLowerCase() === 'admin' || role.toLowerCase() === 'owner';
        },
        hasPermission: (state) => {
            return (module, action) => {
                const role = state.user?.role || '';
                if (state.user?.isOwner || role.toLowerCase() === 'admin' || role.toLowerCase() === 'owner') return true;
                const normalized = module === 'people' ? 'contacts' : module;
                return state.user?.permissions?.[normalized]?.[action] || false;
            };
        },
        isTrialActive: (state) => state.organization?.subscription?.status === 'trial',
        subscriptionTier: (state) => state.organization?.subscription?.tier || 'trial',
        enabledModules: (state) => state.organization?.enabledModules || [],
        inventoryEnabled: (state) => state.organization?.capabilities?.inventory === true,
        isMasterOrganization: (state) => state.organization?.name === 'Arivu Master',
        isPlatformAdmin: (state) => {
            // Check if user is platform admin (Phase 0H)
            if (state.user?.isPlatformAdmin === true) return true;
            // Check if user has internal staff email
            const email = state.user?.email || '';
            const internalDomains = ['arivusystems.com', 'arivu.com', 'arivu.io'];
            return internalDomains.some(domain => email.toLowerCase().includes(`@${domain}`));
        },
        requiresEmailVerification: (state) => Boolean(state.user && !state.user.emailVerifiedAt),
        hasAppAccess: (state) => {
            return (appKey) => {
                const appKeyUpper = appKey.toUpperCase();
                const userType = state.user?.userType || 'INTERNAL';
                if (!validateUserTypeForApp(userType, appKeyUpper)) {
                    return false;
                }
                const allowedApps = (state.user?.allowedApps || []).map(app =>
                    typeof app === 'string' ? app.toUpperCase() : app
                );
                const hasExplicitUserAccess = allowedApps.includes(appKeyUpper);

                const normalizeOrgEnabledKeys = (enabledApps) => {
                    if (!enabledApps?.length) return [];
                    return enabledApps
                        .map((app) => {
                            if (typeof app === 'string') return app.toUpperCase();
                            if (app && typeof app === 'object') {
                                const key = app.appKey || app;
                                if (app.status && app.status !== 'ACTIVE') return null;
                                return typeof key === 'string' ? key.toUpperCase() : null;
                            }
                            return null;
                        })
                        .filter((k) => k !== null);
                };

                const isOwnerLike =
                    state.user?.isOwner === true ||
                    String(state.user?.role || '').toLowerCase() === 'owner';

                // Mirrors server uiCompositionService.getUIAppsForTenant: owners see org-enabled
                // apps that match their userType (INTERNAL users never get PORTAL in navigation).
                // Seat / role enforcement still happens inside each app.
                // IMPORTANT: do not prefer User.allowedApps over organization.enabledApps — that
                // caused the sidebar registry to keep only legacy defaults (e.g. SALES) and hide
                // the app switcher even after enabling HELPDESK/AUDIT on the org.
                if (isOwnerLike) {
                    const orgKeys = normalizeOrgEnabledKeys(state.organization?.enabledApps);
                    if (orgKeys.length > 0) {
                        const ok = orgKeys.includes(appKeyUpper);
                        logAuthAccessDebug(`[hasAppAccess] Owner-like org-enabled check for ${appKeyUpper}:`, {
                            orgKeys,
                            ok
                        });
                        return ok;
                    }

                    if (allowedApps.length > 0) {
                        logAuthAccessDebug(`[hasAppAccess] Owner-like explicit allowedApps (no org keys):`, {
                            allowedApps,
                            appKeyUpper,
                            hasAccess: hasExplicitUserAccess
                        });
                        return hasExplicitUserAccess;
                    }

                    warnAuthAccessDebug(`[hasAppAccess] Owner-like but no org enabledApps and empty allowedApps`, {
                        appKeyUpper
                    });
                    return false;
                }

                logAuthAccessDebug(`[hasAppAccess] Final check for ${appKeyUpper}:`, {
                    isOwner: state.user?.isOwner,
                    allowedApps,
                    hasAccess: hasExplicitUserAccess
                });

                return hasExplicitUserAccess;
            };
        },
        hasAssignedAppAccess: (state) => {
            return (appKey) => {
                const appKeyUpper = String(appKey || '').toUpperCase();
                if (!appKeyUpper) return false;
                const userType = state.user?.userType || 'INTERNAL';
                if (!validateUserTypeForApp(userType, appKeyUpper)) {
                    return false;
                }

                const allowedApps = Array.isArray(state.user?.allowedApps) ? state.user.allowedApps : [];
                const hasAllowedApps = allowedApps.length > 0;
                const normalizedAllowed = allowedApps
                    .map((app) => (typeof app === 'string' ? app.toUpperCase() : null))
                    .filter(Boolean);

                const appAccess = Array.isArray(state.user?.appAccess) ? state.user.appAccess : [];
                const hasAppAccessRows = appAccess.length > 0;
                const normalizedFromAccess = appAccess
                    .filter((entry) => entry && typeof entry === 'object')
                    .filter((entry) => String(entry.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
                    .map((entry) => (typeof entry.appKey === 'string' ? entry.appKey.toUpperCase() : null))
                    .filter(Boolean);

                const hasExplicitUserAppAccessData = hasAllowedApps || hasAppAccessRows;
                if (hasExplicitUserAppAccessData) {
                    const assigned = new Set([...normalizedAllowed, ...normalizedFromAccess]);
                    return assigned.has(appKeyUpper);
                }

                // Legacy fallback for older session payloads.
                const normalizeOrgEnabledKeys = (enabledApps) => {
                    if (!enabledApps?.length) return [];
                    return enabledApps
                        .map((app) => {
                            if (typeof app === 'string') return app.toUpperCase();
                            if (app && typeof app === 'object') {
                                const key = app.appKey || app;
                                if (app.status && app.status !== 'ACTIVE') return null;
                                return typeof key === 'string' ? key.toUpperCase() : null;
                            }
                            return null;
                        })
                        .filter((k) => k !== null);
                };
                const isOwnerLike =
                    state.user?.isOwner === true ||
                    String(state.user?.role || '').toLowerCase() === 'owner';
                if (isOwnerLike) {
                    const orgKeys = normalizeOrgEnabledKeys(state.organization?.enabledApps);
                    if (orgKeys.length > 0) return orgKeys.includes(appKeyUpper);
                }
                return normalizedAllowed.includes(appKeyUpper);
            };
        },
    },
    actions: {
        resolveAllowedApps(userData = {}, options = {}) {
            const { fallbackAllowedApps = [], organization = null } = options;

            const normalizeAppKeys = (apps) => {
                if (!Array.isArray(apps)) return [];
                const normalized = apps
                    .map((app) => {
                        if (typeof app === 'string') return app.toUpperCase();
                        if (app && typeof app === 'object') {
                            const key = app.appKey || app.key || app.name;
                            return typeof key === 'string' ? key.toUpperCase() : null;
                        }
                        return null;
                    })
                    .filter(Boolean);
                return Array.from(new Set(normalized));
            };

            const explicitAllowedApps = normalizeAppKeys(userData.allowedApps);
            if (explicitAllowedApps.length > 0) {
                return explicitAllowedApps;
            }

            if (Array.isArray(userData.appAccess) && userData.appAccess.length > 0) {
                const fromAppAccess = userData.appAccess
                    .filter((access) => {
                        if (!access || typeof access !== 'object') return false;
                        const status = String(access.status || 'ACTIVE').toUpperCase();
                        return status === 'ACTIVE';
                    })
                    .map((access) => (typeof access.appKey === 'string' ? access.appKey.toUpperCase() : null))
                    .filter(Boolean);
                if (fromAppAccess.length > 0) {
                    return Array.from(new Set(fromAppAccess));
                }
            }

            // IMPORTANT:
            // For non-owners, org enabledApps is tenant-level capability and must NOT
            // expand user-level app access. Only owners can inherit from enabledApps.
            const sourceOrganization = organization || userData.organization || userData.organizationId;
            const isOwnerUser = userData?.isOwner === true;
            if (isOwnerUser && sourceOrganization && Array.isArray(sourceOrganization.enabledApps)) {
                const fromEnabledApps = sourceOrganization.enabledApps
                    .map((app) => {
                        if (typeof app === 'string') return app.toUpperCase();
                        if (app && typeof app === 'object') {
                            const status = String(app.status || 'ACTIVE').toUpperCase();
                            if (status !== 'ACTIVE') return null;
                            return typeof app.appKey === 'string' ? app.appKey.toUpperCase() : null;
                        }
                        return null;
                    })
                    .filter(Boolean);
                if (fromEnabledApps.length > 0) {
                    return Array.from(new Set(fromEnabledApps));
                }
            }

            return normalizeAppKeys(fallbackAllowedApps);
        },

        _isAuthRequestDebugEnabled() {
            if (!import.meta.env.DEV) return false;
            try {
                return localStorage.getItem('arivu:debug:authRequests') === '1';
            } catch (_e) {
                return false;
            }
        },

        setUser(userData) {
            // Derive allowedApps from explicit user access first; never default to SALES.
            const allowedApps = this.resolveAllowedApps(userData, {
                organization: userData.organization
            });
            const organizationId = userData.organization?._id
                ? String(userData.organization._id)
                : (userData.organizationId ? String(userData.organizationId) : undefined);

            this.user = {
                _id: userData._id,
                username: userData.username,
                email: userData.email,
                role: userData.role,
                userType: userData.userType || 'INTERNAL',
                isOwner: userData.isOwner,
                isPlatformAdmin: userData.isPlatformAdmin === true,
                permissions: userData.permissions,
                token: userData.token,
                organizationId,
                appAccess: userData.appAccess,
                allowedApps: allowedApps,
                emailVerifiedAt: userData.emailVerifiedAt || null,
                requiresEmailVerification: userData.requiresEmailVerification === true,
                mustChangePassword: userData.mustChangePassword === true,
                onboarding: userData.onboarding || null,
                firstName: userData.firstName,
                lastName: userData.lastName,
                avatar: userData.avatar || '',
            };
            
            if (userData.organization) {
                this.organization = userData.organization;
                localStorage.setItem('organization', JSON.stringify(userData.organization));
            }
            
            localStorage.setItem('user', JSON.stringify(this.user));
            identifyProductUser({
                _id: this.user._id,
                email: this.user.email,
                organizationId,
            });

            import('@/utils/addonNavigation').then(({ invalidateAddonNavigationCache }) => {
                invalidateAddonNavigationCache();
            }).catch(() => {});

            void this.syncI18nFromOrganization();
        },

        markEmailVerified() {
            if (!this.user) return;
            this.user = {
                ...this.user,
                emailVerifiedAt: new Date().toISOString(),
                requiresEmailVerification: false
            };
            localStorage.setItem('user', JSON.stringify(this.user));
        },

        updateOnboardingSummary(summary) {
            if (!this.user || !summary) return;
            this.user = {
                ...this.user,
                onboarding: {
                    redirectTo: summary.redirectTo ?? null,
                    persona: summary.persona ?? this.user.onboarding?.persona,
                    origin: summary.origin ?? this.user.onboarding?.origin,
                    completed: Boolean(summary.completedAt)
                }
            };
            localStorage.setItem('user', JSON.stringify(this.user));
        },

        async syncI18nFromOrganization() {
            try {
                const { initI18n } = await import('@/i18n');
                const orgLang = this.organization?.settings?.language ?? null;
                await initI18n({ orgLanguage: orgLang, userLanguage: null });
            } catch (_e) {
                /* i18n optional at bootstrap */
            }
        },
        
        clearUser() {
            try {
                resetPosthog();
            } catch (_e) {
                /* optional */
            }
            this.user = null;
            this.organization = null;
            this.lastLoginResult = null;
            localStorage.removeItem('user');
            localStorage.removeItem('organization');
            // Legacy cleanup (older builds stored auth under 'auth')
            localStorage.removeItem('auth');
            try {
                sessionStorage.removeItem('arivu_redirect_after_login');
            } catch (_e) {
                /* optional */
            }
            this.error = null;
            
            // Phase 0D: Clear UI metadata on logout
            import('@/stores/appShell').then(({ useAppShellStore }) => {
                const appShellStore = useAppShellStore();
                appShellStore.clear();
            });
            import('@/utils/tenantSchemaApiCache').then((m) => m.invalidateTenantSchemaCaches()).catch(() => {});
            import('@/utils/addonNavigation').then(({ invalidateAddonNavigationCache }) => {
                invalidateAddonNavigationCache();
            }).catch(() => {});

            // Clear offline data (IndexedDB) on logout
            import('@/services/offlineDb.js').then(({ clearAllData }) => {
                clearAllData().catch(err => {
                    console.error('[Auth] Error clearing offline data:', err);
                });
            });

            // Clear list active-view (session state) so next login shows default list
            // Keeps default-view and saved-views; only clears active-view
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('arivu-listview-') && key.endsWith('-active-view')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
            } catch (e) {
                console.warn('[Auth] Failed to clear list active-view keys:', e);
            }
        },

        buildSessionTransferPayload() {
            if (!this.user?.token || !this.user?._id) return null;
            const payload = {
                user: this.user,
                organization: this.organization || null,
                transferredAt: Date.now()
            };
            try {
                return btoa(encodeURIComponent(JSON.stringify(payload)));
            } catch (_error) {
                return null;
            }
        },

        applySessionTransferPayload(encodedPayload) {
            if (!encodedPayload) return false;
            try {
                const decoded = decodeURIComponent(atob(encodedPayload));
                const payload = JSON.parse(decoded);
                if (!payload?.user?.token || !payload?.user?._id) return false;

                this.user = payload.user;
                this.organization = payload.organization || null;
                localStorage.setItem('user', JSON.stringify(this.user));
                if (this.organization) {
                    localStorage.setItem('organization', JSON.stringify(this.organization));
                } else {
                    localStorage.removeItem('organization');
                }

                identifyProductUser({
                    _id: this.user?._id,
                    email: this.user?.email,
                    organizationId: this.organization?._id ? String(this.organization._id) : undefined,
                });
                return true;
            } catch (_error) {
                return false;
            }
        },

    async authenticate(endpoint, credentials) {
            this.loading = true;
            this.error = null;
            try {
                const url = getApiUrlForFetch(`/api/auth/${endpoint}`);
                if (this._isAuthRequestDebugEnabled()) {
                    logAuthAccessDebug('Auth request ->', url, credentials);
                }
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(credentials),
                });

                const text = await response.text();
                if (this._isAuthRequestDebugEnabled()) {
                    logAuthAccessDebug('Auth response status', response.status);
                    logAuthAccessDebug('Auth response body:', text.slice(0, 1000)); // log first 1000 chars
                }

                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    throw new Error(`Server returned non-JSON response (status ${response.status})`);
                }

                const data = JSON.parse(text);
                if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);

                this.setUser(data);
                if (endpoint === 'login') {
                    this.lastLoginResult = data;
                }
                try {
                    captureUserLoggedIn({ method: 'password' });
                } catch (_e) {
                    /* optional */
                }
                
                // Phase 0D: Load UI metadata after successful login
                import('@/stores/appShell').then(({ useAppShellStore }) => {
                    const appShellStore = useAppShellStore();
                    appShellStore.loadUIMetadata().catch(err => {
                        console.error('[Auth] Error loading UI metadata:', err);
                    });
                });
                
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
            if (typeof window !== 'undefined') {
                try {
                    if (import.meta.env.PROD && PROD_LOGOUT_REDIRECT_ORIGIN) {
                        window.location.replace(`${PROD_LOGOUT_REDIRECT_ORIGIN}/login?logout=1`);
                        return;
                    }
                    const { protocol, hostname, port } = window.location;
                    const isSubdomainLocalhost =
                        hostname.endsWith('.localhost') && hostname !== 'localhost';
                    if (isSubdomainLocalhost) {
                        const host = port ? `localhost:${port}` : 'localhost';
                        window.location.replace(`${protocol}//${host}/login?logout=1`);
                        return;
                    }
                } catch (_error) {
                    // Fall back to router navigation.
                }
            }
            import('@/router').then(({ default: router }) => {
                if (router.currentRoute.value.name !== 'login') {
                    router.replace({ name: 'login' }).catch(() => {});
                }
            }).catch(() => {});
        },
        
        // Check if user has a specific permission
        can(module, action) {
            const role = this.user?.role || '';
            if (this.user?.isOwner || role.toLowerCase() === 'admin' || role.toLowerCase() === 'owner') return true;
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
                const response = await fetch(getApiUrlForFetch('/api/v2/organization'), {
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
        async refreshUser(options = {}) {
            if (!this.user?.token) {
                console.warn('No user token available for refresh');
                return false;
            }

            const force = options.force === true;
            if (!force) {
                const lastRefreshedAt = Number(localStorage.getItem(PROFILE_REFRESHED_AT_KEY) || 0);
                if (lastRefreshedAt && Date.now() - lastRefreshedAt < PROFILE_REFRESH_FRESH_MS) {
                    return true;
                }
            }
            
            try {
                logAuthAccessDebug('Refreshing user permissions...');
                const response = await fetch(getApiUrlForFetch('/api/users/profile'), {
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
                            const forms = {
                                view: !!rolePerms.forms?.read,
                                create: !!rolePerms.forms?.create,
                                edit: !!rolePerms.forms?.update,
                                delete: !!rolePerms.forms?.delete,
                                viewAll: !!rolePerms.forms?.viewAll,
                                exportData: !!rolePerms.forms?.export,
                            };
                            const items = {
                                view: !!rolePerms.items?.read,
                                create: !!rolePerms.items?.create,
                                edit: !!rolePerms.items?.update,
                                delete: !!rolePerms.items?.delete,
                                viewAll: !!rolePerms.items?.viewAll,
                                exportData: !!rolePerms.items?.export,
                            };
                            const imports = {
                                view: !!(rolePerms.contacts?.import || rolePerms.deals?.import),
                                create: !!(rolePerms.contacts?.import || rolePerms.deals?.import),
                                delete: false,
                            };
                            const settings = {
                                view: !!rolePerms.settings?.view,
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
                            const built = { contacts, organizations, deals, tasks, events, forms, items, imports, settings, reports };
                            built.people = built.contacts;
                            return built;
                        };

                        const incoming = data.data;
                        // Safety: if the profile endpoint returns a different user than the one in memory,
                        // do NOT silently switch accounts (this can happen with stale/incorrect tokens).
                        if (this.user?._id && incoming?._id && String(incoming._id) !== String(this.user._id)) {
                            console.warn('Auth mismatch: profile returned a different user. Logging out for safety.', {
                                currentUserId: this.user._id,
                                incomingUserId: incoming._id,
                                currentEmail: this.user.email,
                                incomingEmail: incoming.email
                            });
                            this.logout();
                            return false;
                        }
                        const ensuredPermissions = incoming.permissions || deriveFromRole(incoming.roleId?.permissions) || {};
                        if (ensuredPermissions.contacts && !ensuredPermissions.people) {
                            ensuredPermissions.people = ensuredPermissions.contacts;
                        }
                        // Ensure newly added modules exist so the sidebar can render them immediately.
                        if (!ensuredPermissions.forms) ensuredPermissions.forms = { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false };
                        if (!ensuredPermissions.items) ensuredPermissions.items = { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false };
                        // Update user data while preserving token and allowedApps
                        const token = this.user.token;
                        const existingAllowedApps = this.user.allowedApps;
                        this.user = {
                            ...incoming,
                            permissions: ensuredPermissions,
                            token: token,
                            allowedApps: this.resolveAllowedApps(incoming, {
                                fallbackAllowedApps: existingAllowedApps,
                                organization: incoming.organizationId || this.organization
                            })
                        };
                        localStorage.setItem('user', JSON.stringify(this.user));
                        localStorage.setItem(PROFILE_REFRESHED_AT_KEY, String(Date.now()));
                        
                        // Update organization if included in response (for enabledApps)
                        if (incoming.organizationId && typeof incoming.organizationId === 'object') {
                            this.organization = incoming.organizationId;
                            localStorage.setItem('organization', JSON.stringify(this.organization));
                        }
                        identifyProductUser({
                            _id: this.user?._id,
                            email: this.user?.email,
                            organizationId: this.organization?._id
                                ? String(this.organization._id)
                                : undefined,
                        });
                        logAuthAccessDebug('User permissions refreshed successfully');
                        return true;
                    }
                } else if (response.status === 401) {
                    if (!isOnPublicShellRoute()) {
                        console.warn('Session expired, logging out');
                        this.logout();
                    }
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

registerUseAuthStore(useAuthStore);

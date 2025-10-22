<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';

const authStore = useAuthStore();

// Active tab
const activeTab = ref('users');

// Users data
const users = ref([]);
const loadingUsers = ref(false);
const showInviteModal = ref(false);

// Invite form
const inviteForm = ref({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    phoneNumber: ''
});

const roleOptions = [
    { value: 'admin', label: 'Admin', description: 'Full access except billing' },
    { value: 'manager', label: 'Manager', description: 'Can manage most resources' },
    { value: 'user', label: 'User', description: 'Standard user access' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
];

// Computed
const canManageUsers = computed(() => authStore.can('settings', 'manageUsers'));
const currentUserId = computed(() => authStore.user?._id);

// Fetch users
const fetchUsers = async () => {
    loadingUsers.value = true;
    try {
        const data = await apiClient('/users');
        users.value = data.data;
    } catch (error) {
        console.error('Error fetching users:', error);
    } finally {
        loadingUsers.value = false;
    }
};

// Invite user
const inviteUser = async () => {
    try {
        await apiClient('/users', {
            method: 'POST',
            body: JSON.stringify(inviteForm.value)
        });
        
        showInviteModal.value = false;
        inviteForm.value = {
            email: '',
            firstName: '',
            lastName: '',
            role: 'user',
            phoneNumber: ''
        };
        
        await fetchUsers();
    } catch (error) {
        console.error('Error inviting user:', error);
        alert(error.message || 'Failed to invite user');
    }
};

// Update user role
const updateUserRole = async (userId, newRole) => {
    try {
        await apiClient(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ role: newRole })
        });
        await fetchUsers();
    } catch (error) {
        console.error('Error updating user:', error);
        alert(error.message || 'Failed to update user');
    }
};

// Deactivate user
const deactivateUser = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
        await apiClient(`/users/${userId}`, {
            method: 'DELETE'
        });
        await fetchUsers();
    } catch (error) {
        console.error('Error deactivating user:', error);
        alert(error.message || 'Failed to deactivate user');
    }
};

// Get role badge color
const getRoleBadgeClass = (role) => {
    const colors = {
        owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        manager: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        user: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        viewer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    };
    return colors[role] || colors.user;
};

// Lifecycle
onMounted(() => {
    if (canManageUsers.value) {
        fetchUsers();
    }
});
</script>

<template>
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p class="text-gray-600 dark:text-gray-400 mt-2">Manage your organization settings and users</p>
            </div>

            <!-- Tabs -->
            <div class="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav class="flex space-x-8">
                    <button
                        @click="activeTab = 'users'"
                        :class="[
                            'pb-4 px-1 border-b-2 font-medium text-sm',
                            activeTab === 'users'
                                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                        ]"
                    >
                        Users & Permissions
                    </button>
                    <button
                        @click="activeTab = 'organization'"
                        :class="[
                            'pb-4 px-1 border-b-2 font-medium text-sm',
                            activeTab === 'organization'
                                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                        ]"
                    >
                        Organization
                    </button>
                    <button
                        @click="activeTab = 'subscription'"
                        :class="[
                            'pb-4 px-1 border-b-2 font-medium text-sm',
                            activeTab === 'subscription'
                                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                        ]"
                    >
                        Subscription
                    </button>
                </nav>
            </div>

            <!-- Users Tab -->
            <div v-if="activeTab === 'users'" class="bg-white dark:bg-gray-800 rounded-lg shadow">
                <!-- No Permission -->
                <div v-if="!canManageUsers" class="p-6 text-center">
                    <p class="text-gray-600 dark:text-gray-400">You don't have permission to manage users.</p>
                </div>

                <!-- Users List -->
                <div v-else>
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
                        <button
                            @click="showInviteModal = true"
                            class="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                            + Invite User
                        </button>
                    </div>

                    <!-- Loading -->
                    <div v-if="loadingUsers" class="p-6 text-center">
                        <p class="text-gray-600 dark:text-gray-400">Loading users...</p>
                    </div>

                    <!-- Users Table -->
                    <div v-else class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                <tr v-for="user in users" :key="user._id">
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="flex items-center">
                                            <div class="flex-shrink-0 h-10 w-10">
                                                <div class="h-10 w-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-medium">
                                                    {{ user.firstName?.[0] || user.username?.[0] || 'U' }}
                                                </div>
                                            </div>
                                            <div class="ml-4">
                                                <div class="text-sm font-medium text-gray-900 dark:text-white">
                                                    {{ user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username }}
                                                </div>
                                                <div v-if="user._id === currentUserId" class="text-xs text-gray-500 dark:text-gray-400">(You)</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                        {{ user.email }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span v-if="user.isOwner" :class="['px-2 py-1 text-xs rounded-full', getRoleBadgeClass('owner')]">
                                            Owner
                                        </span>
                                        <select
                                            v-else
                                            :value="user.role"
                                            @change="updateUserRole(user._id, $event.target.value)"
                                            class="px-2 py-1 text-xs rounded border-0 focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
                                            :class="getRoleBadgeClass(user.role)"
                                        >
                                            <option v-for="option in roleOptions" :key="option.value" :value="option.value">
                                                {{ option.label }}
                                            </option>
                                        </select>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="[
                                            'px-2 py-1 text-xs rounded-full',
                                            user.status === 'active' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        ]">
                                            {{ user.status }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            v-if="!user.isOwner && user._id !== currentUserId"
                                            @click="deactivateUser(user._id)"
                                            class="text-red-600 hover:text-red-900 dark:text-red-400"
                                        >
                                            Deactivate
                                        </button>
                                        <span v-else class="text-gray-400">-</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Organization Tab -->
            <div v-if="activeTab === 'organization'" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organization Settings</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization Name</label>
                        <input
                            type="text"
                            :value="authStore.organization?.name"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            disabled
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Industry</label>
                        <input
                            type="text"
                            :value="authStore.organization?.industry"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            disabled
                        />
                    </div>
                </div>
            </div>

            <!-- Subscription Tab -->
            <div v-if="activeTab === 'subscription'" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subscription Details</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan</label>
                        <p class="mt-1 text-lg font-bold text-brand-600 dark:text-brand-400 capitalize">
                            {{ authStore.subscriptionTier }}
                        </p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                        <p class="mt-1">
                            <span :class="[
                                'px-2 py-1 text-xs rounded-full',
                                authStore.organization?.subscription?.status === 'trial'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            ]">
                                {{ authStore.organization?.subscription?.status }}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Invite User Modal -->
        <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invite Team Member</h3>
                
                <form @submit.prevent="inviteUser" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
                        <input
                            v-model="inviteForm.email"
                            type="email"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                            <input
                                v-model="inviteForm.firstName"
                                type="text"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                            <input
                                v-model="inviteForm.lastName"
                                type="text"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Role *</label>
                        <select
                            v-model="inviteForm.role"
                            required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option v-for="option in roleOptions" :key="option.value" :value="option.value">
                                {{ option.label }} - {{ option.description }}
                            </option>
                        </select>
                    </div>
                    
                    <div class="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            @click="showInviteModal = false"
                            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                            Send Invitation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>


<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 sm:p-8" @click="$emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isEditing ? 'Edit Group' : 'New Group' }}
          </h2>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Group Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="e.g., Sales Team, Engineering Department"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              :class="{ 'border-red-500': formErrors.name }"
            />
            <p v-if="formErrors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ formErrors.name }}</p>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="Describe the purpose of this group..."
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <!-- Type and Color -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <Combobox v-model="form.type" nullable>
                <div class="relative">
                  <ComboboxButton
                    class="relative w-full cursor-default rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                  >
                    <span class="block truncate">{{ form.type || 'Select type...' }}</span>
                    <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span>
                  </ComboboxButton>
                  <ComboboxOptions
                    class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                  >
                    <ComboboxOption
                      v-for="typeOption in typeOptions"
                      :key="typeOption.value"
                      :value="typeOption.value"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'relative cursor-default select-none py-2 pl-10 pr-4',
                          active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-100'
                        ]"
                      >
                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                          {{ typeOption.label }}
                        </span>
                        <span
                          v-if="selected"
                          :class="[
                            'absolute inset-y-0 left-0 flex items-center pl-3',
                            active ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'
                          ]"
                        >
                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                        </span>
                      </li>
                    </ComboboxOption>
                  </ComboboxOptions>
                </div>
              </Combobox>
            </div>

            <!-- Color -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div class="flex items-center gap-3">
                <input
                  v-model="form.color"
                  type="color"
                  class="h-10 w-20 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  v-model="form.color"
                  type="text"
                  placeholder="#3B82F6"
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <!-- Role & Permissions -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Roles & Permissions
            </label>
            <div 
              class="relative"
              v-click-outside="() => { showRoleDropdown = false; }"
            >
              <button
                type="button"
                @click="showRoleDropdown = !showRoleDropdown"
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <div v-if="selectedRoles.length === 0" class="text-gray-500 dark:text-gray-400">
                      Select roles...
                    </div>
                    <div v-else class="flex flex-wrap gap-2">
                      <span
                        v-for="role in selectedRoles"
                        :key="role._id"
                        class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-white"
                        :style="{ backgroundColor: role.color || '#6366f1' }"
                      >
                        {{ role.name }}
                        <button
                          type="button"
                          @click.stop="toggleRole(role._id)"
                          class="hover:opacity-75"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  </div>
                  <svg 
                    class="w-5 h-5 text-gray-400 ml-2 flex-shrink-0 transition-transform" 
                    :class="{ 'rotate-180': showRoleDropdown }" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              <!-- Dropdown Menu -->
              <Transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <div
                  v-if="showRoleDropdown"
                  class="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-auto"
                >
                  <div class="p-2">
                    <!-- Search input -->
                    <div class="relative mb-2">
                      <input
                        v-model="roleSearchQuery"
                        @click.stop
                        type="text"
                        class="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-left text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Search roles..."
                      />
                      <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                    
                    <!-- Role list with checkboxes -->
                    <div class="space-y-1">
                      <label
                        v-for="role in filteredRoles"
                        :key="role._id"
                        class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                        @click.stop
                      >
                        <input
                          type="checkbox"
                          :checked="isRoleSelected(role._id)"
                          @change="toggleRole(role._id)"
                          class="w-5 h-5 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 mt-0.5 flex-shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span 
                              class="inline-block w-3 h-3 rounded-full flex-shrink-0"
                              :style="{ backgroundColor: role.color || '#6366f1' }"
                            ></span>
                            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ role.name }}</span>
                          </div>
                          <span v-if="role.description" class="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                            {{ role.description }}
                          </span>
                        </div>
                      </label>
                      
                      <div v-if="filteredRoles.length === 0" class="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No roles found
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Assign one or more roles to this group to apply permissions to all members
            </p>
          </div>

          <!-- Lead -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Group Lead
            </label>
            <Combobox v-model="form.lead" nullable>
              <div class="relative">
                <ComboboxButton class="w-full">
                  <ComboboxInput
                    class="w-full rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm cursor-pointer"
                    :display-value="() => getSelectedLeadDisplay()"
                    @change="leadSearchQuery = $event.target.value"
                    placeholder="Search users..."
                  />
                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span>
                </ComboboxButton>
                <ComboboxOptions
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                >
                  <ComboboxOption
                    :value="null"
                    v-slot="{ active, selected }"
                  >
                    <li
                      :class="[
                        'relative cursor-default select-none py-2 pl-10 pr-4',
                        active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-100'
                      ]"
                    >
                      <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                        No lead assigned
                      </span>
                      <span
                        v-if="selected"
                        :class="[
                          'absolute inset-y-0 left-0 flex items-center pl-3',
                          active ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'
                        ]"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ComboboxOption>
                  <ComboboxOption
                    v-for="user in filteredAvailableUsers"
                    :key="user._id"
                    :value="user._id"
                    v-slot="{ active, selected }"
                  >
                    <li
                      :class="[
                        'relative cursor-default select-none py-2 pl-10 pr-4',
                        active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-100'
                      ]"
                    >
                      <div class="flex items-center gap-2">
                        <div 
                          v-if="user.avatar"
                          class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"
                        >
                          <img :src="user.avatar" :alt="getUserDisplayName(user)" class="w-full h-full object-cover" />
                        </div>
                        <div 
                          v-else
                          class="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        >
                          {{ getUserInitials(user) }}
                        </div>
                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate flex-1']">
                          {{ getUserDisplayName(user) }}
                        </span>
                        <span
                          v-if="selected"
                          :class="[
                            'flex-shrink-0',
                            active ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'
                          ]"
                        >
                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                        </span>
                      </div>
                    </li>
                  </ComboboxOption>
                  <div v-if="filteredAvailableUsers.length === 0" class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No users found
                  </div>
                </ComboboxOptions>
              </div>
            </Combobox>
          </div>

          <!-- Members -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Members
            </label>
            <div class="space-y-2">
              <!-- Selected Members -->
              <div v-if="selectedMembers.length > 0" class="flex flex-wrap gap-2 mb-3">
                <div
                  v-for="member in selectedMembers"
                  :key="member._id"
                  class="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 rounded-lg text-sm"
                >
                  <div 
                    v-if="member.avatar"
                    class="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"
                  >
                    <img :src="member.avatar" :alt="getUserDisplayName(member)" class="w-full h-full object-cover" />
                  </div>
                  <div 
                    v-else
                    class="w-5 h-5 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  >
                    {{ getUserInitials(member) }}
                  </div>
                  <span>{{ getUserDisplayName(member) }}</span>
                  <button
                    type="button"
                    @click="removeMember(member._id)"
                    class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Add Member Multi-select (stays open) -->
              <div class="relative">
                <button
                  type="button"
                  @click.stop.prevent="toggleMemberDropdown"
                  class="w-full rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm cursor-pointer"
                >
                  <input
                    v-if="showMemberDropdown"
                    v-model="memberSearchQuery"
                    type="text"
                    @click.stop
                    @mousedown.stop
                    placeholder="Search and add members..."
                    class="w-full bg-transparent border-0 focus:ring-0 p-0 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-none"
                    autocomplete="off"
                  />
                  <span v-else class="block truncate text-gray-500 dark:text-gray-400">Search and add members...</span>
                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span>
                </button>
                
                <!-- Dropdown Options (stays open) -->
                <Transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="opacity-0 scale-95"
                  enter-to-class="opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="opacity-100 scale-100"
                  leave-to-class="opacity-0 scale-95"
                >
                  <div
                    v-if="showMemberDropdown"
                    v-click-outside="() => { showMemberDropdown = false; console.log('🔽 Dropdown closed by click outside'); }"
                    @click.stop
                    class="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                  >
                    
                    <!-- Options list -->
                    <div class="max-h-48 overflow-auto">
                      <div v-if="filteredAvailableUsersForMembers.length === 0" class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No users available to add
                      </div>
                      <button
                        v-for="user in filteredAvailableUsersForMembers"
                        :key="user._id"
                        type="button"
                        @click.stop="handleMemberSelected(user._id)"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors',
                          (form.value?.members || []).includes(user._id)
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                        ]"
                      >
                        <div class="flex items-center gap-2">
                          <div 
                            v-if="user.avatar"
                            class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"
                          >
                            <img :src="user.avatar" :alt="getUserDisplayName(user)" class="w-full h-full object-cover" />
                          </div>
                          <div 
                            v-else
                            class="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          >
                            {{ getUserInitials(user) }}
                          </div>
                          <span :class="['block truncate flex-1', (form.value?.members || []).includes(user._id) ? 'font-medium' : 'font-normal']">
                            {{ getUserDisplayName(user) }}
                          </span>
                          <span
                            v-if="(form.value?.members || []).includes(user._id)"
                            class="flex-shrink-0 text-indigo-600 dark:text-indigo-400"
                          >
                            <CheckIcon class="h-5 w-5" aria-hidden="true" />
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- Status -->
          <div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                v-model="form.isActive"
                type="checkbox"
                class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Inactive groups will be hidden from most views</p>
          </div>

          <!-- Form Actions -->
          <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pt-6 -mx-6 -mb-6 px-6 pb-6 flex items-center justify-end gap-3">
            <button 
              type="button" 
              @click="$emit('close')" 
              class="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="saving || !form.name" 
              class="px-6 py-2.5 rounded-lg bg-brand-600 dark:bg-brand-700 text-white font-medium hover:bg-brand-700 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ saving ? 'Saving...' : (isEditing ? 'Update Group' : 'Create Group') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/vue';
import { CheckIcon } from '@heroicons/vue/24/solid';
import { ChevronUpDownIcon } from '@heroicons/vue/24/outline';
import { Transition } from 'vue';
import apiClient from '@/utils/apiClient';

// Click outside directive for dropdown
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value();
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent);
  }
};

const props = defineProps({
  group: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const isEditing = computed(() => !!props.group);
const saving = ref(false);
const availableUsers = ref([]);
const availableRoles = ref([]);
const newMemberId = ref('');
const formErrors = ref({});
const leadSearchQuery = ref('');
const memberSearchQuery = ref('');
const showMemberDropdown = ref(false);
const roleSearchQuery = ref('');
const showRoleDropdown = ref(false);

// Type options for Combobox
const typeOptions = [
  { value: 'Team', label: 'Team' },
  { value: 'Department', label: 'Department' },
  { value: 'Project', label: 'Project' },
  { value: 'Custom', label: 'Custom' }
];

const form = ref({
  name: '',
  description: '',
  type: 'Team',
  color: '#3B82F6',
  roleIds: [],
  lead: null,
  members: [],
  isActive: true
});

const selectedMembers = computed(() => {
  if (!form.value || !form.value.members || !Array.isArray(form.value.members)) {
    return [];
  }
  return availableUsers.value.filter(user => 
    form.value.members.includes(user._id)
  );
});

// Filtered users for lead selection
const filteredAvailableUsers = computed(() => {
  if (!leadSearchQuery.value) {
    return availableUsers.value;
  }
  const query = leadSearchQuery.value.toLowerCase();
  return availableUsers.value.filter(user => {
    const name = getUserDisplayName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });
});

// Filtered users for member selection (excluding already selected)
const filteredAvailableUsersForMembers = computed(() => {
  const query = memberSearchQuery.value.toLowerCase();
  const members = (form.value?.members || []);
  const unselected = availableUsers.value.filter(u => 
    !members.includes(u._id)
  );
  
  if (!query) {
    return unselected;
  }
  
  return unselected.filter(user => {
    const name = getUserDisplayName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });
});

// Get selected lead display text
const getSelectedLeadDisplay = () => {
  if (!form.value.lead) return 'No lead assigned';
  const lead = availableUsers.value.find(u => u._id === form.value.lead);
  return lead ? getUserDisplayName(lead) : 'No lead assigned';
};

// Fetch available users
const fetchUsers = async () => {
  try {
    console.log('🔍 Fetching users from /users/list...');
    const response = await apiClient.get('/users/list'); // apiClient already prepends /api
    console.log('📦 Users API response:', {
      hasResponse: !!response,
      isArray: Array.isArray(response),
      hasSuccess: response?.success,
      hasData: !!response?.data,
      dataIsArray: Array.isArray(response?.data),
      dataLength: Array.isArray(response?.data) ? response.data.length : response?.data?.length || 0,
      fullResponse: response
    });
    
    // Handle different response formats
    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (response?.success && Array.isArray(response.data)) {
      users = response.data;
    } else if (Array.isArray(response?.data)) {
      users = response.data;
    } else if (response?.data && typeof response.data === 'object') {
      // Handle case where data might be an object with a users array
      users = response.data.users || response.data.data || [];
    }
    
    availableUsers.value = users;
    console.log(`✅ Loaded ${users.length} users:`, users.map(u => ({ 
      id: u._id, 
      name: getUserDisplayName(u),
      email: u.email 
    })));
    
    // If still no users, log warning
    if (users.length === 0) {
      console.warn('⚠️ No users found. Check if:');
      console.warn('   1. Users exist in the organization');
      console.warn('   2. Users have status: "active"');
      console.warn('   3. User is authenticated and has organizationId');
    }
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    availableUsers.value = [];
  }
};

// Watch for lead changes and auto-add to members
watch(() => form.value.lead, (newLead, oldLead) => {
  if (newLead && !form.value.members.includes(newLead)) {
    // Automatically add lead to members if not already a member
    form.value.members.push(newLead);
  }
});

// Fetch roles for dropdown
const fetchRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableRoles.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching roles:', error);
  }
};

// Filtered roles for selection
const filteredRoles = computed(() => {
  if (!roleSearchQuery.value) {
    return availableRoles.value;
  }
  const query = roleSearchQuery.value.toLowerCase();
  return availableRoles.value.filter(role => {
    const name = (role.name || '').toLowerCase();
    const description = (role.description || '').toLowerCase();
    return name.includes(query) || description.includes(query);
  });
});

// Check if a role is selected
const isRoleSelected = (roleId) => {
  return form.value.roleIds?.includes(roleId) || false;
};

// Toggle role selection
const toggleRole = (roleId) => {
  if (!form.value.roleIds) {
    form.value.roleIds = [];
  }
  const index = form.value.roleIds.indexOf(roleId);
  if (index > -1) {
    form.value.roleIds.splice(index, 1);
  } else {
    form.value.roleIds.push(roleId);
  }
};

// Get selected roles
const selectedRoles = computed(() => {
  if (!form.value.roleIds || !Array.isArray(form.value.roleIds)) {
    return [];
  }
  return availableRoles.value.filter(role => 
    form.value.roleIds.includes(role._id)
  );
});

// Initialize form when group prop changes
watch(() => props.group, (newGroup) => {
  if (newGroup) {
    const leadId = newGroup.lead?._id || newGroup.lead || null;
    const memberIds = newGroup.members?.map(m => m._id || m) || [];
    
    // Handle roleIds - could be array of objects or array of IDs
    let roleIds = [];
    if (newGroup.roleIds) {
      roleIds = newGroup.roleIds.map(r => r._id || r).filter(Boolean);
    } else if (newGroup.roleId) {
      // Backward compatibility with old roleId field
      roleIds = [newGroup.roleId._id || newGroup.roleId].filter(Boolean);
    }
    
    // Ensure lead is in members if lead is set
    if (leadId && !memberIds.includes(leadId)) {
      memberIds.push(leadId);
    }
    
    form.value = {
      name: newGroup.name || '',
      description: newGroup.description || '',
      type: newGroup.type || 'Team',
      color: newGroup.color || '#3B82F6',
      roleIds: roleIds,
      lead: leadId,
      members: memberIds,
      isActive: newGroup.isActive !== undefined ? newGroup.isActive : true
    };
  } else {
    // Reset form
    form.value = {
      name: '',
      description: '',
      type: 'Team',
      color: '#3B82F6',
      roleIds: [],
      lead: null,
      members: [],
      isActive: true
    };
  }
}, { immediate: true });

const toggleMemberDropdown = () => {
  showMemberDropdown.value = !showMemberDropdown.value;
  console.log('🔽 Toggle member dropdown:', showMemberDropdown.value);
};

const handleMemberSelected = (userId) => {
  if (!userId) return;
  
  console.log('👤 Member selected:', userId);
  
  // Toggle member selection (add if not present, remove if present)
  const memberIndex = form.value.members.indexOf(userId);
  if (memberIndex > -1) {
    // Remove member
    form.value.members.splice(memberIndex, 1);
  } else {
    // Add member
    form.value.members.push(userId);
  }
  
  // Keep search query for continued searching
  // Don't clear newMemberId or memberSearchQuery - keep combobox open
};

const addMember = () => {
  // Fallback for direct calls
  if (newMemberId.value && !form.value.members.includes(newMemberId.value)) {
    form.value.members.push(newMemberId.value);
    newMemberId.value = '';
    memberSearchQuery.value = '';
  }
};

const removeMember = (userId) => {
  form.value.members = form.value.members.filter(id => id !== userId);
  // If removed member was the lead, clear lead
  if (form.value.lead === userId) {
    form.value.lead = null;
  }
};

const handleSubmit = async () => {
  saving.value = true;
  formErrors.value = {};

  try {
    // Validate
    if (!form.value.name || form.value.name.trim() === '') {
      formErrors.value.name = 'Group name is required';
      saving.value = false;
      return;
    }

    // Prepare submit data
    const submitData = {
      name: form.value.name.trim(),
      description: form.value.description?.trim() || '',
      type: form.value.type,
      color: form.value.color,
      roleIds: form.value.roleIds || [],
      lead: form.value.lead || null,
      members: form.value.members,
      isActive: form.value.isActive
    };

    let data;
    if (isEditing.value) {
      data = await apiClient.put(`/groups/${props.group._id}`, submitData);
    } else {
      data = await apiClient.post('/groups', submitData);
    }

    if (data.success) {
      emit('saved', data.data);
    }
  } catch (error) {
    console.error('Error saving group:', error);
    if (error.response?.data?.errors) {
      formErrors.value = error.response.data.errors;
    } else {
      alert(error.message || 'Failed to save group');
    }
  } finally {
    saving.value = false;
  }
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.username) return user.username;
  if (user.email) return user.email;
  return 'Unknown User';
};

const getUserInitials = (user) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return '?';
};

onMounted(() => {
  fetchUsers();
  fetchRoles();
});
</script>


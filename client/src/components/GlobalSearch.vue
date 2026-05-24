<template>
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="close"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50" @click="close"></div>

      <!-- Search Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative w-full max-w-2xl transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all"
          @click.stop
        >
          <!-- Search Input -->
          <div class="relative border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center px-4 py-3">
              <MagnifyingGlassIcon class="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3 flex-shrink-0" />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                :placeholder="t('navigation.globalSearchPlaceholder')"
                class="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-lg"
                @keydown.esc="handleEscape"
                @keydown.down.prevent="navigateResults(1)"
                @keydown.up.prevent="navigateResults(-1)"
                @keydown.enter.prevent="selectResult"
              />
              <kbd
                v-if="!searchQuery"
                class="hidden sm:inline-flex items-center px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
              >
                ESC
              </kbd>
            </div>
          </div>

          <!-- Results -->
          <div class="max-h-96 overflow-y-auto">
            <!-- Loading -->
            <div v-if="loading" class="px-4 py-8 text-center">
              <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ t('navigation.globalSearchSearching') }}</p>
            </div>

            <!-- No Results -->
            <div
              v-else-if="!loading && (
                (mode === 'command' && searchQuery && filteredCommands.length === 0) ||
                (mode === 'search' && searchQuery && searchQuery.length >= 2 && totalResults === 0)
              )"
              class="px-4 py-8 text-center"
            >
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ mode === 'command' ? t('navigation.globalSearchNoCommands') : t('navigation.globalSearchNoResults') }}
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ mode === 'command' ? t('navigation.globalSearchNoCommandsHint') : t('navigation.globalSearchNoResultsHint') }}
              </p>
            </div>

            <!-- Confirmation Step (for destructive commands) -->
            <!-- 
              Inline confirmation for destructive commands.
              Shown when user presses Enter on a destructive command.
              Escape cancels, Enter confirms.
              
              WHY INLINE:
              - Keeps user in flow (no modal interruption)
              - Maintains keyboard-first interaction
              - Clear, calm language: "Are you sure?"
              - No browser confirm() dialogs (better UX)
            -->
            <div v-if="!loading && pendingDestructiveCommand" class="px-4 py-8">
              <div class="text-center">
                <p class="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {{ t('navigation.globalSearchConfirmTitle') }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {{ pendingDestructiveCommand.label }}
                </p>
                <div class="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">ESC</kbd>
                  <span>{{ t('navigation.globalSearchToCancel') }}</span>
                  <span class="mx-2">•</span>
                  <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">Enter</kbd>
                  <span>{{ t('navigation.globalSearchToConfirm') }}</span>
                </div>
              </div>
            </div>

            <!-- Results List -->
            <!-- Command mode: Show commands instead of search results -->
            <!-- Search mode: Show entity search results -->
            <div v-else-if="!loading && !pendingDestructiveCommand && (mode === 'command' ? filteredCommands.length > 0 : totalResults > 0)" class="py-2">
              <!-- Command Mode Results -->
              <!-- 
                UX PRINCIPLES:
                - One-column list: Simple, scannable, no visual clutter
                - Label primary: Clear action intent, easy to scan
                - Description secondary/muted: Context without distraction
                - Keyboard-only navigation: Fast, power-user friendly, no mouse dependency
                - No mouse-only affordances: Everything accessible via keyboard
                - Commands feel intentional and decisive (no entity grouping)
                
                WHY SIMPLICITY BEATS DISCOVERABILITY:
                - Command Palette is for explicit user intent, not exploration
                - Users who use commands know what they want to do
                - Simplicity = faster execution = better UX for power users
                - Discoverability belongs in Search mode (entity browsing)
                - Complex UI would violate "scannable in under 2 seconds" principle
                
                See: docs/architecture/command-palette-invariants.md
              -->
              <template v-if="mode === 'command'">
                <!-- Commands Header -->
                <div class="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                  {{ t('navigation.globalSearchCommandsHeader') }}
                </div>
                
                <!-- Commands List (flat, no grouping) -->
                <div
                  v-for="(command, index) in filteredCommands"
                  :key="command.id"
                  :ref="el => setCommandRef(el, index)"
                  :class="[
                    'w-full px-4 py-3 text-left transition-colors cursor-pointer',
                    selectedIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  ]"
                  @mouseenter="handleCommandHover(index)"
                  @mousedown.prevent
                  @click="handleCommandClick(command, index)"
                  role="option"
                  :aria-selected="selectedIndex === index"
                >
                  <!-- One-column layout: Label primary, description secondary -->
                  <div class="flex flex-col">
                    <!-- Primary: Label -->
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ command.label }}
                    </div>
                    <!-- Secondary: Description (muted) -->
                    <div v-if="command.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {{ command.description }}
                    </div>
                  </div>
                </div>
              </template>

              <!-- Search Mode Results -->
              <template v-else>
                <div
                  v-for="groupKey in prioritizedGroups"
                  :key="groupKey"
                  class="mb-2"
                >
                  <!-- Group Header -->
                  <div class="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                    {{ getGroupLabel(groupKey) }}
                  </div>

                  <!-- Group Results -->
                  <button
                    v-for="(result, index) in groupedResults[groupKey]"
                    :key="`${result.type}-${result.id}`"
                    :ref="el => setResultRef(el, groupKey, index)"
                    :class="[
                      'w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                      isSelected(groupKey, index) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    ]"
                    @click="navigateToResult(result)"
                  >
                    <div class="flex items-center gap-3">
                      <span class="text-xl flex-shrink-0">{{ result.icon }}</span>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {{ result.title }}
                        </div>
                        <div v-if="result.subtitle" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {{ result.subtitle }}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </template>

              <!-- Discoverability hint (subtle, non-intrusive) -->
              <!-- 
                Show hint only when:
                - Search is focused (modal is open)
                - User hasn't used "/" in this session
                - In search mode (not command mode)
                - Not showing confirmation
                
                This is discoverability, not onboarding - disappears once user discovers the feature.
              -->
              <div 
                v-if="mode === 'search' && !hasUsedCommandTrigger && !pendingDestructiveCommand"
                class="px-4 py-2 border-t border-gray-200 dark:border-gray-700"
              >
                <p class="text-xs text-gray-400 dark:text-gray-500 text-center">
                  {{ t('navigation.globalSearchSlashHint') }}
                </p>
              </div>
            </div>

            <!-- Empty State -->
            <!-- 
              Command mode empty state shows when:
              - No query entered (just '/' or empty) → Show examples
              - Query entered but no matches → Show "No matching commands"
              
              Search mode empty state shows when query is too short (< 2 chars).
            -->
            <div
              v-else-if="!loading && (
                mode === 'command' 
                  ? (isCommandQueryEmpty || filteredCommands.length === 0)
                  : (!searchQuery || searchQuery.length < 2)
              )"
              class="px-4 py-8"
            >
              <!-- Command Mode Empty State -->
              <template v-if="mode === 'command'">
                <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                  {{ isCommandQueryEmpty ? t('navigation.globalSearchTypeToFind') : t('navigation.globalSearchNoCommands') }}
                </p>
                <!-- Example commands as hints (non-clickable) -->
                <!-- 
                  Show examples only when query is empty.
                  Examples help users understand what commands are available
                  without cluttering the interface with all commands.
                -->
                <div v-if="isCommandQueryEmpty && exampleCommands.length > 0" class="space-y-2">
                  <div
                    v-for="example in exampleCommands"
                    :key="example.id"
                    class="px-4 py-2 text-sm text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded"
                  >
                    <div class="font-medium">{{ example.label }}</div>
                    <div v-if="example.description" class="text-xs mt-0.5">{{ example.description }}</div>
                  </div>
                </div>
              </template>
              <!-- Search Mode Empty State -->
              <template v-else>
                <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">
                  {{ t('navigation.globalSearchStartTyping') }}
                </p>
                <!-- Discoverability hint in empty state -->
                <p 
                  v-if="!hasUsedCommandTrigger"
                  class="text-xs text-gray-400 dark:text-gray-500 text-center"
                >
                  {{ t('navigation.globalSearchSlashHint') }}
                </p>
              </template>
            </div>
          </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Link Records Drawer (for action commands) -->
    <LinkRecordsDrawer
      :isOpen="showLinkDrawer"
      :moduleKey="linkDrawerModuleKey"
      :multiple="true"
      :title="linkDrawerTitle"
      :context="linkDrawerContext"
      :allowCreate="linkDrawerAllowCreate"
      @close="handleLinkDrawerClose"
      @linked="handleLinkDrawerLinked"
      @create="handleLinkDrawerCreate"
    />

    <!-- Organization Quick Create Drawer (dedicated Quick Create flow) -->
    <!-- People Quick Create Drawer -->
    <!-- ARCHITECTURAL INTENT: Opens in same tab, not navigating to new route -->
    <PeopleQuickCreateDrawer
      :isOpen="showPeopleDrawer"
      :context-app-key="peopleDrawerContextAppKey"
      @close="handlePeopleDrawerClose"
      @saved="handlePeopleDrawerSaved"
    />
    
    <!-- Event Quick Create Drawer -->
    <!-- ARCHITECTURAL INTENT: Opens in same tab, not navigating to new route -->
    <EventQuickCreateDrawer
      :isOpen="showEventDrawer"
      @close="handleEventDrawerClose"
      @saved="handleEventDrawerSaved"
    />
    
    <!-- ARCHITECTURAL INTENT: Organization Quick Create is separate from full create/edit flows -->
    <!-- It strictly respects Settings → Core Modules → Organizations → Quick Create configuration -->
    <!-- Command palette actions must NEVER navigate to list views - they open this Quick Create flow -->
    <OrganizationQuickCreateDrawer
      v-if="createDrawerModuleKey === 'organizations'"
      :isOpen="showCreateDrawer && createDrawerModuleKey === 'organizations'"
      :initialData="createDrawerInitialData"
      :autoLinkContext="createDrawerAutoLinkContext"
      @close="handleCreateDrawerClose"
      @saved="handleCreateDrawerSaved"
    />
    
    <!-- Create Record Drawer (for other modules) -->
    <CreateRecordDrawer
      v-else-if="createDrawerModuleKey && createDrawerModuleKey !== 'organizations'"
      :isOpen="showCreateDrawer && createDrawerModuleKey !== 'organizations'"
      :moduleKey="createDrawerModuleKey"
      :initialData="createDrawerInitialData"
      :lockedFields="createDrawerLockedFields"
      :title="createDrawerTitle"
      :description="createDrawerDescription"
      @close="handleCreateDrawerClose"
      @saved="handleCreateDrawerSaved"
    />
  </template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useTabs } from '@/composables/useTabs';
import { useActiveSurface } from '@/composables/useActiveSurface';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { getAvailableCommands } from '@/commands/commandRegistry';
import type { CommandPaletteItem, CommandContext, NavigationUtilities } from '@/types/commandPalette.types';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import OrganizationQuickCreateDrawer from '@/components/organizations/OrganizationQuickCreateDrawer.vue';
import PeopleQuickCreateDrawer from '@/components/people/PeopleQuickCreateDrawer.vue';
import EventQuickCreateDrawer from '@/components/events/EventQuickCreateDrawer.vue';

type GroupKey = 'people' | 'organizations' | 'work' | 'configuration';

type SearchResultItem = {
  id: string;
  type: string;
  route?: string;
  title?: string;
  subtitle?: string;
  icon?: string;
  [key: string]: any;
};

type BackendSearchResults = {
  people?: SearchResultItem[];
  organizations?: SearchResultItem[];
  deals?: SearchResultItem[];
  tasks?: SearchResultItem[];
  events?: SearchResultItem[];
  forms?: SearchResultItem[];
  items?: SearchResultItem[];
  [key: string]: SearchResultItem[] | undefined;
};

type SearchResponseData = {
  total?: number;
  results?: BackendSearchResults;
};

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'open']);

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { openTab } = useTabs();
const { activeSurface } = useActiveSurface();
const authStore = useAuthStore();

const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const loading = ref(false);
const searchResults = ref<SearchResponseData | null>(null);
const selectedGroup = ref<GroupKey | null>(null);
const selectedIndex = ref(-1);
const resultRefs = ref<Record<GroupKey, Record<number, HTMLElement>>>({
  people: {},
  organizations: {},
  work: {},
  configuration: {}
});
const commandRefs = ref<HTMLElement[]>([]);

// Track if user has used "/" in this session (for discoverability hint)
const hasUsedCommandTrigger = ref(false);

// Link drawer state (for action commands)
const showLinkDrawer = ref(false);
const linkDrawerModuleKey = ref('');
const linkDrawerTitle = ref('');
const linkDrawerContext = ref<Record<string, any>>({});
const linkDrawerAllowCreate = ref(false);

// Create drawer state (for create action commands)
const showCreateDrawer = ref(false);
const showPeopleDrawer = ref(false);
const peopleDrawerContextAppKey = ref<string | null>(null);
const showEventDrawer = ref(false);
const createDrawerModuleKey = ref('');
const createDrawerInitialData = ref<Record<string, any>>({});
const createDrawerTitle = ref('');
const createDrawerDescription = ref('');
const createDrawerLockedFields = ref<string[]>([]);
const createDrawerAutoLinkContext = ref<Record<string, any> | null>({});

// Confirmation state for destructive commands
// See: docs/architecture/command-palette-invariants.md
// 
// WHY CONFIRMATION IS RARE AND INTENTIONAL:
// 
// Command Palette is designed for fast, keyboard-first action execution.
// Most commands are navigation or creation actions that are:
// - Reversible (navigation can be undone with back button)
// - Non-destructive (creating new entities doesn't delete data)
// - Explicit user intent (user typed command name, not accidental)
// 
// Confirmation adds friction and slows down the "fast action execution"
// principle. Therefore, confirmation is ONLY used for:
// - Commands that permanently delete data
// - Commands that cannot be undone
// - Commands that have significant consequences
// 
// Most commands should NOT be destructive. If a command requires confirmation,
// consider whether it belongs in Command Palette at all, or if it should be
// moved to a dedicated surface with proper safety mechanisms.
const pendingDestructiveCommand = ref<CommandPaletteItem | null>(null);

// Mode system: Search and Command Palette share a UI shell but are separate modes
// See: docs/architecture/command-palette-invariants.md
// 
// Why modes exist:
// - Search returns entities for browsing (People, Orgs, Work)
// - Command Palette executes actions (navigation, creation)
// - These are fundamentally different mental models and must not be mixed
// - Mixing would create cognitive load and violate the "calm, scannable" principle
const mode = ref<'search' | 'command'>('search');

// Priority order for result groups (primary nouns first)
const GROUP_PRIORITY_ORDER: GroupKey[] = ['people', 'organizations', 'work', 'configuration'];

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const totalResults = computed(() => {
  if (!searchResults.value) return 0;
  return searchResults.value.total || 0;
});

// Transform backend results into human-centric UX categories
const groupedResults = computed(() => {
  if (!searchResults.value || !searchResults.value.results) {
    return {
      people: [],
      organizations: [],
      work: [],
      configuration: []
    };
  }

  const backendResults = searchResults.value.results;
  
  // Group into UX categories (preserving backend order within each group)
  return {
    people: backendResults.people || [],
    organizations: backendResults.organizations || [],
    work: [
      ...(backendResults.deals || []),
      ...(backendResults.tasks || []),
      ...(backendResults.events || [])
    ],
    configuration: [
      ...(backendResults.forms || []),
      ...(backendResults.items || [])
    ]
  };
});

// Get groups in priority order (only non-empty groups)
// Configuration group is shown only when query >= 4 chars OR user is admin
const prioritizedGroups = computed(() => {
  const shouldShowConfiguration = 
    searchQuery.value.length >= 4 || 
    authStore.isAdminLike;
  
  return GROUP_PRIORITY_ORDER.filter((groupKey: GroupKey) => {
    // Hide configuration group unless conditions are met
    if (groupKey === 'configuration' && !shouldShowConfiguration) {
      return false;
    }
    
    const group = groupedResults.value[groupKey];
    return group && group.length > 0;
  });
});

// Watch search query for mode switching and perform search/command filtering
// Mode switching: If input starts with '/', switch to command mode
// Strip '/' prefix from query when processing commands
watch(searchQuery, (newQuery) => {
  console.log('[GlobalSearch] Search query changed:', newQuery);
  
  // Detect mode switch: '/' as first non-whitespace character enters command mode
  const trimmed = newQuery?.trim();
  const wasInCommandMode = mode.value === 'command';
  
  if (trimmed && trimmed.startsWith('/')) {
    hasUsedCommandTrigger.value = true; // Mark that user has discovered the command trigger
    if (mode.value !== 'command') {
      console.log('[GlobalSearch] Switching to command mode');
      mode.value = 'command';
    }
  } else {
    // Exiting command mode: restore normal search immediately
    if (mode.value !== 'search') {
      console.log('[GlobalSearch] Switching to search mode');
      mode.value = 'search';
    }
  }

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // In command mode, filter commands immediately (no debounce needed)
  if (mode.value === 'command') {
    selectedIndex.value = -1;
    commandRefs.value = []; // Reset refs when query changes
    pendingDestructiveCommand.value = null; // Clear any pending confirmation when query changes
    return;
  }

  // In search mode, perform debounced search
  // If we just exited command mode and have a query, trigger search immediately
  if (wasInCommandMode && trimmed && trimmed.length >= 2) {
    // Exiting command mode with a query: restore normal search immediately
    console.log('[GlobalSearch] Exiting command mode, triggering search immediately');
    performSearch(trimmed);
    return;
  }

  if (!newQuery || newQuery.trim().length < 2) {
    console.log('[GlobalSearch] Query too short, clearing results');
    searchResults.value = null;
    selectedGroup.value = null;
    selectedIndex.value = -1;
    pendingDestructiveCommand.value = null; // Clear any pending confirmation
    return;
  }

  console.log('[GlobalSearch] Scheduling search in 300ms');
  searchTimeout = setTimeout(() => {
    performSearch(newQuery.trim());
  }, 300);
});

// Watch isOpen to focus input and reset mode
watch(() => props.isOpen, (isOpen) => {
  console.log('[GlobalSearch] isOpen changed:', isOpen);
  if (isOpen) {
    nextTick(() => {
      console.log('[GlobalSearch] Modal opened, focusing input');
      searchInputRef.value?.focus();
      searchQuery.value = '';
      mode.value = 'search'; // Reset to default mode
      searchResults.value = null;
      selectedGroup.value = null;
      selectedIndex.value = -1;
    });
  } else {
    console.log('[GlobalSearch] Modal closed');
  }
});

// Listen for link drawer open events (from action commands)
const handleLinkDrawerOpen = (event: CustomEvent) => {
  const { moduleKey, title, context, allowCreate } = event.detail;
  linkDrawerModuleKey.value = moduleKey;
  const moduleLabel = moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  linkDrawerTitle.value = title || t('navigation.globalSearchLinkModule', { module: moduleLabel });
  linkDrawerContext.value = context;
  linkDrawerAllowCreate.value = allowCreate || false;
  showLinkDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

// Listen for create drawer open events (from create action commands)
const handleCreateDrawerOpen = (event: CustomEvent) => {
  const { moduleKey, initialData, title, description, lockedFields, autoLinkContext } = event.detail;
  
  // ARCHITECTURAL INTENT: Organizations must use Quick Create flow, not full create
  // This ensures command palette actions respect Settings → Quick Create configuration
  if (moduleKey === 'organizations') {
    console.warn('[GlobalSearch] Organizations should use OrganizationQuickCreateDrawer, not CreateRecordDrawer. Redirecting...');
    // Redirect to Organization Quick Create
    handleOrganizationQuickCreateOpen(event);
    return;
  }
  
  // Enhance initial data with current user assignment for tasks
  const enhancedInitialData = { ...initialData };
  
  if (moduleKey === 'tasks') {
    // Auto-assign to current user if not already set
    if (!enhancedInitialData.assignedTo && authStore.user?._id) {
      enhancedInitialData.assignedTo = authStore.user._id;
    }
  }
  
  createDrawerModuleKey.value = moduleKey;
  createDrawerInitialData.value = enhancedInitialData;
  createDrawerTitle.value = title || '';
  createDrawerDescription.value = description || '';
  createDrawerLockedFields.value = lockedFields || [];
  createDrawerAutoLinkContext.value = autoLinkContext || {};
  showCreateDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

/**
 * Handle Organization Quick Create drawer open event
 * ARCHITECTURAL INTENT: This is the dedicated Quick Create flow for Organizations
 * It strictly respects Settings → Core Modules → Organizations → Quick Create configuration
 * Command palette actions must NEVER navigate to list views - they open this Quick Create flow
 */
const handleOrganizationQuickCreateOpen = (event: CustomEvent) => {
  // Handle both cases: with detail (from command palette) and without (from list view)
  const detail = event.detail || {};
  const { initialData, autoLinkContext } = detail;
  
  createDrawerModuleKey.value = 'organizations';
  createDrawerInitialData.value = initialData || {};
  createDrawerAutoLinkContext.value = autoLinkContext || null;
  showCreateDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

/**
 * Handle People Quick Create drawer open event
 * ARCHITECTURAL INTENT: Opens drawer in same tab, not navigating to new route
 */
const handlePeopleQuickCreateOpen = (e?: Event) => {
  const ev = e as CustomEvent<{ contextAppKey?: string | null }> | undefined;
  peopleDrawerContextAppKey.value = ev?.detail?.contextAppKey ?? null;
  showPeopleDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

const handlePeopleDrawerClose = () => {
  showPeopleDrawer.value = false;
  peopleDrawerContextAppKey.value = null;
};

const handlePeopleDrawerSaved = (person: any) => {
  showPeopleDrawer.value = false;
  
  // Dispatch global event to refresh list views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:record-created', {
      detail: { moduleKey: 'people', record: person }
    }));
  }
};

/**
 * Handle Event Quick Create drawer open event
 * ARCHITECTURAL INTENT: Opens drawer in same tab, not navigating to new route
 */
const handleEventQuickCreateOpen = () => {
  showEventDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

const handleEventDrawerClose = () => {
  showEventDrawer.value = false;
};

const handleEventDrawerSaved = (event: any) => {
  showEventDrawer.value = false;
  
  // Dispatch global event to refresh calendar/list views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:event-created', {
      detail: { event }
    }));
  }
};

onMounted(() => {
  window.addEventListener('arivu:open-link-drawer', handleLinkDrawerOpen as EventListener);
  window.addEventListener('arivu:open-create-drawer', handleCreateDrawerOpen as EventListener);
  // ARCHITECTURAL INTENT: Organization Quick Create is separate from full create flows
  // This ensures command palette actions open Quick Create, not full create/edit
  window.addEventListener('arivu:open-organization-quick-create', handleOrganizationQuickCreateOpen as EventListener);
  window.addEventListener('arivu:open-people-quick-create', handlePeopleQuickCreateOpen as EventListener);
  window.addEventListener('arivu:open-event-quick-create', handleEventQuickCreateOpen as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('arivu:open-link-drawer', handleLinkDrawerOpen as EventListener);
  window.removeEventListener('arivu:open-create-drawer', handleCreateDrawerOpen as EventListener);
  window.removeEventListener('arivu:open-organization-quick-create', handleOrganizationQuickCreateOpen as EventListener);
  window.removeEventListener('arivu:open-people-quick-create', handlePeopleQuickCreateOpen as EventListener);
  window.removeEventListener('arivu:open-event-quick-create', handleEventQuickCreateOpen as EventListener);
});

// Perform search
const performSearch = async (query: string) => {
  if (!query || query.length < 2) {
    console.log('[GlobalSearch] Query too short:', query);
    return;
  }

  console.log('[GlobalSearch] Performing search for:', query);
  loading.value = true;
  try {
    const url = `/search?q=${encodeURIComponent(query)}`;
    console.log('[GlobalSearch] Calling API:', url);
    const response = await apiClient(url);
    console.log('[GlobalSearch] Search response:', response);
    
    if (response && response.success) {
      searchResults.value = response.data;
      selectedGroup.value = null;
      selectedIndex.value = -1;
      console.log('[GlobalSearch] Search results set:', {
        total: searchResults.value?.total,
        people: searchResults.value?.results?.people?.length || 0,
        organizations: searchResults.value?.results?.organizations?.length || 0,
        deals: searchResults.value?.results?.deals?.length || 0,
        tasks: searchResults.value?.results?.tasks?.length || 0,
        events: searchResults.value?.results?.events?.length || 0
      });
    } else {
      console.warn('[GlobalSearch] Search failed - response:', response);
      searchResults.value = null;
    }
  } catch (error: unknown) {
    const searchError = error as any;
    console.error('[GlobalSearch] Error searching:', error);
    console.error('[GlobalSearch] Error details:', {
      message: searchError?.message,
      status: searchError?.status,
      stack: searchError?.stack
    });
    searchResults.value = null;
  } finally {
    loading.value = false;
  }
};

// Get group label for UX categories
const getGroupLabel = (groupKey: GroupKey) => {
  const labels: Record<GroupKey, string> = {
    people: t('navigation.globalSearchGroupPeople'),
    organizations: t('navigation.globalSearchGroupOrganizations'),
    work: t('navigation.globalSearchGroupWork'),
    configuration: t('navigation.globalSearchGroupConfiguration')
  };
  return labels[groupKey] || String(groupKey);
};

// Check if result is selected
const isSelected = (groupKey: GroupKey, index: number) => {
  return selectedGroup.value === groupKey && selectedIndex.value === index;
};

// Set result ref
const setResultRef = (el: any, groupKey: GroupKey, index: number) => {
  if (el) {
    resultRefs.value[groupKey][index] = el as HTMLElement;
  }
};

// Navigate results with arrow keys
// Handles both command mode (flat list) and search mode (grouped results)
const navigateResults = (direction: number) => {
  // Clear pending confirmation when navigating (user changed selection)
  if (pendingDestructiveCommand.value) {
    pendingDestructiveCommand.value = null;
  }

  // Command mode navigation (flat list)
  if (mode.value === 'command') {
    const commands = filteredCommands.value;
    if (commands.length === 0) return;

    if (selectedIndex.value === -1) {
      selectedIndex.value = 0;
      scrollToSelected();
      return;
    }

    if (direction > 0) {
      if (selectedIndex.value < commands.length - 1) {
        selectedIndex.value++;
      }
    } else {
      if (selectedIndex.value > 0) {
        selectedIndex.value--;
      }
    }

    scrollToSelected();
    return;
  }

  // Search mode navigation (grouped results)
  if (!searchResults.value || totalResults.value === 0) return;

  // Use prioritized groups for navigation
  const groups = prioritizedGroups.value;

  if (groups.length === 0) return;

  // Initialize selection
  if (selectedGroup.value === null) {
    const firstGroup = groups[0];
    if (!firstGroup) return;
    selectedGroup.value = firstGroup;
    selectedIndex.value = 0;
    scrollToSelected();
    return;
  }

  const currentGroupIndex = groups.indexOf(selectedGroup.value);
  const currentGroup = groupedResults.value[selectedGroup.value];
  const currentGroupLength = currentGroup.length;

  // Move within current group
  if (direction > 0) {
    if (selectedIndex.value < currentGroupLength - 1) {
      selectedIndex.value++;
    } else if (currentGroupIndex < groups.length - 1) {
      // Move to next group
      const nextGroup = groups[currentGroupIndex + 1];
      if (!nextGroup) return;
      selectedGroup.value = nextGroup;
      selectedIndex.value = 0;
    }
  } else {
    if (selectedIndex.value > 0) {
      selectedIndex.value--;
    } else if (currentGroupIndex > 0) {
      // Move to previous group
      const previousGroup = groups[currentGroupIndex - 1];
      if (!previousGroup) return;
      selectedGroup.value = previousGroup;
      selectedIndex.value = groupedResults.value[previousGroup].length - 1;
    }
  }

  scrollToSelected();
};

// Scroll to selected result (works for both command and search modes)
const scrollToSelected = () => {
  nextTick(() => {
    if (mode.value === 'command') {
      const ref = commandRefs.value[selectedIndex.value];
      if (ref) {
        ref.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else {
      if (!selectedGroup.value) return;
      const ref = resultRefs.value[selectedGroup.value]?.[selectedIndex.value];
      if (ref) {
        ref.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  });
};

// Handle Escape key (cancel confirmation, exit command mode, or close)
const handleEscape = () => {
  if (pendingDestructiveCommand.value) {
    // Cancel confirmation
    pendingDestructiveCommand.value = null;
  } else if (mode.value === 'command') {
    // Exit command mode back to search mode
    // Preserve typed query by removing "/" prefix but keeping the rest
    const trimmed = searchQuery.value.trim();
    if (trimmed.startsWith('/')) {
      searchQuery.value = trimmed.slice(1).trim();
    }
    mode.value = 'search';
    // Trigger search if there's a query after removing "/"
    if (searchQuery.value && searchQuery.value.length >= 2) {
      performSearch(searchQuery.value.trim());
    } else {
      searchResults.value = null;
    }
  } else {
    // Close search modal
    close();
  }
};

// Select result (Enter key) - handles both command and search modes
const selectResult = () => {
  // If confirmation is pending, confirm the destructive command
  if (pendingDestructiveCommand.value) {
    confirmDestructiveCommand();
    return;
  }

  if (mode.value === 'command') {
    if (selectedIndex.value >= 0) {
      const command = filteredCommands.value[selectedIndex.value];
      if (command) {
        // Check if command is destructive
        if (command.destructive) {
          // Show confirmation instead of executing immediately
          pendingDestructiveCommand.value = command;
        } else {
          // Execute non-destructive command immediately
          executeCommand(command);
        }
      }
    }
  } else {
    if (selectedGroup.value !== null && selectedIndex.value >= 0) {
      const result = groupedResults.value[selectedGroup.value][selectedIndex.value];
      if (result) {
        navigateToResult(result);
      }
    }
  }
};

// Confirm destructive command execution
const confirmDestructiveCommand = () => {
  if (pendingDestructiveCommand.value) {
    executeCommand(pendingDestructiveCommand.value);
    pendingDestructiveCommand.value = null;
  }
};

// Navigate to result
const navigateToResult = (result: SearchResultItem) => {
  if (!result || !result.route) return;

  openTab(result.route, {
    title: result.title,
    background: false,
    insertAdjacent: true
  });

  close();
};

// Command system
// See: docs/architecture/command-palette-invariants.md
// Commands are stateless, fast actions - not entity searches

/**
 * Determine command context from active surface
 * 
 * Maps active surface to CommandContext for contextual commands.
 * Uses useActiveSurface composable instead of direct route path checking.
 * Returns undefined when not in a contextual surface.
 * 
 * Note: Person detail commands only appear on 'person' surface, not 'people' list.
 * Organization detail commands only appear on 'organization' surface, not 'organizations' list.
 */
function getCommandContextFromSurface(): CommandContext | undefined {
  const surface = activeSurface.value;
  
  if (surface === 'inbox') {
    return 'inbox';
  }
  // Person detail commands only on detail surface
  if (surface === 'person') {
    return 'people';
  }
  // Organization detail commands only on detail surface
  if (surface === 'organization') {
    return 'organization';
  }
  
  return undefined;
}

/**
 * Get available commands filtered by scope
 * 
 * Architectural filtering:
 * - Global commands: Always visible
 * - Contextual commands: Only visible when context matches active surface
 * 
 * Ordering rules:
 * - Contextual commands first
 * - Then global commands
 * - Alphabetical ordering within each group (by label)
 * - No visual separators (architectural change only)
 * 
 * Uses useActiveSurface composable to derive surface context.
 */
const availableCommands = computed<CommandPaletteItem[]>(() => {
  const activeContext = getCommandContextFromSurface();
  const allCommands = getAvailableCommands(activeContext || 'global', router);
  
  // Filter by scope
  const filtered = allCommands.filter(cmd => {
    if (cmd.scope === 'global') {
      return true; // Global commands always visible
    }
    if (cmd.scope === 'contextual') {
      // Contextual commands only visible when context matches
      return cmd.context === activeContext;
    }
    return false;
  });
  
  // Order: contextual commands first, then global commands
  // Alphabetical ordering within each group
  // Create a new array to avoid mutating the filtered array
  return [...filtered].sort((a, b) => {
    // First, separate by scope: contextual first, then global
    if (a.scope === 'contextual' && b.scope === 'global') return -1;
    if (a.scope === 'global' && b.scope === 'contextual') return 1;
    
    // Within same scope, sort alphabetically by label
    if (a.scope === b.scope) {
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    }
    
    return 0;
  });
});

/**
 * Check if command query is empty (just '/' or empty string)
 * 
 * Used to determine when to show example commands in empty state.
 */
const isCommandQueryEmpty = computed(() => {
  if (mode.value !== 'command') return false;
  const query = searchQuery.value.trim();
  const commandQuery = query.startsWith('/') ? query.slice(1).trim() : query;
  return !commandQuery;
});

/**
 * Filter commands based on query (strip '/' prefix)
 * 
 * Filters commands by label or description matching the query.
 * Search filtering applies uniformly across all commands.
 * Ordering is preserved: contextual commands first, then global, alphabetical within each group.
 * 
 * If query is empty (just '/' or empty), shows all available commands.
 */
const filteredCommands = computed<CommandPaletteItem[]>(() => {
  if (mode.value !== 'command') return [];
  
  const query = searchQuery.value.trim();
  const commandQuery = query.startsWith('/') ? query.slice(1).trim() : query;
  
  if (!commandQuery) {
    // Return all commands (already sorted: contextual first, then global, alphabetical)
    return availableCommands.value;
  }
  
  // Filter uniformly across all commands (preserves ordering from availableCommands)
  const lowerQuery = commandQuery.toLowerCase();
  return availableCommands.value.filter(cmd => 
    cmd.label.toLowerCase().includes(lowerQuery) ||
    cmd.description?.toLowerCase().includes(lowerQuery)
  );
});

/**
 * Example commands for empty state hints
 * 
 * Shows 3 example commands when no query is entered.
 * These are non-clickable hints to help users understand what commands are available.
 */
const exampleCommands = computed<CommandPaletteItem[]>(() => {
  // Show first 3 global commands as examples
  const globalCommands = availableCommands.value.filter(cmd => cmd.scope === 'global');
  return globalCommands.slice(0, 3);
});

// Set command ref for scrolling
const setCommandRef = (el: any, index: number) => {
  if (el) {
    commandRefs.value[index] = el as HTMLElement;
  }
};

/**
 * Create navigation utilities from Vue Router
 * 
 * Provides NavigationUtilities interface for navigation commands.
 */
function createNavigationUtilities(): NavigationUtilities {
  const performNavigation = async (target: string | { path: string; query: Record<string, string> }) => {
    try {
      await router.push(target as any);
    } catch (err: any) {
      if (err?.name !== 'NavigationDuplicated') {
        console.warn('[GlobalSearch] Navigation error:', err);
      }
    }
  };

  return {
    navigate: async (path: string) => {
      await performNavigation(path);
    },
    navigateWithQuery: async (path: string, query: Record<string, string>) => {
      await performNavigation({ path, query });
    },
    openTab: async (path: string, options?: { title?: string; background?: boolean }) => {
      // Open route in a new tab with proper title
      // If title is provided, use it; otherwise openTab will generate one from path
      openTab(path, {
        title: options?.title,
        background: options?.background || false
      });
    },
    getCurrentRoute: () => router.currentRoute
  };
}

/**
 * Execute a command
 * 
 * Handles both navigation and action commands using discriminated union.
 * - Navigation commands: Call run() with NavigationUtilities
 * - Action commands: Call handler() directly
 * 
 * Commands execute navigation or actions, never mutate store state directly.
 * 
 * NOTE:
 * Command Palette is keyboard-first, but mouse click selection is supported for accessibility.
 * Clicking a command runs the same logic as pressing Enter (including destructive confirmation).
 */
const executeCommand = (command: CommandPaletteItem) => {
  if (!command) return;
  
  if (command.kind === 'navigate') {
    // Navigation command: pass NavigationUtilities to run()
    const nav = createNavigationUtilities();
    command.run(nav);
    close();
  } else if (command.kind === 'action') {
    // Action command: call handler() directly
    // Handler receives route for accessing current route params
    // Use router.currentRoute.value which is always available
    const currentRoute = router.currentRoute.value;
    if (currentRoute) {
      command.handler(currentRoute);
    } else {
      console.warn('[GlobalSearch] Route not available for action command:', command.id);
    }
    // Note: Action commands may not close the modal (e.g., if they open a drawer)
    // The handler should decide whether to close or not
  }
};

/**
 * Keep focus on the search input so keyboard navigation (arrows/Enter/Esc)
 * continues to work even after mouse interaction.
 */
const focusSearchInput = () => {
  nextTick(() => {
    (searchInputRef.value as HTMLInputElement | null)?.focus?.();
  });
};

/**
 * Mouse hover: update selected index for visual feedback + Enter parity.
 */
const handleCommandHover = (index: number) => {
  selectedIndex.value = index;
  scrollToSelected();
};

/**
 * Mouse click: execute the same logic as Enter key.
 */
const handleCommandClick = (command: CommandPaletteItem, index: number) => {
  selectedIndex.value = index;

  if (pendingDestructiveCommand.value && pendingDestructiveCommand.value.id !== command.id) {
    pendingDestructiveCommand.value = null;
  }

  if (command.destructive) {
    pendingDestructiveCommand.value = command;
    focusSearchInput();
    return;
  }

  executeCommand(command);
  focusSearchInput();
};

/**
 * Handle link drawer close
 */
const handleLinkDrawerClose = () => {
  showLinkDrawer.value = false;
  linkDrawerModuleKey.value = '';
  linkDrawerTitle.value = '';
  linkDrawerContext.value = {};
  linkDrawerAllowCreate.value = false;
};

/**
 * Handle create action from link drawer
 * ARCHITECTURAL INTENT: For Organizations, use Quick Create flow instead of full create
 */
const handleLinkDrawerCreate = () => {
  // CRITICAL: Store values BEFORE closing the drawer (which clears them)
  const moduleKey = linkDrawerModuleKey.value;
  const context = { ...linkDrawerContext.value };
  
  // Close link drawer (this clears linkDrawerModuleKey and linkDrawerContext)
  handleLinkDrawerClose();
  
  // ARCHITECTURAL INTENT: Organizations must use Quick Create flow
  if (moduleKey === 'organizations') {
    // Use Organization Quick Create drawer
    createDrawerModuleKey.value = 'organizations';
    createDrawerInitialData.value = {};
    createDrawerAutoLinkContext.value = context;
    showCreateDrawer.value = true;
    return;
  }
  
  // For other modules, use standard create drawer
  const initialData: Record<string, any> = {};
  
  // Auto-assign tasks to current user
  if (moduleKey === 'tasks' && authStore.user?._id) {
    initialData.assignedTo = authStore.user._id;
  }
  
  createDrawerModuleKey.value = moduleKey;
  createDrawerInitialData.value = initialData;
  createDrawerTitle.value = `New ${moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)}`;
  createDrawerDescription.value = `Create a new ${moduleKey}${context.personId ? ' and link it to this person' : ''}`;
  createDrawerLockedFields.value = [];
  
  // Store context for auto-linking after creation
  // We'll use a ref to track this
  createDrawerAutoLinkContext.value = context;
  
  showCreateDrawer.value = true;
};

/**
 * Handle create drawer close
 */
const handleCreateDrawerClose = () => {
  showCreateDrawer.value = false;
  createDrawerModuleKey.value = '';
  createDrawerInitialData.value = {};
  createDrawerTitle.value = '';
  createDrawerDescription.value = '';
  createDrawerLockedFields.value = [];
  createDrawerAutoLinkContext.value = {};
};

/**
 * Handle create drawer saved event
 */
const handleCreateDrawerSaved = async (savedRecord?: any) => {
  // ARCHITECTURAL INTENT: Organization Quick Create handles auto-linking internally
  // This handler is for other modules or fallback cases
  const moduleKey = createDrawerModuleKey.value;
  
  // Dispatch global event to refresh list views for all modules
  if (typeof window !== 'undefined' && savedRecord) {
    window.dispatchEvent(new CustomEvent('arivu:record-created', {
      detail: { moduleKey, record: savedRecord }
    }));
  }
  
  // If we have auto-link context and a saved record, auto-link it
  if (createDrawerAutoLinkContext.value && savedRecord?._id) {
    const context = createDrawerAutoLinkContext.value;
    const recordId = savedRecord._id;
    
    try {
      // Auto-link the newly created record based on context
      // Note: Organizations Quick Create handles auto-linking internally, so skip here
      if (context.personId && moduleKey === 'organizations') {
        // This should not happen - OrganizationQuickCreateDrawer handles this
        console.warn('[GlobalSearch] Auto-link for organizations should be handled by OrganizationQuickCreateDrawer');
        // Link organization to person by updating the person's organization field
        await apiClient.put(`/people/${context.personId}`, {
          organization: recordId
        });
        
        // Dispatch refresh event for person
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:refresh-person', {
            detail: { personId: context.personId }
          }));
        }
      } else if (context.organizationId) {
        // Link record to organization (generic)
        if (moduleKey === 'people') {
          await apiClient.put(`/people/${recordId}`, { organization: context.organizationId });
        } else if (moduleKey === 'deals') {
          await apiClient.post('/deals/link', { accountId: context.organizationId, dealIds: [recordId] });
        } else if (moduleKey === 'tasks') {
          await apiClient.post('/tasks/link', { organizationId: context.organizationId, taskIds: [recordId] });
        }
        
        // Dispatch refresh event for organization
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
            detail: { organizationId: context.organizationId }
          }));
        }
      }
    } catch (error) {
      console.error('[GlobalSearch] Error auto-linking created record:', error);
      // Don't block the user - creation succeeded, linking can be done manually
    }
  }
  
  // Close the drawer
  handleCreateDrawerClose();
  // Optionally dispatch refresh events based on what was created
  // This will be handled by the components that listen for these events
};

/**
 * Helper: Get current user name for activity logging
 */
const getCurrentUserName = () => {
  if (authStore.user) {
    return authStore.user.name || authStore.user.email || t('navigation.globalSearchUnknownUser');
  }
  return t('navigation.globalSearchUnknownUser');
};

/**
 * Helper: Get activity logs endpoint for a record
 */
const getActivityLogsEndpoint = (recordId: string, recordType: string) => {
  if (!recordId) return null;
  
  switch (recordType) {
    case 'organizations':
    case 'organization':
      return `/v2/organization/${recordId}/activity-logs`;
    case 'people':
    case 'contacts':
      return `/people/${recordId}/activity-logs`;
    case 'deals':
      return `/deals/${recordId}/activity-logs`;
    case 'tasks':
      return `/tasks/${recordId}/activity-logs`;
    case 'events':
      return `/events/${recordId}/activity-logs`;
    default:
      return null;
  }
};

/**
 * Helper: Fetch records by IDs for activity log links
 */
const fetchRecordsByIds = async (moduleKey: string, ids: string[]) => {
  const out: Array<{ id: string; name: string; module: string }> = [];
  const getDetailEndpoint = (key: string, id: string) => {
    switch (key) {
      case 'people':
      case 'contacts':
        return `/people/${id}`;
      case 'deals':
        return `/deals/${id}`;
      case 'tasks':
        return `/tasks/${id}`;
      case 'events':
        return `/events/${id}`;
      case 'organizations':
      case 'organization':
        return `/v2/organization/${id}`;
      default:
        return null;
    }
  };
  
  const getRecordDisplayName = (rec: any) => {
    return rec?.name || rec?.title || `${rec?.first_name || ''} ${rec?.last_name || ''}`.trim() || rec?.email || rec?._id || '';
  };
  
  for (const id of ids || []) {
    const ep = getDetailEndpoint(moduleKey, id);
    if (!ep) continue;
    try {
      const res = await apiClient.get(ep);
      const rec = res?.data || res;
      if (rec) out.push({ id, name: getRecordDisplayName(rec), module: moduleKey });
    } catch {
      out.push({ id, name: id, module: moduleKey });
    }
  }
  return out;
};

/**
 * Helper: Add activity log to a record
 */
const addActivityLog = async (recordId: string, recordType: string, action: string, details: any = null) => {
  if (!recordId) {
    console.warn('[GlobalSearch] Cannot add activity log: recordId is missing');
    return;
  }
  
  const endpoint = getActivityLogsEndpoint(recordId, recordType);
  if (!endpoint) {
    console.warn('[GlobalSearch] Cannot add activity log: endpoint not found for', recordType);
    return;
  }
  
  try {
    const payload = {
      user: getCurrentUserName(),
      action: action,
      details: details || null
    };
    
    console.log('[GlobalSearch] Adding activity log:', { endpoint, payload });
    const response = await apiClient.post(endpoint, payload);
    
    if (response && response.success) {
      console.log('[GlobalSearch] Activity log added successfully');
    } else {
      console.warn('[GlobalSearch] Activity log API returned non-success:', response);
    }
  } catch (e: any) {
    console.error('[GlobalSearch] Error adding activity log:', e);
    console.error('[GlobalSearch] Error details:', {
      endpoint,
      recordId,
      recordType,
      action,
      error: e.message || e
    });
    // Non-blocking - activity log failure shouldn't prevent linking
  }
};

/**
 * Handle link drawer linked event
 * 
 * Performs the actual linking via API based on context.
 * This matches the logic from SummaryView.vue.
 */
const handleLinkDrawerLinked = async ({ moduleKey, ids, context }: { moduleKey: string; ids: string[]; context: Record<string, any> }) => {
  try {
    if (context.organizationId && moduleKey === 'people') {
      // Link contacts to organization by updating each contact's organization field
      await Promise.all(
        ids.map((contactId) => apiClient.put(`/people/${contactId}`, { organization: context.organizationId }))
      );
      
      // Log linking activity
      try {
        const labelMap = { people: 'contact', deals: 'deal', tasks: 'task', events: 'event', organizations: 'organization', users: 'user' };
        const label = labelMap[moduleKey] || moduleKey;
        const count = ids?.length || 0;
        if (count > 0) {
          const items = await fetchRecordsByIds(moduleKey, ids);
          const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
          await addActivityLog(
            context.organizationId,
            'organizations',
            `linked ${count} ${label}${count > 1 ? 's' : ''}${actionSuffix}`,
            { type: 'link', moduleKey, items }
          );
        }
      } catch (e) {
        console.warn('Error logging activity:', e);
      }
      
      // Refresh organization data by dispatching a custom event
      // OrganizationDetail listens for this event and refreshes its data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (context.organizationId && moduleKey === 'deals') {
      await apiClient.post('/deals/link', { accountId: context.organizationId, dealIds: ids });
      
      // Log linking activity
      try {
        const items = await fetchRecordsByIds(moduleKey, ids);
        const count = ids?.length || 0;
        const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
        await addActivityLog(
          context.organizationId,
          'organizations',
          `linked ${count} deal${count > 1 ? 's' : ''}${actionSuffix}`,
          { type: 'link', moduleKey, items }
        );
      } catch (e) {
        console.warn('Error logging activity:', e);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (context.contactId && moduleKey === 'deals') {
      await apiClient.post('/deals/link', { contactId: context.contactId, dealIds: ids });
    } else if (context.contactId && moduleKey === 'tasks') {
      await apiClient.post('/tasks/link', { contactId: context.contactId, taskIds: ids });
    } else if (context.organizationId && moduleKey === 'tasks') {
      await apiClient.post('/tasks/link', { organizationId: context.organizationId, taskIds: ids });
      
      // Log linking activity
      try {
        const items = await fetchRecordsByIds(moduleKey, ids);
        const count = ids?.length || 0;
        const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
        await addActivityLog(
          context.organizationId,
          'organizations',
          `linked ${count} task${count > 1 ? 's' : ''}${actionSuffix}`,
          { type: 'link', moduleKey, items }
        );
      } catch (e) {
        console.warn('Error logging activity:', e);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (moduleKey === 'events') {
      await apiClient.post('/events/link', { 
        relatedType: context.relatedType === 'organization' ? 'Organization' : 'Contact', 
        relatedId: context.organizationId || context.contactId, 
        eventIds: ids 
      });
      
      // Log linking activity for organizations
      if (context.organizationId) {
        try {
          const items = await fetchRecordsByIds(moduleKey, ids);
          const count = ids?.length || 0;
          const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
          await addActivityLog(
            context.organizationId,
            'organizations',
            `linked ${count} event${count > 1 ? 's' : ''}${actionSuffix}`,
            { type: 'link', moduleKey, items }
          );
        } catch (e) {
          console.warn('Error logging activity:', e);
        }
      }
      
      if (context.organizationId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (context.contactId && moduleKey === 'organizations') {
      // Link organization to contact by setting the contact's organization
      if (ids[0]) {
        await apiClient.put(`/people/${context.contactId}`, { organization: ids[0] });
      }
    }
  } catch (e) {
    console.error('Error linking records:', e);
  }
  
  // Close the drawer (command palette is already closed)
  handleLinkDrawerClose();
};

// Close search
const close = () => {
  emit('close');
  searchQuery.value = '';
  mode.value = 'search'; // Reset to default mode
  searchResults.value = null;
  selectedGroup.value = null;
  selectedIndex.value = -1;
  pendingDestructiveCommand.value = null; // Clear any pending confirmation
  // Note: hasUsedCommandTrigger persists across modal opens/closes in the same session
};

// Note: Keyboard shortcut is handled in Nav.vue to avoid conflicts

onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
});
</script>


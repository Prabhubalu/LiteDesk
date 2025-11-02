<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">Loading {{ recordType }}...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading {{ recordType }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$emit('close')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
          Close
        </button>
      </div>
    </div>

    <!-- Main Summary View -->
    <div v-else-if="record" class="max-w-full mx-auto">
      <!-- Header Component - Fixed below TabBar -->
      <div 
        class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-[65px] md:top-[113px] lg:top-[49px] z-40 transition-all duration-300 ease-in-out"
        :style="{ 
          left: headerLeft,
          right: '0px'
        }"
      >
        <div class="px-6 py-4">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <!-- Left Group: Record Identity & Quick Actions -->
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <!-- Icon/Avatar -->
              <div class="flex-shrink-0">
                <div v-if="record.avatar" class="w-12 h-12 rounded-lg overflow-hidden">
                  <img :src="record.avatar" :alt="record.name" class="w-full h-full object-cover" />
                </div>
                <div v-else :class="['w-12 h-12 rounded-lg flex items-center justify-center text-xl font-medium', getColorForName(record.name).bg, getColorForName(record.name).text]">
                  {{ getInitials(record.name) }}
                </div>
              </div>

              <!-- Record Name with Actions -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {{ record.name }}
                </h1>

                  <!-- Action Icons - Right next to title -->
                  <div class="flex items-center gap-1">
                <!-- Follow Toggle -->
                <button
                  @click="toggleFollow"
                  :class="[
                        'p-1.5 rounded-lg transition-colors',
                    isFollowing 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  ]"
                  :title="isFollowing ? 'Unfollow' : 'Follow'"
                >
                      <HeartIconSolid v-if="isFollowing" class="w-4 h-4" />
                      <HeartIcon v-else class="w-4 h-4" />
                </button>

                    <!-- Tag Dropdown -->
                    <Menu as="div" class="relative">
                      <MenuButton 
                        :class="[
                          'p-1.5 rounded-lg transition-colors',
                          tags.length > 0
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        ]"
                        :title="tags.length > 0 ? 'Manage Tags' : 'Add Tag'"
                      >
                        <TagIconSolid v-if="tags.length > 0" class="w-4 h-4" />
                        <TagIcon v-else class="w-4 h-4" />
                      </MenuButton>

                      <transition
                        enter-active-class="transition ease-out duration-100"
                        enter-from-class="transform opacity-0 scale-95"
                        enter-to-class="transform opacity-100 scale-100"
                        leave-active-class="transition ease-in duration-75"
                        leave-from-class="transform opacity-100 scale-100"
                        leave-to-class="transform opacity-0 scale-95"
                      >
                        <MenuItems class="absolute left-0 mt-2 w-64 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                          <!-- Existing Tags -->
                          <div v-if="tags.length > 0" class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tags</p>
                            <div class="flex flex-wrap gap-1">
                              <span 
                                v-for="(tag, index) in tags" 
                                :key="index"
                                class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm"
                              >
                                {{ tag }}
                                <button
                                  @click="removeTag(index)"
                                  class="ml-1 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded p-0.5"
                                >
                                  <XMarkIcon class="w-3 h-3" />
                                </button>
                              </span>
                            </div>
                          </div>
                          
                          <!-- Empty State or Add New -->
                          <div class="px-3 py-2">
                            <div v-if="tags.length === 0" class="text-center py-2 mb-2">
                              <p class="text-sm text-gray-500 dark:text-gray-400">No tags yet</p>
                            </div>
                            <MenuItem v-slot="{ active }">
                <button
                  @click="showTagModal = true"
                                :class="[
                                  'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                                  active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                ]"
                              >
                                <PlusIcon class="w-4 h-4" />
                                {{ tags.length > 0 ? 'Add Another Tag' : 'Add Tag' }}
                </button>
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </transition>
                    </Menu>

                <!-- Copy URL Link -->
                <button
                  @click="copyUrl"
                      class="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Copy Link"
                >
                      <LinkIcon class="w-4 h-4" />
                </button>
                  </div>
                </div>
                
                <p v-if="record.subtitle" class="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                  {{ record.subtitle }}
                </p>
              </div>
            </div>

            <!-- Right Group: Primary Record Actions -->
            <div class="flex items-center gap-3 justify-end md:justify-start flex-wrap">
              <!-- Status/Lifecycle Stage Dropdowns (Dynamic based on module) -->
              <Menu
                v-for="field in getLifecycleStatusFields"
                :key="field.key"
                as="div"
                class="relative"
              >
                <MenuButton 
                  :class="getButtonColorClasses(field)"
                  :style="getButtonColorStyle(field)"
                >
                  <span>{{ field.value || 'Select...' }}</span>
                </MenuButton>
                <Transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems class="absolute left-0 mt-2 w-auto min-w-[12rem] rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-10" style="min-width: max(12rem, 100%)">
                    <div class="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {{ field.label }}
                    </div>
                    <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <MenuItem
                      v-for="option in field.options"
                      :key="typeof option === 'string' ? option : option.value"
                      v-slot="{ active }"
                      as="template"
                    >
                      <button
                        @click="updateField(field.key, typeof option === 'string' ? option : option.value)"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center justify-between',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          getOptionIsSelected(field, option) ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        <div class="flex items-center gap-2">
                          <span v-if="getColorForOption(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getColorForOption(option) }"></span>
                          <span>{{ typeof option === 'string' ? option : option.value }}</span>
                        </div>
                        <CheckIcon v-if="getOptionIsSelected(field, option)" class="h-5 w-5" />
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Transition>
              </Menu>

              <!-- Add Relation Dropdown (Desktop only) -->
              <button
                @click="showRelationModal = true"
                class="hidden lg:inline-flex px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                + Add Relation
              </button>

              <!-- Record Edit Button (Desktop only) -->
              <button
                @click="$emit('edit')"
                class="hidden lg:inline-flex px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors items-center"
              >
                <PencilSquareIcon class="w-4 h-4 mr-2" />
                Edit
              </button>

              <!-- More Dropdown -->
              <Menu as="div" class="relative">
                <MenuButton class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <EllipsisVerticalIcon class="w-5 h-5" />
                </MenuButton>

                <transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems class="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                    <!-- Edit (Mobile/Tablet only) -->
                    <MenuItem v-slot="{ active }" class="lg:hidden">
                      <button
                        @click="$emit('edit')"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        <PencilSquareIcon class="w-4 h-4" />
                        Edit
                      </button>
                    </MenuItem>
                    
                    <!-- Add Relation (Mobile/Tablet only) -->
                    <MenuItem v-slot="{ active }" class="lg:hidden">
                      <button
                        @click="showRelationModal = true"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        + Add Relation
                      </button>
                    </MenuItem>

                    <!-- Divider (Mobile/Tablet only) -->
                    <div class="lg:hidden border-t border-gray-200 dark:border-gray-700 my-1"></div>

                    <!-- Delete Record -->
                    <MenuItem v-slot="{ active }">
                      <button
                        @click="$emit('delete')"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-red-600 dark:text-red-400'
                        ]"
                      >
                        Delete Record
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </div>
        </div>

        <!-- Tabs Component - Fixed below header -->
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="px-6">
            <nav class="flex space-x-8" aria-label="Tabs">
              <!-- Fixed Default Tabs -->
              <button
                v-for="tab in fixedTabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                :class="[
                  'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                ]"
              >
                {{ tab.name }}
              </button>

            </nav>
          </div>
        </div>
      </div>

      <!-- Tab Content -->
      <div :class="tabContentPadding">
        <!-- Summary Tab with GridStack Dashboard -->
        <div v-if="activeTab === 'summary'">
          <!-- GridStack Container -->
          <div ref="gridStackContainer" class="grid-stack">
            <!-- Widgets will be rendered here by GridStack -->
          </div>

          <!-- Floating Add Widget Button -->
          <div class="fixed bottom-6 right-6 z-50">
            <button
              @click="showWidgetModal = true"
              class="inline-flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium transition-colors shadow-lg hover:shadow-xl"
              title="Add Custom Widget"
            >
              <PlusIcon class="w-5 h-5" />
              <span class="hidden sm:inline">Add Widget</span>
            </button>
          </div>
        </div>

        <!-- Tenant Details Tab (only for tenant organizations) -->
        <div v-else-if="activeTab === 'tenant-details' && props.record?.isTenant === true" class="space-y-6">
          <!-- Top Bar: Search and Toggle -->
          <div class="flex items-center justify-between mb-4">
            <!-- Search Field -->
            <div class="relative w-100">
              <input
                v-model="detailsSearch"
                type="text"
                placeholder="Search tenant fields..."
                class="block w-full rounded-md bg-white border border-gray-200 dark:bg-gray-700 dark:border-transparent px-3 py-1.5 pl-10 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
              />
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <MagnifyingGlassIcon class="w-5 h-5 text-gray-400" />
              </div>
            </div>
            
            <!-- Right Side: Toggle -->
            <div class="flex items-center gap-3">
              <label class="hidden lg:flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="showEmptyFields"
                  class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Show empty fields</span>
              </label>
            </div>
          </div>

          <!-- Tenant Fields Block -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Tenant Fields</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Subscription, limits, and organization settings</p>
            </div>
            <!-- Tenant Fields Grid -->
            <div :class="detailsGridClass" :style="detailsGridStyle">
              <div 
                v-for="fieldData in getTenantFields" 
                :key="fieldData.key"
                :class="[
                  fieldData.field.dataType === 'Text-Area' || 
                  fieldData.field.dataType === 'Rich Text' 
                    ? 'md:col-span-2' 
                    : ''
                ]"
              >
                <DynamicFormField 
                  :field="fieldData.field"
                  :value="fieldData.value"
                  @update:value="updateField(fieldData.key, $event)"
                  :errors="{}"
                  :dependency-state="fieldData.dependencyState"
                />
              </div>
              
              <!-- Empty state -->
              <div v-if="getTenantFields.length === 0" class="md:col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                <p v-if="detailsSearch">No tenant fields match your search.</p>
                <p v-else-if="!showEmptyFields">No tenant fields with values to display.</p>
                <p v-else>No tenant fields available.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Details Tab -->
        <div v-else-if="activeTab === 'details'" class="space-y-6">
                        <!-- Top Bar: Search, Toggle, and Manage Button -->
                        <div class="flex items-center justify-between mb-4">
              <!-- Search Field -->
              <div class="relative w-100">
                <input
                  v-model="detailsSearch"
                  type="text"
                  placeholder="Search fields..."
                  class="block w-full rounded-md bg-white border border-gray-200 dark:bg-gray-700 dark:border-transparent px-3 py-1.5 pl-10 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
                />
                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon class="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              <!-- Right Side: Toggle and Manage Button -->
              <div class="flex items-center gap-3">
                <!-- Show empty fields toggle (Desktop only) -->
                <label class="hidden lg:flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="showEmptyFields"
                    class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Show empty fields</span>
                </label>
                
                <!-- Manage Fields Button (Desktop only) -->
                <div v-if="hasManageFieldsPermission" class="hidden lg:block">
                  <PermissionButton
                    module="settings"
                    action="edit"
                    variant="secondary"
                    icon="cog"
                    @click="goToManageFields"
                  >
                    Manage Fields
                  </PermissionButton>
                </div>

                <!-- More Dropdown (Mobile/Tablet only) -->
                <Menu as="div" class="relative lg:hidden">
                  <MenuButton class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <EllipsisVerticalIcon class="w-5 h-5" />
                  </MenuButton>

                  <transition
                    enter-active-class="transition ease-out duration-100"
                    enter-from-class="transform opacity-0 scale-95"
                    enter-to-class="transform opacity-100 scale-100"
                    leave-active-class="transition ease-in duration-75"
                    leave-from-class="transform opacity-100 scale-100"
                    leave-to-class="transform opacity-0 scale-95"
                  >
                    <MenuItems class="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                      <!-- Show empty fields toggle -->
                      <MenuItem v-slot="{ active }" as="template">
                        <label 
                          :class="[
                            'flex items-center gap-2 px-4 py-2 cursor-pointer',
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          ]"
                        >
                  <input
                            type="checkbox"
                            v-model="showEmptyFields"
                            class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            @click.stop
                          />
                          <span class="text-sm text-gray-700 dark:text-gray-300">Show empty fields</span>
                        </label>
                      </MenuItem>
                      
                      <!-- Manage Fields (only if user has permission) -->
                      <MenuItem v-slot="{ active }" v-if="hasManageFieldsPermission" as="template">
                  <button
                          @click="goToManageFields"
                          :class="[
                            'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'text-gray-700 dark:text-gray-300'
                          ]"
                        >
                          <Cog6ToothIcon class="w-4 h-4" />
                          Manage Fields
                  </button>
                      </MenuItem>
                    </MenuItems>
                  </transition>
                </Menu>
                </div>
              </div>
          <!-- CRM Fields Block -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <!-- Fields Grid using DynamicFormField -->
            <div :class="detailsGridClass" :style="detailsGridStyle">
              <div 
                v-for="fieldData in getFieldsWithDefinitions" 
                :key="fieldData.key"
                :class="[
                  fieldData.field.dataType === 'Text-Area' || 
                  fieldData.field.dataType === 'Rich Text' 
                    ? 'md:col-span-2' 
                    : ''
                ]"
              >
                <!-- Special handling for createdBy field -->
                <div v-if="fieldData.key?.toLowerCase() === 'createdby'" class="mt-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ fieldData.field.label || fieldData.field.key }}
                  </label>
                  <div class="flex items-center gap-2">
                    <template v-if="fieldData.value && typeof fieldData.value === 'object' && fieldData.value !== null && !Array.isArray(fieldData.value) && fieldData.value._id">
                      <!-- Populated user object -->
                      <div v-if="fieldData.value.avatar" class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <img :src="fieldData.value.avatar" :alt="getUserDisplayName(fieldData.value)" class="w-full h-full object-cover" />
            </div>
                      <div v-else class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {{ getUserInitials(fieldData.value) }}
                      </div>
                      <span class="text-sm text-gray-900 dark:text-white">{{ getUserDisplayName(fieldData.value) }}</span>
                    </template>
                    <template v-else-if="fieldData.value && (typeof fieldData.value === 'string' || (typeof fieldData.value === 'object' && fieldData.value && !fieldData.value._id))">
                      <!-- Unpopulated ObjectId string or invalid object - this shouldn't happen if backend populates correctly -->
                      <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xs font-semibold flex-shrink-0">
                        ?
                      </div>
                      <span class="text-sm text-gray-500 dark:text-gray-400 italic">Not available</span>
                    </template>
                    <template v-else>
                      <!-- No createdBy value -->
                      <span class="text-sm text-gray-400 dark:text-gray-500">-</span>
                    </template>
                  </div>
                </div>
                <!-- Regular field rendering -->
                <DynamicFormField 
                  v-else
                  :field="fieldData.field"
                  :value="fieldData.value"
                  @update:value="updateField(fieldData.key, $event)"
                  :errors="{}"
                  :dependency-state="fieldData.dependencyState"
                />
              </div>
              
              <!-- Empty state -->
              <div v-if="getFieldsWithDefinitions.length === 0" class="md:col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                <p v-if="detailsSearch">No fields match your search.</p>
                <p v-else-if="!showEmptyFields">No fields with values to display.</p>
                <p v-else>No fields available.</p>
              </div>
            </div>
          </div>

        </div>

        <!-- Updates/Timeline Tab -->
        <div v-else-if="activeTab === 'updates'" class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <!-- Filters -->
            <div class="mb-6 flex justify-end">
              <Menu as="div" class="relative">
                <MenuButton class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  <FunnelIcon class="w-5 h-5" />
                  <span>Filters</span>
                  <ChevronDownIcon class="w-4 h-4" />
                </MenuButton>
                <Transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <MenuItems class="absolute right-0 mt-2 w-80 origin-top-right bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-10">
                    <div class="p-4 space-y-4">
                      <!-- Search -->
                      <div>
                        <label for="activity-search" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Search</label>
                        <div class="relative mt-1">
                          <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                          <input
                            id="activity-search"
                            v-model="activitySearchQuery"
                            type="text"
                            placeholder="Search activities..."
                            class="block w-full rounded-md bg-gray-100 px-3 py-2 pl-10 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                          />
                  </div>
                </div>
                      
                      <!-- User Filter -->
                      <div>
                        <label for="activity-user" class="block text-sm/6 font-medium text-gray-900 dark:text-white">User</label>
                        <Listbox v-model="activityFilterUser" as="div" class="mt-1 relative">
                          <ListboxButton
                            class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 relative cursor-default text-left"
                          >
                            <span :class="['block truncate', !activityFilterUser && 'text-gray-500 dark:text-gray-500']">{{ activityFilterUser || 'All Users' }}</span>
                            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                            </span>
                          </ListboxButton>
                          <Transition
                            leave-active-class="transition duration-100 ease-in"
                            leave-from-class="opacity-100"
                            leave-to-class="opacity-0"
                          >
                            <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm">
                              <ListboxOption
                                v-slot="{ active, selected }"
                                :value="''"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">All Users</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-for="user in uniqueActivityUsers"
                                :key="user"
                                :value="user"
                                v-slot="{ active, selected }"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ user }}</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                            </ListboxOptions>
                          </Transition>
                        </Listbox>
                </div>
                      
                      <!-- Type Filter -->
                      <div>
                        <label for="activity-type" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Type</label>
                        <Listbox v-model="activityFilterType" as="div" class="mt-1 relative">
                          <ListboxButton
                            class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 relative cursor-default text-left"
                          >
                            <span :class="['block truncate', !activityFilterType && 'text-gray-500 dark:text-gray-500']">{{ activityFilterType || 'All Types' }}</span>
                            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                            </span>
                          </ListboxButton>
                          <Transition
                            leave-active-class="transition duration-100 ease-in"
                            leave-from-class="opacity-100"
                            leave-to-class="opacity-0"
                          >
                            <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm">
                              <ListboxOption
                                v-slot="{ active, selected }"
                                :value="''"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">All Types</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-slot="{ active, selected }"
                                value="comment"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">Comments</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-slot="{ active, selected }"
                                value="assignment"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">Field Changes</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-slot="{ active, selected }"
                                value="tags"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">Tags</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                            </ListboxOptions>
                          </Transition>
                        </Listbox>
              </div>
                    </div>
                  </MenuItems>
                </Transition>
              </Menu>
            </div>
            
            <div v-if="activityItems.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                No activity yet
              </div>
            <div v-else class="flow-root">
              <div class="max-w-2xl mx-auto">
              <ul role="list" class="-mb-8">
                <li v-for="(activityItem, activityItemIdx) in activityItems" :key="activityItem.id">
                  <div class="relative pb-8">
                    <span v-if="activityItemIdx !== activityItems.length - 1" class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                    <div class="relative flex items-start space-x-3">
                      <template v-if="activityItem.type === 'comment'">
                        <div class="relative">
                          <div :class="['flex size-10 items-center justify-center rounded-full ring-8 ring-white dark:ring-gray-800 outline -outline-offset-1 outline-black/5 dark:outline-white/5', getColorForName(activityItem.person.name).bg]">
                            <span :class="['text-sm font-medium', getColorForName(activityItem.person.name).text]">
                              {{ getInitials(activityItem.person.name) }}
                            </span>
            </div>
                          <span class="absolute -right-1 -bottom-0.5 rounded-tl bg-white dark:bg-gray-800 px-0.5 py-px">
                            <ChatBubbleLeftEllipsisIcon class="size-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                          </span>
                </div>
                        <div class="min-w-0 flex-1">
                          <div>
                            <div class="text-sm">
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
              </div>
                            <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ activityItem.date }}</p>
              </div>
                          <div class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                            <p>{{ activityItem.comment }}</p>
                          </div>
                        </div>
                      </template>
                      <template v-else-if="activityItem.type === 'assignment'">
                        <div>
                          <div class="relative px-1">
                            <div class="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ring-8 ring-white dark:ring-gray-800">
                              <UserCircleIcon class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div class="min-w-0 flex-1 py-1.5">
                          <div>
                            <div class="text-sm">
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
                              {{ ' ' }}
                              <span class="text-gray-500 dark:text-gray-400">{{ activityItem.action }}</span>
                              {{ ' ' }}
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.fieldName || '' }}</span>
                              {{ ' ' }}
                              <span class="whitespace-nowrap text-gray-500 dark:text-gray-400">{{ activityItem.date }}</span>
                            </div>
                            <div v-if="activityItem.comment && activityItem.comment !== activityItem.action" class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                              <p>{{ activityItem.comment }}</p>
                            </div>
                          </div>
                        </div>
                      </template>
                      <template v-else-if="activityItem.type === 'tags'">
                        <div>
                          <div class="relative px-1">
                            <div class="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ring-8 ring-white dark:ring-gray-800">
                              <TagIconSolid class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div class="min-w-0 flex-1 py-0">
                          <div class="text-sm/8 text-gray-500 dark:text-gray-400">
                            <span class="mr-0.5">
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
                              {{ ' ' }}
                              {{ activityItem.action }}
                            </span>
                            {{ ' ' }}
                            <span class="mr-0.5">
                              <template v-for="(tag, tagIdx) in activityItem.tags" :key="tag.name">
                                <span class="inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 ring-1 ring-gray-300 dark:ring-gray-600">
                                  <svg :class="[tag.color, 'size-1.5']" viewBox="0 0 6 6" aria-hidden="true">
                                    <circle cx="3" cy="3" r="3" />
                    </svg>
                                  {{ tag.name }}
                                </span>
                                {{ ' ' }}
                              </template>
                            </span>
                            <span class="whitespace-nowrap">{{ activityItem.date }}</span>
                  </div>
                </div>
                      </template>
                </div>
              </div>
                </li>
              </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Widget Management Modal -->
    <div v-if="showWidgetModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showWidgetModal = false"></div>
        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div class="px-6 py-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Manage Widgets</h3>
            <div class="grid grid-cols-2 gap-4 mb-6">
              <button
                v-for="widget in availableWidgets"
                :key="widget.type"
                @click="addWidget(widget.type)"
                class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <LinkIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ widget.name }}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ widget.description }}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3">
            <button @click="showWidgetModal = false" class="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showTagModal = false"></div>
        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="px-6 py-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Add Tag</h3>
            <input
              v-model="newTag"
              @keyup.enter="addTag"
              type="text"
              placeholder="Enter tag name"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3">
            <button @click="showTagModal = false" class="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium">
              Cancel
            </button>
            <button @click="addTag" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Record Drawer -->
  <CreateRecordDrawer
    :isOpen="showCreateDrawer"
    :moduleKey="createDrawerModuleKey"
    :initialData="createDrawerInitialData"
    :title="getCreateDrawerTitle()"
    :description="getCreateDrawerDescription()"
    @close="handleCreateDrawerClose"
    @saved="handleCreateDrawerSaved"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch, createApp, h } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems, Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import RelatedContactsWidget from '@/components/organizations/RelatedContactsWidget.vue';
import RelatedDealsWidget from '@/components/deals/RelatedDealsWidget.vue';
import RelatedTasksWidget from '@/components/tasks/RelatedTasksWidget.vue';
import RelatedEventsWidget from '@/components/events/RelatedEventsWidget.vue';
import RelatedOrganizationWidget from '@/components/organizations/RelatedOrganizationWidget.vue';
import OrganizationMetricsWidget from '@/components/organizations/OrganizationMetricsWidget.vue';
import LifecycleStageWidget from '@/components/common/LifecycleStageWidget.vue';
import KeyFieldsWidget from '@/components/common/KeyFieldsWidget.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useTabs } from '@/composables/useTabs';
import PermissionButton from '@/components/common/PermissionButton.vue';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { useRouter } from 'vue-router';
import {
  MagnifyingGlassIcon,
  HeartIcon,
  TagIcon,
  LinkIcon,
  PencilSquareIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  ClockIcon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  CheckIcon
} from '@heroicons/vue/24/outline';
import { HeartIcon as HeartIconSolid, TagIcon as TagIconSolid, ChatBubbleLeftEllipsisIcon } from '@heroicons/vue/24/solid';

// Props
const props = defineProps({
  record: {
    type: Object,
    default: null
  },
  recordType: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  stats: {
    type: Object,
    default: () => ({})
  }
});

// Emits
const emit = defineEmits(['close', 'update', 'edit', 'delete', 'addRelation', 'openRelatedRecord']);

// Get openTab from useTabs
const { openTab } = useTabs();

// Initialize router and auth store
const router = useRouter();
const authStore = useAuthStore();

// Force recompute trigger (similar to TabBar viewportWidth)
const recomputeTrigger = ref(0);

// Viewport width for responsive calculations
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);

// Handle resize for viewport width
const handleResize = () => {
  viewportWidth.value = window.innerWidth;
};

// Listen for sidebar toggle custom event
const handleSidebarToggle = (e) => {
  // Force recompute by toggling trigger value
  // This causes headerLeft computed to recalculate
  recomputeTrigger.value++;
};

// Dynamic positioning based on sidebar state (reads localStorage like TabBar)
const headerLeft = computed(() => {
  // Force dependency on recomputeTrigger
  const _ = recomputeTrigger.value;
  
  // On mobile/tablet (< 1024px), always at left: 0 (like TabBar)
  if (viewportWidth.value < 1024) {
    return '0px';
  }
  
  // On desktop (≥ 1024px), position based on sidebar state
  const sidebarCollapsed = localStorage.getItem('litedesk-sidebar-collapsed') === 'true';
  return sidebarCollapsed ? '80px' : '256px';
});


// Get storage key for this record
const getStorageKey = () => {
  const recordId = props.record?._id || props.record?.id || 'default';
  return `summaryview-tab-${props.recordType}-${recordId}`;
};

// Get storage key for widget layout
const getLayoutStorageKey = () => {
  const recordId = props.record?._id || props.record?.id || 'default';
  return `summaryview-layout-${props.recordType}-${recordId}`;
};

// Get storage key for activity logs
const getActivityLogsStorageKey = () => {
  const recordId = props.record?._id || props.record?.id || 'default';
  return `summaryview-activity-${props.recordType}-${recordId}`;
};

// Load active tab from localStorage or default to 'summary'
const loadActiveTab = () => {
  try {
    const savedTab = localStorage.getItem(getStorageKey());
    if (savedTab) {
      // Check if it's a fixed tab
      if (fixedTabs.value.some(t => t.id === savedTab)) {
        return savedTab;
      }
      // For dynamic tabs, we'll validate when we load them
      // But we can still restore it if it was saved
      return savedTab;
    }
  } catch (e) {
    console.error('Error loading active tab:', e);
  }
  return 'summary';
};

// Save active tab to localStorage
const saveActiveTab = (tabId) => {
  try {
    localStorage.setItem(getStorageKey(), tabId);
  } catch (e) {
    console.error('Error saving active tab:', e);
  }
};

// State - initialize with summary, will be updated when record loads
const activeTab = ref('summary');
const isFollowing = ref(false);
const showTagModal = ref(false);
const showWidgetModal = ref(false);
const showRelationModal = ref(false);
const newTag = ref('');
const tags = ref([]);

// Create drawer state
const showCreateDrawer = ref(false);
const createDrawerModuleKey = ref('');
const createDrawerInitialData = ref({});

// Fixed tabs - add Tenant Details tab if viewing tenant organization
const fixedTabs = computed(() => {
  const baseTabs = [
    { id: 'summary', name: 'Summary' },
    { id: 'details', name: 'Details' },
    { id: 'updates', name: 'Updates' }
  ];
  
  // Add Tenant Details tab if viewing a tenant organization
  if (props.record?.isTenant === true) {
    baseTabs.splice(2, 0, { id: 'tenant-details', name: 'Tenant Details' });
  }
  
  return baseTabs;
});

// Module definitions
const moduleDefinition = ref(null);
const allModuleDefinitions = ref({});

// Field values tracking for discard functionality
const originalFieldValues = ref({});

// Details tab search
const detailsSearch = ref('');
const showEmptyFields = ref(true); // Show empty fields by default

// Permission check for managing fields
const hasManageFieldsPermission = computed(() => {
  return authStore.can('settings', 'edit');
});

// Get field dependency state for a field (reactive)
const getFieldState = (field) => {
  if (!field || !field.dependencies || !Array.isArray(field.dependencies) || field.dependencies.length === 0) {
    return {
      visible: true,
      readonly: false,
      required: field.required || false,
      allowedOptions: null
    };
  }
  // Use record data for dependency evaluation
  const currentFormData = props.record || {};
  return getFieldDependencyState(field, currentFormData, moduleDefinition.value?.fields || []);
};

// Get fields with their definitions for details tab
const getFieldsWithDefinitions = computed(() => {
  if (!props.record || !moduleDefinition.value?.fields) return [];
  
  // Create a map of field keys to field definitions
  const fieldMap = new Map();
  moduleDefinition.value.fields.forEach(field => {
    if (field.key) {
      const keyLower = field.key.toLowerCase();
      fieldMap.set(keyLower, field);
      fieldMap.set(field.key, field); // Also store with original case
    }
  });
  
  // System fields to exclude from detail view display
  // Note: activitylogs is excluded from detail view but available in edit forms
  // Note: createdby is visible in detail view but not editable
  const systemFieldKeys = ['_id', 'id', '__v', 'createdat', 'updatedat', 'organizationid', 'activitylogs'];
  
  // Helper function to process and filter fields
  const processFields = (fieldDefs, filterTenant, filterCRM) => {
    const processed = [];
    const processedKeys = new Set();
    const isTenantOrg = props.record?.isTenant === true;
    
    for (const fieldDef of fieldDefs) {
      if (!fieldDef.key) continue;
      
      const keyLower = fieldDef.key.toLowerCase();
      
      // Skip if we've already processed this field (case-insensitive)
      if (processedKeys.has(keyLower)) continue;
      processedKeys.add(keyLower);
      
      // Skip system fields
      if (systemFieldKeys.includes(keyLower)) continue;
      
      // Filter tenant fields: only show if isTenant is true
      // Check by isTenantField flag OR by key patterns
      const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
      const isTenantField = fieldDef.isTenantField === true || 
                           tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern);
      
      if (filterTenant && isTenantField && !isTenantOrg) continue;
      if (!filterTenant && isTenantField) continue; // Exclude tenant fields from CRM list
      
      // Filter CRM fields: only show if isTenant is false (or undefined, meaning CRM)
      if (filterCRM && fieldDef.isCRMField && isTenantOrg) continue;
      if (!filterCRM && fieldDef.isCRMField) continue; // Exclude CRM fields from tenant list
      
      // Extract value for nested field paths (e.g., subscription.status, limits.maxUsers)
      let displayValue;
      if (fieldDef.key && fieldDef.key.includes('.')) {
        // Handle nested paths like subscription.status
        displayValue = fieldDef.key.split('.').reduce((obj, k) => obj?.[k], props.record);
      } else {
        // Regular field access
        displayValue = props.record[fieldDef.key] || props.record[keyLower];
      }
      
      // Format createdBy value if it's an ObjectId string - convert to object format for display
      if (keyLower === 'createdby' && typeof displayValue === 'string' && displayValue.length === 24 && /^[0-9a-fA-F]{24}$/.test(displayValue)) {
        // It's an ObjectId string - we can't resolve it here, but we'll let the template handle it
        // The backend should populate it, so this is just a fallback
        displayValue = displayValue;
      }
      
      // Evaluate dependency-based visibility (for tenant fields, always show by default)
      const depState = getFieldState(fieldDef);
      if (!filterTenant && !depState.visible && depState.visible !== undefined) {
        continue; // Skip hidden fields for CRM fields
      }
      // For tenant fields, show even if dependency says hidden (they're always visible when isTenant is true)
      
      // Filter empty fields if toggle is off
      if (!showEmptyFields.value) {
        const isEmpty = displayValue === null || 
                       displayValue === undefined || 
                       displayValue === '' || 
                       (Array.isArray(displayValue) && displayValue.length === 0);
        if (isEmpty) continue;
      }
      
      // Apply search filter
      if (detailsSearch.value) {
        const searchLower = detailsSearch.value.toLowerCase();
        const fieldName = (fieldDef.label || fieldDef.key).toLowerCase();
        const fieldValue = String(displayValue || '').toLowerCase();
        
        if (!fieldName.includes(searchLower) && !fieldValue.includes(searchLower)) {
          continue;
        }
      }
      
      processed.push({
        field: fieldDef,
        key: fieldDef.key,
        value: displayValue,
        dependencyState: depState
      });
    }
    
    // Sort by field order if available
    processed.sort((a, b) => {
      const orderA = a.field.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.field.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
    
    return processed;
  };
  
  // Separate CRM fields and tenant fields
  const allFields = moduleDefinition.value?.fields || [];
  const crmFields = processFields(allFields, false, true); // Include CRM fields, exclude tenant fields
  const tenantFields = processFields(allFields, true, false); // Include tenant fields, exclude CRM fields
  
  // Return CRM fields by default (tenant fields will be shown separately)
  return crmFields;
});

// Separate computed property for tenant fields
const getTenantFields = computed(() => {
  // Debug: Log the record and isTenant value
  if (props.record) {
    console.log('🔍 getTenantFields - record.isTenant:', props.record.isTenant, 'type:', typeof props.record.isTenant);
    console.log('🔍 getTenantFields - moduleDefinition:', moduleDefinition.value?.fields?.length, 'fields');
  }
  
  if (!moduleDefinition.value || !props.record) {
    return [];
  }
  
  // Check isTenant more flexibly (could be boolean, string, or undefined)
  const isTenant = props.record.isTenant === true || props.record.isTenant === 'true' || props.record.isTenant === 1;
  if (!isTenant) {
    return [];
  }
  
  const systemFieldKeys = ['_id', 'id', '__v', 'createdat', 'updatedat', 'organizationid', 'activitylogs'];
  const processed = [];
  const processedKeys = new Set();
  
  console.log('🔍 Processing tenant fields. Total fields:', moduleDefinition.value.fields?.length || 0);
  
  for (const fieldDef of moduleDefinition.value.fields || []) {
    if (!fieldDef.key) continue;
    
    // Check if field is a tenant field by flag OR by key pattern
    const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
    const keyLower = fieldDef.key.toLowerCase();
    const isTenantField = fieldDef.isTenantField === true || 
                         tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern);
    
    // Debug: Log tenant field check
    if (fieldDef.key.includes('subscription') || fieldDef.key.includes('limits') || fieldDef.key.includes('settings')) {
      console.log('🔍 Field:', fieldDef.key, 'isTenantField flag:', fieldDef.isTenantField, 'detected as tenant:', isTenantField);
    }
    
    if (!isTenantField) continue;
    
    // Skip if already processed
    if (processedKeys.has(keyLower)) continue;
    processedKeys.add(keyLower);
    
    // Skip system fields
    if (systemFieldKeys.includes(keyLower)) continue;
    
    // Extract value for nested field paths
    let displayValue;
    if (fieldDef.key && fieldDef.key.includes('.')) {
      displayValue = fieldDef.key.split('.').reduce((obj, k) => obj?.[k], props.record);
    } else {
      displayValue = props.record[fieldDef.key] || props.record[keyLower];
    }
    
    // Filter empty fields if toggle is off
    if (!showEmptyFields.value) {
      const isEmpty = displayValue === null || 
                     displayValue === undefined || 
                     displayValue === '' || 
                     (Array.isArray(displayValue) && displayValue.length === 0);
      if (isEmpty) continue;
    }
    
    // Apply search filter
    if (detailsSearch.value) {
      const searchLower = detailsSearch.value.toLowerCase();
      const fieldName = (fieldDef.label || fieldDef.key).toLowerCase();
      const fieldValue = String(displayValue || '').toLowerCase();
      
      if (!fieldName.includes(searchLower) && !fieldValue.includes(searchLower)) {
        continue;
      }
    }
    
    // Always visible for tenant fields (no dependency checks)
    processed.push({
      field: fieldDef,
      key: fieldDef.key,
      value: displayValue,
      dependencyState: { visible: true, readonly: false } // Always visible and editable
    });
    
    console.log('✅ Added tenant field:', fieldDef.key, 'value:', displayValue);
  }
  
  console.log('🔍 Total tenant fields found:', processed.length);
  
  // Sort by field order
  processed.sort((a, b) => {
    const orderA = a.field.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.field.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
  
  return processed;
});

// Helper functions for user display
const getUserInitials = (user) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return '?';
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`.trim();
  }
  if (user.username) return user.username;
  if (user.email) return user.email;
  return 'Unknown User';
};

// Navigate to manage fields in a new tab
const goToManageFields = () => {
  window.open(`/settings?tab=modules&module=${props.recordType}`, '_blank');
};

// GridStack
const gridStackContainer = ref(null);
let gridStack = null;
let isInitializing = false;

// Timeline updates - store all activity logs
const timelineUpdates = ref([]);
const loggedRecordIds = ref(new Set()); // Track which records we've logged initial load for

// Filter state
const activityFilterUser = ref('');
const activityFilterType = ref('');
const activitySearchQuery = ref('');

// Get current user name for activity logs
const getCurrentUserName = () => {
  if (authStore.user) {
    const firstName = authStore.user.firstName || '';
    const lastName = authStore.user.lastName || '';
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return authStore.user.username || 'User';
  }
  return 'System';
};

// Get activity logs API endpoint
const getActivityLogsEndpoint = (recordId) => {
  const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
  
  if (props.recordType === 'people') {
    return isAdmin 
      ? `/admin/contacts/${recordId}/activity-logs`
      : `/people/${recordId}/activity-logs`;
  } else if (props.recordType === 'organizations') {
    // Organizations always use admin endpoint
    return `/admin/organizations/${recordId}/activity-logs`;
  }
  return null;
};

// Load activity logs from API (with localStorage fallback)
const loadActivityLogs = async () => {
  if (!props.record?._id && !props.record?.id) return;
  
  const recordId = props.record._id || props.record.id;
  const endpoint = getActivityLogsEndpoint(recordId);
  
  if (!endpoint) return;
  
  try {
    // Try API first
    const response = await apiClient.get(endpoint);
    if (response.success && response.data) {
      // Convert ISO strings back to Date objects
      timelineUpdates.value = response.data.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
      return;
    }
  } catch (apiError) {
    console.warn('Error loading activity logs from API, trying localStorage:', apiError);
  }
  
  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(getActivityLogsStorageKey());
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert ISO strings back to Date objects
      timelineUpdates.value = parsed.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    }
  } catch (e) {
    console.error('Error loading activity logs from localStorage:', e);
    timelineUpdates.value = [];
  }
};

// Save activity log to API (with localStorage fallback)
const saveActivityLogToAPI = async (logEntry) => {
  if (!props.record?._id && !props.record?.id) return;
  
  const recordId = props.record._id || props.record.id;
  const endpoint = getActivityLogsEndpoint(recordId);
  
  if (!endpoint) return;
  
  try {
    // Convert Date to ISO string for API
    const payload = {
      user: logEntry.user,
      action: logEntry.action,
      details: logEntry.details || null
    };
    
    await apiClient.post(endpoint, payload);
    return true;
  } catch (apiError) {
    console.warn('Error saving activity log to API, saving to localStorage:', apiError);
    
    // Fallback to localStorage
    try {
      const logsToSave = timelineUpdates.value.map(log => ({
        ...log,
        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp
      }));
      localStorage.setItem(getActivityLogsStorageKey(), JSON.stringify(logsToSave));
    } catch (e) {
      console.error('Error saving activity logs to localStorage:', e);
    }
    return false;
  }
};

// Add activity log entry
const addActivityLog = async (action, details = null) => {
  const update = {
    user: getCurrentUserName(),
    action: action,
    details: details,
    timestamp: new Date()
  };
  
  timelineUpdates.value.unshift(update); // Add to beginning for newest first
  
  // Optional: Limit to last 100 updates to prevent memory issues
  if (timelineUpdates.value.length > 100) {
    timelineUpdates.value = timelineUpdates.value.slice(0, 100);
  }
  
  // Save to API (with localStorage fallback)
  await saveActivityLogToAPI(update);
};

// Computed property for sorted timeline (newest first - already sorted since we unshift)
const sortedTimelineUpdates = computed(() => {
  return [...timelineUpdates.value].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
});

// Get unique users from activity
const uniqueActivityUsers = computed(() => {
  const users = new Set();
  sortedTimelineUpdates.value.forEach(update => {
    if (update.user) {
      users.add(update.user);
    }
  });
  return Array.from(users).sort();
});

// Computed padding for tab content (accounts for taller header on mobile/tablet)
const tabContentPadding = computed(() => {
  // On tablet/desktop (md+), header is single row, needs less padding
  // On mobile, header is two rows, needs more padding
  if (viewportWidth.value >= 768) {
    return 'pt-32'; // ~128px top padding, p-6 for other sides
  } else {
    return 'pt-48'; // ~192px top padding, p-6 for other sides
  }
});

// Computed class and style for details grid columns
const detailsGridClass = computed(() => {
  if (viewportWidth.value >= 1440) {
    // At 1440px+, don't apply xl:grid-cols-3 to avoid conflict with inline style
    return 'grid grid-cols-1 md:grid-cols-2 gap-6';
  } else if (viewportWidth.value >= 1280) {
    // 3 columns at 1280px - 1439px
    return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6';
  } else if (viewportWidth.value >= 768) {
    // 2 columns at 768px - 1279px
    return 'grid grid-cols-1 md:grid-cols-2 gap-6';
  }
  // 1 column below 768px
  return 'grid grid-cols-1 gap-6';
});

const detailsGridStyle = computed(() => {
  if (viewportWidth.value >= 1440) {
    // Override to 4 columns at 1440px+
    return { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' };
  }
  return {};
});

// Transform activity logs into activity items for the feeds UI
const activityItems = computed(() => {
  const items = sortedTimelineUpdates.value.map((update, index) => {
    const action = update.action || '';
    const lowerAction = action.toLowerCase();
    
    // Determine activity type based on action content
    let type = 'comment';
    let comment = action;
    let fieldName = '';
    let tags = [];
    let actionText = '';
    
    // Check for tag operations (e.g., "added tag "name"" or "removed tag "name"")
    if (lowerAction.includes('tag')) {
      type = 'tags';
      const tagMatch = action.match(/(?:added|removed)\s+tag\s+"?([^"]+)"?/i);
      if (tagMatch) {
        const tagName = tagMatch[1].replace(/^"|"$/g, ''); // Remove quotes if present
        const isRemoved = lowerAction.includes('removed');
        tags = [{
          name: tagName,
          color: 'fill-indigo-500'
        }];
        actionText = isRemoved ? 'removed tag' : 'added tag';
      } else {
        // Fallback for tag actions without proper format
        comment = action;
      }
    }
    // Check for field changes (e.g., "set First Name to "John"" or "changed First Name from "Old" to "New"")
    else if (lowerAction.includes('changed') || lowerAction.includes('set')) {
      type = 'assignment';
      
      // Try to extract field name and values
      const setMatch = action.match(/set\s+([^"]+?)\s+to\s+"([^"]*)"/i);
      const changeMatch = action.match(/changed\s+([^"]+?)\s+from\s+"([^"]*)"\s+to\s+"([^"]*)"/i);
      
      if (setMatch) {
        fieldName = formatFieldName(setMatch[1].trim());
        actionText = 'set';
        comment = `Set ${fieldName} to "${setMatch[2]}"`;
      } else if (changeMatch) {
        fieldName = formatFieldName(changeMatch[1].trim());
        actionText = 'changed';
        const oldVal = changeMatch[2] || 'empty';
        comment = `Changed ${fieldName} from "${oldVal}" to "${changeMatch[3]}"`;
      } else {
        // Fallback: try to extract just the field name
        const fieldMatch = action.match(/(?:changed|set)\s+([^\s]+)/i);
        if (fieldMatch) {
          fieldName = formatFieldName(fieldMatch[1]);
          actionText = lowerAction.includes('set') ? 'set' : 'changed';
        }
      }
    }
    // Everything else is a comment (follow, viewed, created, etc.)
    else {
      comment = action;
    }
    
    return {
      id: `activity-${update.timestamp?.getTime() || index}`,
      type,
      person: {
        name: update.user || 'System',
        href: '#'
      },
      comment,
      action: actionText,
      fieldName,
      tags,
      date: formatDate(update.timestamp)
    };
  });
  
  // Apply filters
  return items.filter(item => {
    // Filter by user
    if (activityFilterUser.value && item.person.name.toLowerCase() !== activityFilterUser.value.toLowerCase()) {
      return false;
    }
    
    // Filter by type
    if (activityFilterType.value && item.type !== activityFilterType.value) {
      return false;
    }
    
    // Filter by search query
    if (activitySearchQuery.value) {
      const query = activitySearchQuery.value.toLowerCase();
      const searchableText = `${item.person.name} ${item.comment} ${item.fieldName}`.toLowerCase();
      if (!searchableText.includes(query)) {
        return false;
      }
    }
    
    return true;
  });
});

// Available widgets
const availableWidgets = [
  {
    type: 'related-records',
    name: 'Related Records',
    description: 'Show related contacts, deals, etc.',
  },
  {
    type: 'activity-stream',
    name: 'Activity Stream',
    description: 'Recent activities and interactions',
  },
  {
    type: 'lifecycle-stage',
    name: 'Lifecycle Stage',
    description: 'Current stage and progression',
  },
  {
    type: 'metrics',
    name: 'Metrics',
    description: 'Key performance indicators',
  },
  {
    type: 'touchpoints',
    name: 'Touchpoints',
    description: 'Communication history',
  },
  {
    type: 'key-fields',
    name: 'Key Fields',
    description: 'Important record fields',
  }
];

// Initialize GridStack
const initializeGridStack = async () => {
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    return;
  }
  
  // Wait for DOM to be ready
  await nextTick();
  await nextTick(); // Extra tick to ensure v-if has rendered
  
  // Check if container exists
  if (!gridStackContainer.value) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }
  
  // Destroy existing instance if any
  if (gridStack) {
    destroyGridStack();
  }
  
  // Additional check to ensure element is in DOM
  if (!document.contains(gridStackContainer.value)) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }

  isInitializing = true;
  
  try {
    gridStack = GridStack.init({
      column: 12,
      cellHeight: 70,
      margin: '16px',
      animate: true,
      disableResize: false,
      disableDrag: false,
      columnOpts: {
        breakpoints: [
          { w: 600, c: 1 },  // Mobile: 1 column (< 600px)
          { w: 1024, c: 2 }  // Tablet: 2 columns (< 1024px)
        ]
      }
    }, gridStackContainer.value);
    
    // Add event listeners to save layout on changes
    // Debounce saves to avoid too many API calls
    let saveTimeout = null;
    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveLayoutState();
      }, 500); // Wait 500ms after last change before saving
    };
    
    gridStack.on('change', (event, items) => {
      debouncedSave();
    });
    
    gridStack.on('added', () => {
      debouncedSave();
    });
    
    gridStack.on('removed', () => {
      debouncedSave();
    });
    
    // Ensure CSS variables are set for margins
    if (gridStackContainer.value) {
      gridStackContainer.value.style.setProperty('--gs-item-margin-top', '8px');
      gridStackContainer.value.style.setProperty('--gs-item-margin-bottom', '8px');
      gridStackContainer.value.style.setProperty('--gs-item-margin-left', '8px');
      gridStackContainer.value.style.setProperty('--gs-item-margin-right', '8px');
      
      // Also update GridStack margin directly if supported
      if (gridStack && typeof gridStack.opts === 'function') {
        gridStack.opts({ margin: 8 });
      }
    }

    // Load default widgets after a short delay to ensure GridStack is ready
    setTimeout(async () => {
      isInitializing = false;
      
      // Check if GridStack is initialized
      if (!gridStack) {
        console.warn('GridStack not initialized, retrying...');
        setTimeout(() => initializeGridStack(), 100);
        return;
      }
      
      try {
        // Ensure record is available before loading widgets
        if (!props.record?._id && props.recordType === 'organizations') {
          console.warn('Record not available yet, retrying widget initialization...');
          setTimeout(() => {
            if (props.record?._id) {
              initializeGridStack();
            }
          }, 200);
          return;
        }
        
        // Check if there are any widgets already (by checking GridStack items)
        const existingWidgets = gridStack.getGridItems();
        if (existingWidgets.length === 0) {
          // Try to load saved layout first
          const savedLayout = await loadSavedLayout();
          if (savedLayout && savedLayout.length > 0) {
            loadSavedWidgets(savedLayout);
          } else {
            loadDefaultWidgets();
          }
        }
      } catch (err) {
        console.error('Error checking GridStack items:', err);
        // If error, try to load saved layout or default widgets
        const savedLayout = await loadSavedLayout();
        if (savedLayout && savedLayout.length > 0) {
          loadSavedWidgets(savedLayout);
        } else {
          loadDefaultWidgets();
        }
      }
    }, 150);
  } catch (err) {
    console.error('Error initializing GridStack:', err);
    isInitializing = false;
  }
};

// Destroy GridStack
const destroyGridStack = () => {
  // Unmount all Vue widget apps
  widgetApps.forEach((widgetData, element) => {
    try {
      if (widgetData.app) {
        widgetData.app.unmount();
      }
    } catch (e) {
      console.error('Error unmounting widget:', e);
    }
  });
  widgetApps.clear();
  
  if (gridStack) {
    try {
      gridStack.destroy();
      gridStack = null;
    } catch (err) {
      console.error('Error destroying GridStack:', err);
    }
  }
  isInitializing = false;
};

// Save layout state to backend API
const saveLayoutState = async () => {
  if (!gridStack || !gridStackContainer.value || !props.record?._id) return;
  
  try {
    // Get all grid items with their elements
    const gridItems = gridStack.getGridItems();
    const layoutData = gridItems.map(gridItem => {
      // Get the actual widget element (the one with data-widget-type)
      const widgetElement = gridItem;
      const widgetType = widgetElement?.getAttribute('data-widget-type');
      
      // Get GridStack position and size
      const x = parseInt(gridItem.getAttribute('gs-x')) || 0;
      const y = parseInt(gridItem.getAttribute('gs-y')) || 0;
      const w = parseInt(gridItem.getAttribute('gs-w')) || 4;
      const h = parseInt(gridItem.getAttribute('gs-h')) || 3;
      
      return {
        x,
        y,
        w,
        h,
        type: widgetType || null
      };
    }).filter(item => item.type); // Only save widgets with valid types
    
    // Save to backend API (silently fail - don't log errors for 404s)
    try {
      await apiClient.post('/user-preferences/widget-layout', {
        recordType: props.recordType,
        recordId: props.record._id,
        widgets: layoutData
      });
    } catch (apiError) {
      // Only log if it's not a 404 (backend route might not be available yet)
      if (!apiError.is404 && apiError.status !== 404) {
        console.error('Error saving layout to API:', apiError);
      }
      // Always fallback to localStorage if API fails
      localStorage.setItem(getLayoutStorageKey(), JSON.stringify(layoutData));
    }
  } catch (error) {
    console.error('Error saving layout state:', error);
  }
};

// Load saved layout from backend API or localStorage (fallback)
const loadSavedLayout = async () => {
  if (!props.record?._id) return null;
  
  try {
    // Try to load from backend API first
    try {
      const response = await apiClient.get('/user-preferences/widget-layout', {
        params: {
          recordType: props.recordType,
          recordId: props.record._id
        }
      });
      
      if (response.success && response.data) {
        return response.data;
      }
    } catch (apiError) {
      // Only log if it's not a 404 (backend route might not be available yet)
      if (!apiError.is404 && apiError.status !== 404) {
        console.warn('Error loading layout from API, trying localStorage:', apiError);
      }
      // Fallback to localStorage
      const saved = localStorage.getItem(getLayoutStorageKey());
      if (saved) {
        return JSON.parse(saved);
      }
    }
    
    // Try localStorage as fallback
    const saved = localStorage.getItem(getLayoutStorageKey());
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading saved layout:', error);
  }
  return null;
};

// Load saved widgets with their positions and sizes
const loadSavedWidgets = (savedLayout) => {
  if (!gridStack) return;
  
  savedLayout.forEach(widgetData => {
    if (widgetData.type) {
      addWidgetToGrid(widgetData.type, widgetData.x, widgetData.y, widgetData.w, widgetData.h);
    }
  });
  
  // Update GridStack to ensure margins are applied
  if (gridStack) {
    setTimeout(() => {
      gridStack.compact();
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
      saveLayoutState(); // Save after loading
    }, 100);
  }
};

// Load default widgets
const loadDefaultWidgets = () => {
  if (!gridStack) return;

  // Default widgets based on record type
  let defaultWidgets = [];
  
  if (props.recordType === 'organizations') {
    defaultWidgets = [
      { type: 'related-contacts', x: 0, y: 0, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: 0, w: 6, h: 4 },
      { type: 'metrics', x: 0, y: 4, w: 6, h: 4 },
      { type: 'lifecycle-stage', x: 6, y: 4, w: 6, h: 3 },
      { type: 'key-fields', x: 0, y: 7, w: 12, h: 3 }
    ];
  } else {
    // Default widgets for other record types
    defaultWidgets = [
      { type: 'related-organization', x: 0, y: 0, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: 0, w: 6, h: 4 },
      { type: 'related-tasks', x: 0, y: 4, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: 4, w: 6, h: 4 },
      { type: 'lifecycle-stage', x: 0, y: 8, w: 6, h: 4 },
      { type: 'key-fields', x: 6, y: 8, w: 6, h: 4 }
    ];
  }

  defaultWidgets.forEach(widget => {
    addWidgetToGrid(widget.type, widget.x, widget.y, widget.w, widget.h);
  });
  
  // Update GridStack to ensure margins are applied
  if (gridStack) {
    // Force GridStack to recalculate with margins
    setTimeout(() => {
      gridStack.compact();
      // Update GridStack to recalculate positions with margins
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
      saveLayoutState(); // Save default layout
    }, 100);
  }
};

// Add widget to GridStack
const addWidgetToGrid = (widgetType, x = 0, y = 0, w = 4, h = 3) => {
  if (!gridStack || !gridStackContainer.value) return;
  
  // Ensure record is available before creating widgets that need it
  if ((widgetType === 'related-contacts' || widgetType === 'related-deals' || widgetType === 'related-tasks' || widgetType === 'related-events') && !props.record?._id) {
    console.warn(`Cannot create ${widgetType} widget: record._id not available`);
    return;
  }

  const widgetElement = createWidgetElement(widgetType);
  
  // Store widget type as data attribute for persistence
  widgetElement.setAttribute('data-widget-type', widgetType);
  
  // Set GridStack attributes before appending
  widgetElement.setAttribute('gs-x', x);
  widgetElement.setAttribute('gs-y', y);
  widgetElement.setAttribute('gs-w', w);
  widgetElement.setAttribute('gs-h', h);
  
  // Append element to grid container
  gridStackContainer.value.appendChild(widgetElement);
  
  // Convert to GridStack widget using makeWidget()
  const widget = gridStack.makeWidget(widgetElement);
  
  // Update GridStack layout
  gridStack.compact();

  return widget;
};

// Store widget app instances for cleanup
const widgetApps = new Map();

// Create widget DOM element
const createWidgetElement = (widgetType) => {
  // Create container div with card styling - this becomes the widget card
  const container = document.createElement('div');
  container.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700';
  container.style.boxSizing = 'border-box';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-start';
  container.style.justifyContent = 'flex-start';
  
  // Determine which Vue component to use based on widget type and record type
  let Component = null;
  const componentProps = {};
  
  if (props.recordType === 'organizations' && props.record?._id) {
    switch (widgetType) {
      case 'related-contacts':
        Component = RelatedContactsWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['people'];
        break;
      case 'related-deals':
        Component = RelatedDealsWidget;
        // For organizations, use accountId to link deals to the organization record
        if (props.recordType === 'organizations') {
          componentProps.accountId = props.record._id;
        } else {
          componentProps.organizationId = props.record.legacyOrganizationId || props.record._id;
        }
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['deals'];
        break;
      case 'related-tasks':
        Component = RelatedTasksWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['tasks'];
        break;
      case 'related-events':
        Component = RelatedEventsWidget;
        componentProps.relatedType = 'Organization';
        componentProps.relatedId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['events'];
        break;
      case 'metrics':
        Component = OrganizationMetricsWidget;
        componentProps.stats = props.stats || {};
        break;
      case 'lifecycle-stage':
        Component = LifecycleStageWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'key-fields':
        Component = KeyFieldsWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      default:
        // Fallback to simple HTML widget
        container.innerHTML = getWidgetContent(widgetType);
        return container;
    }
  } else if (props.record?._id) {
    // For other record types, support lifecycle-stage and related-organization widgets
    switch (widgetType) {
      case 'lifecycle-stage':
        Component = LifecycleStageWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'key-fields':
        Component = KeyFieldsWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'related-organization':
        Component = RelatedOrganizationWidget;
        componentProps.organization = props.record.organization;
        componentProps.moduleDefinition = allModuleDefinitions.value['organizations'];
        break;
      case 'related-deals':
        Component = RelatedDealsWidget;
        componentProps.contactId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['deals'];
        break;
      case 'related-tasks':
        Component = RelatedTasksWidget;
        componentProps.contactId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['tasks'];
        break;
      case 'related-events':
        Component = RelatedEventsWidget;
        componentProps.relatedType = 'Contact';
        componentProps.relatedId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['events'];
        break;
      default:
        // Fallback to simple HTML widget
        container.innerHTML = getWidgetContent(widgetType);
        return container;
    }
  } else {
    // Fallback to simple HTML widget for other record types
    container.innerHTML = getWidgetContent(widgetType);
    return container;
  }
  
  // Mount Vue component
  if (Component) {
    // Create wrapper component that handles events
    // IMPORTANT: Since we're using createApp, events don't bubble to parent
    // So we need to call the handler function directly
    // We need to get the record data from the widget props/state
    // Since widgets emit just IDs, we'll fetch the name in handleOpenRelatedRecord
    const handleViewContact = (id) => {
      handleOpenRelatedRecord({ type: 'people', id });
    };
    const handleViewUser = (id) => {
      handleOpenRelatedRecord({ type: 'users', id });
    };
    const handleViewDeal = (id) => {
      handleOpenRelatedRecord({ type: 'deals', id });
    };
    const handleViewOrganization = (id) => {
      handleOpenRelatedRecord({ type: 'organizations', id });
    };
    const handleViewTask = (id) => {
      handleOpenRelatedRecord({ type: 'tasks', id });
    };
    const handleViewEvent = (id) => {
      handleOpenRelatedRecord({ type: 'events', id });
    };
    
    const wrapperComponent = {
      setup(_, { expose }) {
        // Store reference to child component instance
        const childComponentRef = ref(null);
        
        // Pass props directly - widgets will watch for changes
        const handleUpdate = (data) => {
          // Handle lifecycle stage updates
          if (data.field && data.value !== undefined) {
            updateField(data.field, data.value);
          }
        };
        
        // Expose refresh method that calls the child component's refresh
        expose({
          refresh: () => {
            if (childComponentRef.value && typeof childComponentRef.value.refresh === 'function') {
              childComponentRef.value.refresh();
            }
          }
        });
        
        return () => h(Component, {
          ref: childComponentRef,
          ...componentProps,
          // Pass reactive record from props if lifecycle-stage widget
          record: widgetType === 'lifecycle-stage' ? props.record : componentProps.record,
          recordType: widgetType === 'lifecycle-stage' ? props.recordType : componentProps.recordType,
          moduleDefinition: widgetType === 'lifecycle-stage' ? moduleDefinition.value : componentProps.moduleDefinition,
          // Pass reactive organization from props if related-organization widget
          organization: widgetType === 'related-organization' ? props.record.organization : componentProps.organization,
          onViewContact: handleViewContact,
          onViewUser: handleViewUser,
          onViewDeal: handleViewDeal,
          onViewOrganization: handleViewOrganization,
          onViewTask: handleViewTask,
          onViewEvent: handleViewEvent,
          onCreateContact: () => handleCreateRecord('people'),
          onCreateUser: () => handleCreateRecord('users'),
          onCreateDeal: () => handleCreateRecord('deals'),
          onCreateTask: () => handleCreateRecord('tasks'),
          onCreateEvent: () => handleCreateRecord('events'),
          onCreateOrganization: () => handleCreateRecord('organizations'),
          onUpdate: handleUpdate
        });
      }
    };
    
    const app = createApp(wrapperComponent);
    app.mount(container);
    
    // Store app instance for cleanup
    widgetApps.set(container, { app });
  }
  
  return container;
};

// Get widget content based on type
const getWidgetContent = (widgetType) => {
  switch (widgetType) {
    case 'related-records':
      return '<p>No related records found.</p>';
    case 'activity-stream':
      return '<p>No recent activity.</p>';
    case 'lifecycle-stage':
      return `<p>Status: ${props.record?.status || 'Active'}</p>`;
    case 'metrics':
      return '<p>No metrics available.</p>';
    case 'touchpoints':
      return '<p>No touchpoints recorded.</p>';
    case 'key-fields':
      return '<p>Key fields will be displayed here.</p>';
    default:
      return '<p>Widget content</p>';
  }
};

// Add widget
const addWidget = (widgetType) => {
  addWidgetToGrid(widgetType);
  showWidgetModal.value = false;
};

// Toggle follow
const toggleFollow = () => {
  isFollowing.value = !isFollowing.value;
  
  // Log activity
  if (isFollowing.value) {
    addActivityLog('started following this record');
  } else {
    addActivityLog('stopped following this record');
  }
};

// Copy URL
const copyUrl = () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('URL copied to clipboard!');
  });
};

// Add tag
const addTag = () => {
  if (newTag.value.trim()) {
    const tagName = newTag.value.trim();
    tags.value.push(tagName);
    newTag.value = '';
    showTagModal.value = false;
    
    // Log activity
    addActivityLog(`added tag "${tagName}"`);
  }
};

// Remove tag
const removeTag = (index) => {
  const tagName = tags.value[index];
  tags.value.splice(index, 1);
  
  // Log activity
  if (tagName) {
    addActivityLog(`removed tag "${tagName}"`);
  }
};

// Helper function to normalize values for comparison
const normalizeValue = (val) => {
  if (val === null || val === undefined || val === '') return '';
  
  // Handle arrays (for multi-picklist fields)
  if (Array.isArray(val)) {
    return JSON.stringify(val.sort());
  }
  
  // Handle objects
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  
  return String(val).trim();
};

// Update field (auto-saves on blur)
const updateField = (field, value) => {
  const oldValue = props.record ? props.record[field] : null;
  const fieldName = formatFieldName(field);
  
  // Normalize values for comparison
  const normalizedOldValue = normalizeValue(oldValue);
  const normalizedNewValue = normalizeValue(value);
  
  // Only proceed if value actually changed
  if (normalizedOldValue === normalizedNewValue) {
    return; // No change, don't update or log
  }
  
  emit('update', { field, value });
  if (props.record) {
    props.record[field] = value;
  }
  
  // Log activity only if value changed
  let action = '';
  if (normalizedOldValue === '') {
    action = `set ${fieldName} to "${value}"`;
  } else {
    action = `changed ${fieldName} from "${oldValue}" to "${value}"`;
  }
  addActivityLog(action);
};

// Discard field changes (revert to original value)
const discardField = (field, event) => {
  // Restore original value
  if (props.record) {
    props.record[field] = originalFieldValues.value[field];
  }
  // Update the input/textarea element
  if (event && event.target) {
    event.target.value = originalFieldValues.value[field] || '';
  }
};

// Format field name
const formatFieldName = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

// Format field value
const formatFieldValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Check if field is editable
const isEditableField = (key) => {
  const nonEditableFields = ['_id', 'id', 'createdAt', 'updatedAt', 'avatar'];
  return !nonEditableFields.includes(key);
};

// Fetch module definition
const fetchModuleDefinition = async () => {
  try {
    const response = await apiClient.get('/modules');
    const modules = response.data || [];
    
    // Create a map of all module definitions by key
    const moduleMap = {};
    modules.forEach(mod => {
      moduleMap[mod.key] = mod;
    });
    allModuleDefinitions.value = moduleMap;
    
    // Set the current module definition
    const module = modules.find(m => m.key === props.recordType);
    if (module) {
      moduleDefinition.value = module;
    }
  } catch (error) {
    console.error('Error fetching module definition:', error);
  }
};

// Get field definition for a given key
const getFieldDefinition = (key) => {
  if (!moduleDefinition.value?.fields) return null;
  return moduleDefinition.value.fields.find(f => 
    f.key?.toLowerCase() === key.toLowerCase()
  );
};

// Get input type based on field definition and value
const getInputType = (key, value) => {
  const fieldDef = getFieldDefinition(key);
  
  if (fieldDef) {
    switch (fieldDef.dataType) {
      case 'Date':
        return 'date';
      case 'DateTime':
        return 'datetime-local';
      case 'Number':
      case 'Currency':
        return 'number';
      case 'Checkbox':
      case 'Boolean':
        return 'checkbox';
      case 'Email':
        return 'email';
      case 'Phone':
        return 'tel';
      case 'URL':
      case 'Website':
        return 'url';
      case 'Text':
      case 'Text-Area':
      case 'Rich Text':
        return 'text';
      default:
        return 'text';
    }
  }
  
  // Fallback to value-based detection
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  if (key.includes('email')) return 'email';
  if (key.includes('date')) return 'date';
  if (key.includes('phone')) return 'tel';
  if (key.includes('url')) return 'url';
  return 'text';
};

// Check if field is a picklist
const isPicklistField = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef) return false;
  return fieldDef.dataType === 'Picklist' || fieldDef.dataType === 'Multi-Picklist';
};

// Check if field is a text area
const isTextAreaField = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef) return false;
  return fieldDef.dataType === 'Text-Area' || fieldDef.dataType === 'Rich Text';
};

// Get picklist options
const getPicklistOptions = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef || !fieldDef.options) return [];
  return fieldDef.options;
};

// Get lifecycle and status fields for display in header
const getLifecycleStatusFields = computed(() => {
  if (!moduleDefinition.value?.fields || !props.record) return [];
  
  const statusFields = [];
  const record = props.record;
  
  // For People module, show type + lead_status/contact_status
  if (props.recordType === 'people') {
    // Type field
    const typeField = getFieldDefinition('type');
    if (typeField) {
      statusFields.push({
        key: 'type',
        label: 'Type',
        value: record.type,
        options: typeField.options || [],
        fieldDef: typeField
      });
    }
    
    // Lead status (if type is Lead)
    if (record.type === 'Lead') {
      const leadStatusField = getFieldDefinition('lead_status');
      if (leadStatusField) {
        statusFields.push({
          key: 'lead_status',
          label: 'Lead Status',
          value: record.lead_status,
          options: leadStatusField.options || [],
          fieldDef: leadStatusField
        });
      }
    }
    
    // Contact status (if type is Contact)
    if (record.type === 'Contact') {
      const contactStatusField = getFieldDefinition('contact_status');
      if (contactStatusField) {
        statusFields.push({
          key: 'contact_status',
          label: 'Contact Status',
          value: record.contact_status,
          options: contactStatusField.options || [],
          fieldDef: contactStatusField
        });
      }
    }
  } else if (props.recordType === 'organizations') {
    // For Organizations module, show types + relevant status fields
    // Note: types is a Multi-Picklist (array), so we'll show it as a display field and show status fields
    // Show relevant status fields based on types
    if (Array.isArray(record.types) && record.types.length > 0) {
      // Customer status (if Customer is in types)
      if (record.types.includes('Customer')) {
        const customerStatusField = getFieldDefinition('customerStatus');
        if (customerStatusField) {
          statusFields.push({
            key: 'customerStatus',
            label: 'Customer Status',
            value: record.customerStatus,
            options: customerStatusField.options || [],
            fieldDef: customerStatusField
          });
        }
      }
      
      // Partner status (if Partner is in types)
      if (record.types.includes('Partner')) {
        const partnerStatusField = getFieldDefinition('partnerStatus');
        if (partnerStatusField) {
          statusFields.push({
            key: 'partnerStatus',
            label: 'Partner Status',
            value: record.partnerStatus,
            options: partnerStatusField.options || [],
            fieldDef: partnerStatusField
          });
        }
      }
      
      // Vendor status (if Vendor is in types)
      if (record.types.includes('Vendor')) {
        const vendorStatusField = getFieldDefinition('vendorStatus');
        if (vendorStatusField) {
          statusFields.push({
            key: 'vendorStatus',
            label: 'Vendor Status',
            value: record.vendorStatus,
            options: vendorStatusField.options || [],
            fieldDef: vendorStatusField
          });
        }
      }
    }
  } else {
    // For other modules, look for common status/lifecycle fields
    const statusField = getFieldDefinition('status');
    const lifecycleField = getFieldDefinition('lifecycle_stage');
    
    if (lifecycleField) {
      statusFields.push({
        key: 'lifecycle_stage',
        label: 'Lifecycle Stage',
        value: record.lifecycle_stage,
        options: lifecycleField.options || [],
        fieldDef: lifecycleField
      });
    }
    
    if (statusField) {
      statusFields.push({
        key: 'status',
        label: 'Status',
        value: record.status,
        options: statusField.options || [],
        fieldDef: statusField
      });
    }
  }
  
  return statusFields;
});

// Format date with time for activity timeline
const formatDate = (date) => {
  if (!date) return '-';
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = now - dateObj;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Show relative time for recent activities
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  // For older activities, show full date and time
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get initials
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 1);
};

// Color mapping for alphabets A-Z
const getColorForLetter = (letter) => {
  const colors = {
    'A': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300' },
    'B': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300' },
    'C': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300' },
    'D': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-300' },
    'E': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-700 dark:text-lime-300' },
    'F': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300' },
    'G': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300' },
    'H': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-700 dark:text-teal-300' },
    'I': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-300' },
    'J': { bg: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-700 dark:text-sky-300' },
    'K': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
    'L': { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300' },
    'M': { bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-700 dark:text-violet-300' },
    'N': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
    'O': { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
    'P': { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-700 dark:text-pink-300' },
    'Q': { bg: 'bg-rose-100 dark:bg-rose-900', text: 'text-rose-700 dark:text-rose-300' },
    'R': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
    'S': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
    'T': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-200' },
    'U': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
    'V': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-800 dark:text-lime-200' },
    'W': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
    'X': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-800 dark:text-emerald-200' },
    'Y': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
    'Z': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' }
  };
  return colors[letter.toUpperCase()] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' };
};

// Get color for a name based on first letter
const getColorForName = (name) => {
  if (!name) return getColorForLetter('?');
  const firstLetter = name.trim()[0];
  return getColorForLetter(firstLetter);
};

// Get color for a picklist option
const getColorForOption = (option) => {
  // Handle null/undefined
  if (!option) return null;
  
  // Support both string (backward compatibility) and object formats
  if (typeof option === 'object' && option.color) {
    return option.color;
  }
  return null;
};

// Convert hex color to RGB
const hexToRgb = (hexColor) => {
  if (!hexColor) return null;
  
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return { r, g, b };
};

// Get contrast color (black or white) based on background brightness
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#1f2937';
  
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#1f2937';
  
  // Calculate brightness using relative luminance formula
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  
  // Return black for light colors, white for dark colors
  return brightness > 155 ? '#1f2937' : '#ffffff';
};

// Get selected option for a field
const getSelectedOption = (field) => {
  if (!field.value || !field.options) return null;
  
  return field.options.find(opt => {
    const optValue = typeof opt === 'string' ? opt : opt.value;
    return String(optValue) === String(field.value);
  });
};

// Get button color classes
const getButtonColorClasses = (field) => {
  const selectedOption = getSelectedOption(field);
  const optionColor = getColorForOption(selectedOption);
  
  // Base classes for all buttons
  const baseClasses = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors border';
  
  // If no color, use default classes
  if (!optionColor) {
    return `${baseClasses} bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600`;
  }
  
  // If we have a custom color, return base classes only (inline styles will handle colors)
  return `${baseClasses} hover:opacity-90`;
};

// Get button color style (inline styles for custom colors)
const getButtonColorStyle = (field) => {
  const selectedOption = getSelectedOption(field);
  const optionColor = getColorForOption(selectedOption);
  
  // If no color, return empty style
  if (!optionColor) {
    return {};
  }
  
  // Convert hex to RGB for opacity calculation
  const rgb = hexToRgb(optionColor);
  if (!rgb) {
    return {};
  }
  
  // Apply the color as text and use 15% opacity for background
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    borderColor: optionColor,
    color: optionColor
  };
};

// Check if an option is selected
const getOptionIsSelected = (field, option) => {
  if (!field.value) return false;
  
  const optValue = typeof option === 'string' ? option : option.value;
  return String(optValue) === String(field.value);
};

// Handler functions for dynamic tabs
const handleUpdate = (updateData) => {
  emit('update', updateData);
};

const handleEdit = () => {
  emit('edit');
};

const handleDelete = () => {
  emit('delete');
};

const handleAddRelation = (relationData) => {
  emit('addRelation', relationData);
};

const handleCreateRecord = (moduleKey) => {
  const initialData = {};
  
  // Pre-fill form based on current record context
  if (props.record && props.record._id) {
    if (props.recordType === 'organizations') {
      // If creating from organization context
      if (moduleKey === 'people') {
        initialData.organization = props.record._id;
      } else if (moduleKey === 'deals') {
        initialData.accountId = props.record._id;
      } else if (moduleKey === 'tasks' || moduleKey === 'events') {
        initialData.relatedTo = {
          type: 'organization',
          id: props.record._id
        };
      }
    } else if (props.recordType === 'people') {
      // If creating from people/contact context
      if (moduleKey === 'deals') {
        initialData.contactId = props.record._id;
      } else if (moduleKey === 'tasks' || moduleKey === 'events') {
        initialData.relatedTo = {
          type: 'contact',
          id: props.record._id
        };
      }
    }
  }
  
  createDrawerModuleKey.value = moduleKey;
  createDrawerInitialData.value = initialData;
  showCreateDrawer.value = true;
};

const handleCreateDrawerSaved = (newRecord) => {
  // Refresh widgets to show the new record
  refreshAllWidgets();
  
  // Don't open the new record in a tab - just refresh the widget
  // The drawer will close automatically via the closeDrawer function
};

const handleCreateDrawerClose = () => {
  showCreateDrawer.value = false;
  createDrawerModuleKey.value = '';
  createDrawerInitialData.value = {};
};

const refreshAllWidgets = () => {
  if (!gridStack) return;
  
  const widgets = gridStack.getGridItems();
  widgets.forEach(item => {
    const widgetType = item.getAttribute('data-widget-type');
    if (widgetType) {
      // Find the Vue app instance and call refresh if available
      const widgetAppsEntry = Array.from(widgetApps.entries()).find(([el]) => el === item);
      if (widgetAppsEntry) {
        const [, { app }] = widgetAppsEntry;
        // Try to access the exposed refresh method from the wrapper component
        try {
          const rootComponent = app._instance;
          if (rootComponent?.exposed && typeof rootComponent.exposed.refresh === 'function') {
            rootComponent.exposed.refresh();
          }
        } catch (error) {
          console.warn('Error refreshing widget:', widgetType, error);
        }
      }
    }
  });
};

const getCreateDrawerTitle = () => {
  const titles = {
    'people': 'New Contact',
    'organizations': 'New Organization',
    'deals': 'New Deal',
    'tasks': 'New Task',
    'events': 'New Event',
    'users': 'New User'
  };
  return titles[createDrawerModuleKey.value] || 'Create Record';
};

const getCreateDrawerDescription = () => {
  const descriptions = {
    'people': 'Add a new contact to your CRM.',
    'organizations': 'Add a new organization to your CRM.',
    'deals': 'Create a new deal opportunity.',
    'tasks': 'Create a new task.',
    'events': 'Schedule a new event.',
    'users': 'Add a new user to your organization.'
  };
  return descriptions[createDrawerModuleKey.value] || 'Fill in the information below to create a new record.';
};

const handleOpenRelatedRecord = async (relatedRecord) => {
  // Emit to parent for any additional handling
  emit('openRelatedRecord', relatedRecord);
  
  // Open record in global TabBar
  if (relatedRecord.type && relatedRecord.id) {
    const path = `/${relatedRecord.type}/${relatedRecord.id}`;
    const icon = relatedRecord.type === 'deals' ? 'briefcase' : 
                 relatedRecord.type === 'contacts' ? 'users' : 
                 relatedRecord.type === 'people' ? 'users' :
                 relatedRecord.type === 'users' ? 'users' : 'document';
    
    // If we don't have the name, fetch it first
    let title = relatedRecord.name || 'Record';
    
    if (!relatedRecord.name) {
      try {
        // Determine API endpoint based on record type
        let endpoint = '';
        if (relatedRecord.type === 'organizations') {
          const authStore = useAuthStore();
          const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
          endpoint = isAdmin 
            ? `/admin/organizations/${relatedRecord.id}`
            : `/organization`;
        } else if (relatedRecord.type === 'contacts' || relatedRecord.type === 'people') {
          const authStore = useAuthStore();
          const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
          endpoint = isAdmin 
            ? `/admin/contacts/${relatedRecord.id}`
            : `/people/${relatedRecord.id}`;
        } else {
          endpoint = `/${relatedRecord.type}/${relatedRecord.id}`;
        }
        
        const response = await apiClient.get(endpoint);
        
        // Extract name from response
        if (response.success && response.data) {
          const record = response.data;
          // Different record types have different name fields
          if (relatedRecord.type === 'contacts' || relatedRecord.type === 'people') {
            title = `${record.first_name || ''} ${record.last_name || ''}`.trim() || record.email || 'Contact';
          } else if (relatedRecord.type === 'users') {
            title = record.name || record.email || 'User';
          } else {
            title = record.name || 'Record';
          }
        }
      } catch (err) {
        console.error('Error fetching record name:', err);
        // Use default title if fetch fails
      }
    }
    
    // Open tab - openTab already handles router.push which will trigger component load
    openTab(path, {
      title: title,
      icon: icon,
      params: { name: title } // Pass name in params for potential title updates
    });
  }
};


// Watch for tab changes to initialize/destroy GridStack and save active tab
watch(activeTab, (newTab, oldTab) => {
  // Save active tab to localStorage
  saveActiveTab(newTab);
  
  if (newTab === 'summary') {
    // Initialize GridStack when switching to summary tab
    // Wait a bit longer to ensure the tab content is rendered
    setTimeout(() => {
      initializeGridStack();
    }, 100);
  } else if (oldTab === 'summary' && newTab !== 'summary') {
    // Destroy GridStack when leaving summary tab
    destroyGridStack();
  }
});

// Watch for record changes to reload saved tab and log initial load
watch(() => props.record, async (newRecord, oldRecord) => {
  if (newRecord && (newRecord._id || newRecord.id)) {
    const recordId = newRecord._id || newRecord.id;
    const oldRecordId = oldRecord?._id || oldRecord?.id;
    
    // If record changed (different ID), reset logs and load new ones
    if (oldRecordId !== recordId) {
      timelineUpdates.value = [];
      loggedRecordIds.value.clear();
      await loadActivityLogs();
    } else if (!oldRecordId) {
      // First load - load existing logs from API
      await loadActivityLogs();
    }
    
    // Log initial load if this is a new record we haven't logged yet
    // Only add "viewed" log if:
    // 1. We haven't logged this record ID before
    // 2. AND there are no existing logs (meaning it's a fresh record, not loaded from storage)
    if (!loggedRecordIds.value.has(recordId) && timelineUpdates.value.length === 0) {
      loggedRecordIds.value.add(recordId);
      const recordName = newRecord.name || 'this record';
      await addActivityLog(`viewed ${recordName}`, { type: 'view', recordId });
    } else if (!loggedRecordIds.value.has(recordId)) {
      // If we have logs but haven't tracked this record ID, just mark it as logged
      loggedRecordIds.value.add(recordId);
    }
    
    const savedTab = loadActiveTab();
    // Validate that the saved tab still exists
    const isValidTab = fixedTabs.value.some(t => t.id === savedTab);
    if (isValidTab && savedTab !== activeTab.value) {
      activeTab.value = savedTab;
    }
  }
}, { immediate: true }); // Run immediately to catch initial load

// Lifecycle hooks
onMounted(async () => {
  // Fetch module definition for field mapping
  await fetchModuleDefinition();
  
  // Initialize tags from record if available
  if (props.record && props.record.tags && Array.isArray(props.record.tags)) {
    tags.value = [...props.record.tags];
  }
  
  // Listen for sidebar toggle events and window resize
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  window.addEventListener('resize', handleResize);
  
  // Set initial viewport width
  viewportWidth.value = window.innerWidth;
  
  // Load saved tab if record is already loaded
  if (props.record && (props.record._id || props.record.id)) {
    const savedTab = loadActiveTab();
    const isValidTab = fixedTabs.value.some(t => t.id === savedTab);
    if (isValidTab && savedTab !== 'summary') {
      activeTab.value = savedTab;
    }
  }
  
  // Validate current tab
  const currentTab = activeTab.value;
  const isValidTab = fixedTabs.value.some(t => t.id === currentTab);
  if (!isValidTab) {
    activeTab.value = 'summary';
  }
  
  if (activeTab.value === 'summary') {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      initializeGridStack();
    }, 100);
  }
});

onUnmounted(() => {
  // Remove event listeners
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
  window.removeEventListener('resize', handleResize);
  destroyGridStack();
});

</script>

<template>
  <!-- Row layout: icon + label (min-width) + value next to label (Core Fields style) -->
  <div
    v-if="layout === 'row'"
    :class="['editable-labeled-value editable-labeled-value--row record-field-row-grid', rowPaddingClass]"
  >
    <span class="editable-labeled-value__icon flex h-4 w-4 shrink-0 items-center justify-center text-gray-400 dark:text-gray-500" aria-hidden="true">
      <component :is="fieldIcon" class="h-4 w-4" />
    </span>
    <span class="editable-labeled-value__label min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{{ label }}</span>
    <div
      :class="[
        'editable-labeled-value__value flex-1 min-w-0 flex min-h-8 text-sm rounded px-2 -mx-2 -my-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
        /* Single-line edit: keep items-center so the row does not jump vs display mode; multiline needs top alignment */
        isEditing && multiline ? 'items-start pt-0.5' : 'items-center',
        hasDisplayValue ? 'text-gray-900 dark:text-white' : 'text-record-empty',
        isValueCellClickable ? 'cursor-text' : ''
      ]"
      @click="onValueCellClick"
    >
      <!-- Select/User/Entity: dropdown — Listbox must have a single element child (Headless UI); error sits outside -->
      <div
        v-if="layout === 'row' && canEdit && (type === 'select' || type === 'user' || type === 'entity')"
        class="w-full min-w-0 flex-1 flex flex-col"
      >
        <Listbox
          v-slot="{ open }"
          :model-value="selectModelValue"
          @update:model-value="handleSelectChange"
          class="w-full min-w-0 flex-1"
        >
          <div class="relative w-full min-w-0 flex-1 flex">
            <ListboxButton
            :class="[
              'editable-labeled-value__display flex-1 min-w-0 w-full min-h-8 text-left rounded transition-colors cursor-pointer',
              'inline-flex items-center flex-nowrap hover:bg-gray-50 dark:hover:bg-gray-800',
              'px-2 -mx-2 -my-1',
              saveHttpError ? 'ring-2 ring-red-500/80 ring-offset-1 dark:ring-offset-gray-900' : ''
            ]"
          >
            <slot v-if="type === 'user'">
              <span v-if="displayValue" class="inline-flex items-center gap-2 min-w-0 max-w-full flex-nowrap">
                <Avatar v-if="selectedUserForAvatar" :user="selectedUserForAvatar" size="sm" class="shrink-0" />
                <span class="truncate min-w-0">{{ displayValue }}</span>
              </span>
              <span v-else class="text-record-empty">—</span>
            </slot>
            <template v-else-if="type === 'select'">
              <span
                v-if="displayValue && getTagChipStyle"
                class="inline-block text-xs px-2 py-0.5 rounded max-w-full truncate"
                :style="getTagChipStyle(value)"
              >{{ displayValue }}</span>
              <span v-else-if="displayValue" class="editable-labeled-value__text block truncate">{{ displayValue }}</span>
              <span v-else class="text-record-empty">—</span>
            </template>
            <template v-else>
              <span
                v-if="displayValue"
                :class="[
                  'editable-labeled-value__text block truncate',
                  canOpenLinkedRecord ? 'transition-colors hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer' : ''
                ]"
                @click="onLinkedRecordClick"
              >{{ displayValue }}</span>
              <span v-else class="text-record-empty">—</span>
            </template>
          </ListboxButton>
          <Transition leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
            <ListboxOptions
              v-if="open"
              class="absolute left-0 top-full !bottom-auto z-10 mt-1 w-full max-w-[min(100vw,24rem)] min-w-[200px] max-h-72 flex flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <div
                v-if="showListboxSearch"
                class="shrink-0 p-2 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                @click.stop
                @mousedown.stop
              >
                <div class="relative">
                  <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    v-model="listboxSearchQuery"
                    type="text"
                    :placeholder="listboxSearchPlaceholder"
                    class="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    autocomplete="off"
                    @click.stop
                    @keydown.stop
                  />
                </div>
              </div>
              <div class="min-h-0 max-h-52 overflow-y-auto py-1">
                <ListboxOption v-if="allowEmpty || type === 'user' || type === 'entity'" :value="null" v-slot="{ active }">
                  <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                    <span :class="['editable-labeled-value__text block truncate', active ? '' : 'text-gray-500 dark:text-gray-400']">{{ type === 'user' ? t('records.editableUnassigned') : (type === 'entity' ? t('records.editableSelectOption') : (emptyLabel || t('records.editableSelectOption'))) }}</span>
                  </li>
                </ListboxOption>
                <ListboxOption v-for="option in filteredSelectOptions" :key="String(option.value)" :value="option.value" v-slot="{ active, selected }">
                  <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                    <span :class="['editable-labeled-value__text block truncate', selected ? 'font-medium' : 'font-normal']">{{ option.label }}</span>
                    <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                      <CheckIcon class="h-5 w-5" aria-hidden="true" />
                    </span>
                  </li>
                </ListboxOption>
                <div
                  v-if="showListboxSearch && filteredSelectOptions.length === 0"
                  class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  {{ t('records.editableNoMatches') }}
                </div>
              </div>
            </ListboxOptions>
          </Transition>
          </div>
        </Listbox>
        <p v-if="saveHttpError" class="text-xs text-red-600 dark:text-red-400 leading-snug w-full min-w-0 break-words pl-0.5">{{ saveHttpError }}</p>
      </div>
      <!-- Row: multi-select picklist — chip display + dropdown -->
      <div
        v-else-if="layout === 'row' && canEdit && type === 'multi-select'"
        class="w-full min-w-0 flex-1 flex flex-col"
        @click.stop
      >
        <TagMultiPicklistField
          :model-value="multiSelectValue"
          :options="options"
          :field-key="fieldKey"
          :module-key="moduleKey"
          variant="inline"
          :has-error="Boolean(saveHttpError)"
          :placeholder="t('records.editableSelectOption')"
          @update:model-value="handleMultiSelectChange"
        />
        <p v-if="saveHttpError" class="text-xs text-red-600 dark:text-red-400 leading-snug w-full min-w-0 break-words pl-0.5 mt-1">{{ saveHttpError }}</p>
      </div>
      <!-- Row: phone — popover editor (click to edit; panel uses create-drawer PhoneInput styling) -->
      <div
        v-else-if="layout === 'row' && canEdit && type === 'phone'"
        class="w-full min-w-0 flex-1 flex flex-col"
        @click.stop
      >
        <PhoneInput
          ref="inputRef"
          popover
          minimal-trigger
          :model-value="localValue"
          :default-country="defaultPhoneCountry"
          :placeholder="t('records.editablePhonePh')"
          :invalid="Boolean(phoneError || saveHttpError)"
          trigger-class="editable-labeled-value__display flex-1 min-w-0 w-full min-h-8 text-left rounded transition-colors cursor-pointer flex items-center hover:bg-gray-50 dark:hover:bg-gray-800 px-2 -mx-2 -my-1"
          :input-class="formPhoneInputClass"
          @update:model-value="onPhoneInput"
          @blur="handlePhoneRowBlur"
          @escape="handlePhoneRowCancel"
        />
        <p v-if="phoneError" class="mt-1 text-xs text-red-600 dark:text-red-400 leading-snug w-full min-w-0 break-words pl-0.5">{{ phoneError }}</p>
        <p v-else-if="saveHttpError" class="mt-1 text-xs text-red-600 dark:text-red-400 leading-snug w-full min-w-0 break-words pl-0.5">{{ saveHttpError }}</p>
      </div>
      <!-- Select/User/Entity read-only: tag or dash -->
      <div
        v-else-if="layout === 'row' && !canEdit && (type === 'select' || type === 'user' || type === 'entity' || type === 'multi-select')"
        class="flex-1 min-w-0 w-full min-h-8 flex items-center rounded px-2 -mx-2 -my-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div
          v-if="type === 'multi-select' && multiSelectValue.length > 0"
          class="flex flex-wrap gap-1.5 min-w-0"
        >
          <span
            v-for="(tag, index) in multiSelectValue"
            :key="`${tag}-${index}`"
            :style="getTagChipStyle ? getTagChipStyle(tag) : undefined"
            :class="['inline-block text-xs px-2 py-0.5 rounded', (getTagChipClass ? getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
          >
            {{ tag }}
          </span>
        </div>
        <slot v-else-if="type === 'user'">
          <span v-if="displayValue" class="inline-flex items-center gap-2 min-w-0 max-w-full flex-nowrap">
            <Avatar v-if="selectedUserForAvatar" :user="selectedUserForAvatar" size="sm" class="shrink-0" />
            <span class="truncate min-w-0">{{ displayValue }}</span>
          </span>
          <span v-else class="text-record-empty">—</span>
        </slot>
        <template v-else-if="type === 'select'">
          <span
            v-if="displayValue && getTagChipStyle"
            class="inline-block text-xs px-2 py-0.5 rounded max-w-full truncate"
            :style="getTagChipStyle(value)"
          >{{ displayValue }}</span>
          <span v-else-if="displayValue" class="editable-labeled-value__text block truncate">{{ displayValue }}</span>
          <span v-else class="text-record-empty">—</span>
        </template>
        <template v-else>
          <span
            v-if="displayValue"
            :class="[
              'editable-labeled-value__text block truncate',
              canOpenLinkedRecord ? 'transition-colors hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer' : ''
            ]"
            @click="onLinkedRecordClick"
          >{{ displayValue }}</span>
          <span v-else class="text-record-empty">—</span>
        </template>
      </div>
      <!-- Row: text/url/number/date display or edit — stack field + error vertically so message doesn't sit beside the input -->
      <div
        v-else-if="layout === 'row' && isEditing && canEdit"
        :class="[
          'editable-labeled-value__edit min-w-0 w-full flex flex-col items-stretch gap-1',
          multiline ? 'min-h-[80px]' : ''
        ]"
      >
        <PeopleFirstNameWithSalutationField
          v-if="peopleFirstNameWithSalutation && (type === 'text' || type === 'url') && !multiline"
          :first-name="String(localValue ?? '')"
          :salutation="String(localSalutation ?? '')"
          :salutation-options="salutationOptions"
          :invalid="Boolean(saveHttpError)"
          :first-name-placeholder="t('people.sysFieldFirstName')"
          @update:first-name="onFirstNameFieldUpdate"
          @update:salutation="onSalutationFieldUpdate"
          @blur="handleBlur"
        />
        <input
          v-else-if="(type === 'text' || type === 'url') && !multiline && !peopleFirstNameWithSalutation"
          ref="inputRef"
          v-model="localValue"
          @blur="handleBlur"
          @keydown.enter="handleBlur"
          @keydown.esc="handleCancel"
          :class="[
            'w-full h-8 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            saveHttpError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
          ]"
          type="text"
        />
        <textarea
          v-else-if="type === 'text' && multiline"
          ref="inputRef"
          v-model="localValue"
          @blur="handleBlur"
          @keydown.esc="handleCancel"
          :class="[
            'w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y min-h-[80px]',
            saveHttpError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
          ]"
          :rows="rows || 3"
        />
        <input
          v-else-if="type === 'number'"
          ref="inputRef"
          v-model.number="localValue"
          @blur="handleBlur"
          @keydown.enter="handleBlur"
          @keydown.esc="handleCancel"
          :class="[
            'w-full h-8 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            saveHttpError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
          ]"
          type="number"
          :min="min"
          :max="max"
          :step="step"
        />
        <DatePicker
          v-else-if="type === 'date'"
          ref="inputRef"
          v-model="localValue"
          :invalid="Boolean(saveHttpError)"
          :input-class="[
            'w-full h-8 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer',
            saveHttpError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
          ].join(' ')"
          @blur="handleBlur"
          @escape="handleCancel"
        />
        <p
          v-if="saveHttpError && type !== 'phone'"
          class="text-xs text-red-600 dark:text-red-400 leading-snug w-full min-w-0 break-words"
        >
          {{ saveHttpError }}
        </p>
      </div>
      <div
        v-else-if="layout === 'row'"
        :class="['editable-labeled-value__display flex-1 min-w-0 w-full min-h-8 flex items-center rounded px-2 -mx-2 -my-1 transition-colors', canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800']"
      >
        <div v-if="type === 'tags'" class="flex flex-wrap gap-1.5 min-w-0">
          <span
            v-for="(tag, index) in tagList"
            :key="`${tag}-${index}`"
            :style="getTagChipStyle ? getTagChipStyle(tag) : undefined"
            :class="['inline-block text-xs px-2 py-0.5 rounded', (getTagChipClass ? getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
          >
            {{ tag }}
          </span>
          <span v-if="tagList.length === 0" class="text-record-empty">—</span>
        </div>
        <slot v-else>
          <a
            v-if="type === 'url' && normalizedUrlHref && displayValue !== null && displayValue !== undefined && displayValue !== ''"
            :href="normalizedUrlHref"
            target="_blank"
            rel="noopener noreferrer"
            class="editable-labeled-value__text block truncate text-indigo-600 dark:text-indigo-400 hover:underline"
            @click.stop
          >
            {{ displayValue }}
          </a>
          <span v-else-if="displayValue !== null && displayValue !== undefined && displayValue !== ''" class="editable-labeled-value__text block truncate">{{ displayValue }}</span>
          <span v-else class="editable-labeled-value__text block truncate text-record-empty">—</span>
        </slot>
      </div>
    </div>
  </div>
  <!-- Stack layout: label above value -->
  <div v-else class="min-w-0">
    <dt :class="compact ? DRAWER_FIELD_LABEL_CLASS : 'text-sm text-gray-500 dark:text-gray-400'">
      {{ label }}
    </dt>
    <dd :class="compact ? '' : 'mt-2 text-sm text-gray-900 dark:text-white'">
      <!-- Select/User: Dropdown — compact pane uses HeadlessSelect (teleport); default stack uses Listbox -->
      <div v-if="canEdit && type === 'multi-select'" :class="compact ? 'w-full mt-1' : 'w-full'">
        <TagMultiPicklistField
          :model-value="multiSelectValue"
          :options="options"
          :field-key="fieldKey"
          :module-key="moduleKey"
          variant="form"
          :has-error="Boolean(saveHttpError)"
          :placeholder="t('records.editableSelectOption')"
          @update:model-value="handleMultiSelectChange"
        />
        <p v-if="saveHttpError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ saveHttpError }}</p>
      </div>
      <div v-else-if="canEdit && (type === 'select' || type === 'user' || type === 'entity')" class="w-full">
        <HeadlessSelect
          v-if="compact"
          :model-value="selectModelValue"
          :options="selectOptions"
          :allow-empty="allowEmpty || type === 'user' || type === 'entity'"
          :empty-label="type === 'user' ? t('records.editableUnassigned') : (type === 'entity' ? t('records.editableSelectOption') : (emptyLabel || t('records.editableSelectOption')))"
          :empty-value="null"
          :searchable="enablePicklistSearch"
          teleport
          wrapper-class="mt-1"
          :button-class="compactDrawerListboxClass"
          :invalid="!!saveHttpError"
          @update:model-value="handleSelectChange"
        />
        <div v-else :class="''">
          <Listbox
            v-slot="{ open }"
            :model-value="selectModelValue"
            @update:model-value="handleSelectChange"
            class="w-full"
          >
            <div class="relative w-full">
              <ListboxButton
              :class="[
                'editable-labeled-value__display w-full text-left transition-colors cursor-pointer rounded px-2 py-1 -mx-2 -my-1 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-0',
                saveHttpError ? 'ring-2 ring-red-500/80 ring-offset-1 dark:ring-offset-gray-900' : ''
              ]"
            >
            <slot>
              <span
                v-if="displayValue !== null && displayValue !== undefined && displayValue !== ''"
                class="editable-labeled-value__text block truncate"
              >{{ displayValue }}</span>
              <span v-else class="editable-labeled-value__text block truncate w-full text-record-empty">—</span>
            </slot>
          </ListboxButton>
          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              v-if="open"
              class="absolute left-0 top-full !bottom-auto z-10 mt-1 w-full max-w-[min(100vw,24rem)] min-w-[200px] max-h-72 flex flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <div
                v-if="showListboxSearch"
                class="shrink-0 p-2 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                @click.stop
                @mousedown.stop
              >
                <div class="relative">
                  <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    v-model="listboxSearchQuery"
                    type="text"
                    :placeholder="listboxSearchPlaceholder"
                    class="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    autocomplete="off"
                    @click.stop
                    @keydown.stop
                  />
                </div>
              </div>
              <div class="min-h-0 max-h-52 overflow-y-auto py-1">
                <ListboxOption v-if="allowEmpty || type === 'user' || type === 'entity'" :value="null" v-slot="{ active }">
                  <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                    <span :class="['editable-labeled-value__text block truncate', active ? '' : 'text-gray-500 dark:text-gray-400']">{{ type === 'user' ? t('records.editableUnassigned') : (type === 'entity' ? t('records.editableSelectOption') : (emptyLabel || t('records.editableSelectOption'))) }}</span>
                  </li>
                </ListboxOption>
                <ListboxOption
                  v-for="option in filteredSelectOptions"
                  :key="String(option.value)"
                  :value="option.value"
                  v-slot="{ active, selected }"
                >
                  <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                    <span :class="['editable-labeled-value__text block truncate', selected ? 'font-medium' : 'font-normal']">{{ option.label }}</span>
                    <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                      <CheckIcon class="h-5 w-5" aria-hidden="true" />
                    </span>
                  </li>
                </ListboxOption>
                <div
                  v-if="showListboxSearch && filteredSelectOptions.length === 0"
                  class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  {{ t('records.editableNoMatches') }}
                </div>
              </div>
            </ListboxOptions>
          </Transition>
            </div>
          </Listbox>
        </div>
        <p v-if="saveHttpError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ saveHttpError }}</p>
      </div>

      <div
        v-else-if="!canEdit && type === 'multi-select'"
        :class="[
          'editable-labeled-value__display',
          compact ? compactDrawerReadOnlyClass : ''
        ]"
      >
        <TagMultiPicklistField
          :model-value="multiSelectValue"
          :options="options"
          :field-key="fieldKey"
          :module-key="moduleKey"
          variant="form"
          disabled
          :placeholder="t('records.editableSelectOption')"
        />
      </div>

      <!-- Select/User read-only display -->
      <div
        v-else-if="!canEdit && (type === 'select' || type === 'user' || type === 'entity')"
        :class="[
          'editable-labeled-value__display',
          compact ? compactDrawerReadOnlyClass : ''
        ]"
      >
        <slot>
          <span v-if="displayValue !== null && displayValue !== undefined && displayValue !== ''" class="block truncate">{{ displayValue }}</span>
          <span v-else class="block truncate w-full text-record-empty">—</span>
        </slot>
      </div>

      <!-- Compact pane: drawer-matched controls (display + edit share classes — no layout shift) -->
      <div v-else-if="compact && canEdit">
        <PeopleFirstNameWithSalutationField
          v-if="peopleFirstNameWithSalutation && (type === 'text' || type === 'url') && !multiline"
          class="mt-1"
          :first-name="String(localValue ?? '')"
          :salutation="String(localSalutation ?? '')"
          :salutation-options="salutationOptions"
          :invalid="Boolean(saveHttpError)"
          :first-name-placeholder="t('people.sysFieldFirstName')"
          @update:first-name="onFirstNameFieldUpdate"
          @update:salutation="onSalutationFieldUpdate"
          @blur="handleBlur"
        />
        <PhoneInput
          v-else-if="type === 'phone' && isEditing"
          ref="inputRef"
          class="mt-1"
          :model-value="localValue"
          :default-country="defaultPhoneCountry"
          :placeholder="t('records.editablePhonePh')"
          :invalid="Boolean(phoneError || saveHttpError)"
          :input-class="formPhoneInputClass"
          @update:model-value="onPhoneInput"
          @blur="handleBlur"
          @enter="handleBlur"
          @escape="handleCancel"
        />
        <input
          v-else-if="isEditing && (type === 'text' || type === 'url') && !multiline && !peopleFirstNameWithSalutation"
          ref="inputRef"
          v-model="localValue"
          @blur="handleBlur"
          @keydown.enter="handleBlur"
          @keydown.esc="handleCancel"
          :class="compactDrawerControlClass"
          type="text"
        />
        <textarea
          v-else-if="isEditing && type === 'text' && multiline"
          ref="inputRef"
          v-model="localValue"
          @blur="handleBlur"
          @keydown.esc="handleCancel"
          :class="compactDrawerTextareaClass"
          :rows="rows || 4"
        />
        <input
          v-else-if="isEditing && type === 'number'"
          ref="inputRef"
          v-model.number="localValue"
          @blur="handleBlur"
          @keydown.enter="handleBlur"
          @keydown.esc="handleCancel"
          :class="compactDrawerControlClass"
          type="number"
          :min="min"
          :max="max"
          :step="step"
        />
        <DatePicker
          v-else-if="isEditing && type === 'date'"
          ref="inputRef"
          v-model="localValue"
          :invalid="Boolean(saveHttpError)"
          :input-class="[compactDrawerControlClass, 'cursor-pointer'].join(' ')"
          @blur="handleBlur"
          @escape="handleCancel"
        />
        <div
          v-else
          :class="compactDrawerDisplayClass"
          @click="handleClick($event)"
        >
          <div v-if="type === 'tags'" class="flex flex-wrap gap-1.5">
            <span
              v-for="(tag, index) in tagList"
              :key="`${tag}-${index}`"
              :style="getTagChipStyle ? getTagChipStyle(tag) : undefined"
            :class="['inline-block text-xs px-2 py-0.5 rounded', (getTagChipClass ? getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
            >
              {{ tag }}
            </span>
            <span v-if="tagList.length === 0" class="text-record-empty">—</span>
          </div>
          <slot v-else>
            <a
              v-if="type === 'url' && normalizedUrlHref && displayValue !== null && displayValue !== undefined && displayValue !== ''"
              :href="normalizedUrlHref"
              target="_blank"
              rel="noopener noreferrer"
              :class="multiline ? 'block max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-indigo-600 dark:text-indigo-400 hover:underline' : 'block truncate text-indigo-600 dark:text-indigo-400 hover:underline'"
              @click.stop
            >{{ displayValue }}</a>
            <span
              v-else-if="displayValue !== null && displayValue !== undefined && displayValue !== ''"
              :class="multiline ? 'block max-h-48 overflow-y-auto whitespace-pre-wrap break-words' : 'block truncate'"
            >{{ displayValue }}</span>
            <span v-else class="block w-full truncate text-record-empty">—</span>
          </slot>
        </div>
        <p v-if="phoneError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ phoneError }}</p>
        <p v-else-if="saveHttpError && type !== 'phone'" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ saveHttpError }}</p>
      </div>

      <!-- Compact read-only text/url/phone/number/date/tags -->
      <div
        v-else-if="compact && !canEdit"
        :class="compactDrawerReadOnlyClass"
      >
        <div v-if="type === 'tags' || type === 'multi-select'" class="flex flex-wrap gap-1.5">
          <TagMultiPicklistField
            v-if="type === 'multi-select'"
            :model-value="multiSelectValue"
            :options="options"
            :field-key="fieldKey"
            :module-key="moduleKey"
            variant="form"
            disabled
            :placeholder="t('records.editableSelectOption')"
          />
          <template v-else>
            <span
              v-for="(tag, index) in tagList"
              :key="`${tag}-${index}`"
              :style="getTagChipStyle ? getTagChipStyle(tag) : undefined"
              :class="['inline-block text-xs px-2 py-0.5 rounded', (getTagChipClass ? getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
            >
              {{ tag }}
            </span>
          </template>
          <span v-if="type === 'tags' && tagList.length === 0" class="text-record-empty">—</span>
        </div>
        <slot v-else>
          <a
            v-if="type === 'url' && normalizedUrlHref && displayValue !== null && displayValue !== undefined && displayValue !== ''"
            :href="normalizedUrlHref"
            target="_blank"
            rel="noopener noreferrer"
            :class="multiline ? 'block max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-indigo-600 dark:text-indigo-400 hover:underline' : 'block truncate text-indigo-600 dark:text-indigo-400 hover:underline'"
            @click.stop
          >{{ displayValue }}</a>
          <span
            v-else-if="displayValue !== null && displayValue !== undefined && displayValue !== ''"
            :class="multiline ? 'block max-h-48 overflow-y-auto whitespace-pre-wrap break-words' : 'block truncate'"
          >{{ displayValue }}</span>
          <span v-else class="block w-full truncate text-record-empty">—</span>
        </slot>
      </div>

      <!-- Editable mode for text/url/phone/number/date (non-compact) -->
      <div v-else-if="isEditing && canEdit" class="editable-labeled-value__edit">
        <div v-if="type === 'phone'" class="flex flex-col w-full">
          <PhoneInput
            ref="inputRef"
            :model-value="localValue"
            :default-country="defaultPhoneCountry"
            :placeholder="t('records.editablePhonePh')"
            :invalid="Boolean(phoneError || saveHttpError)"
            :editor-height-class="compact ? '' : 'h-8'"
            :input-class="stackSingleLineEditInputClass"
            @update:model-value="onPhoneInput"
            @blur="handleBlur"
            @enter="handleBlur"
            @escape="handleCancel"
          />
          <p v-if="phoneError" class="mt-1 text-xs text-red-600 dark:text-red-400 leading-snug">{{ phoneError }}</p>
          <p v-else-if="saveHttpError" class="mt-1 text-xs text-red-600 dark:text-red-400 leading-snug">{{ saveHttpError }}</p>
        </div>
        <PeopleFirstNameWithSalutationField
          v-else-if="peopleFirstNameWithSalutation && (type === 'text' || type === 'url') && !multiline"
          :first-name="String(localValue ?? '')"
          :salutation="String(localSalutation ?? '')"
          :salutation-options="salutationOptions"
          :invalid="Boolean(saveHttpError)"
          :first-name-placeholder="t('people.sysFieldFirstName')"
          @update:first-name="onFirstNameFieldUpdate"
          @update:salutation="onSalutationFieldUpdate"
          @blur="handleBlur"
          @keydown.esc="handleCancel"
        />
        <!-- Text input -->
        <input
          v-else-if="(type === 'text' || type === 'url') && !multiline && !peopleFirstNameWithSalutation"
          ref="inputRef"
          v-model="localValue"
          @blur="handleBlur"
          @keydown.enter="handleBlur"
          @keydown.esc="handleCancel"
          :class="stackSingleLineEditInputClass"
          type="text"
        />
        
        <!-- Textarea -->
        <textarea
          v-else-if="type === 'text' && multiline"
          ref="inputRef"
          v-model="localValue"
          @blur="handleBlur"
          @keydown.esc="handleCancel"
          :class="stackMultilineEditInputClass"
          :rows="rows"
        ></textarea>
        
        <!-- Number input -->
        <input
          v-else-if="type === 'number'"
          ref="inputRef"
          v-model.number="localValue"
          @blur="handleBlur"
          @keydown.enter="handleBlur"
          @keydown.esc="handleCancel"
          :class="stackSingleLineEditInputClass"
          type="number"
          :min="min"
          :max="max"
          :step="step"
        />
        
        <!-- Date input -->
        <DatePicker
          v-else-if="type === 'date'"
          ref="inputRef"
          v-model="localValue"
          :invalid="Boolean(saveHttpError)"
          :input-class="[stackSingleLineEditInputClass, 'cursor-pointer'].join(' ')"
          @blur="handleBlur"
          @escape="handleCancel"
        />
        <p
          v-if="saveHttpError && type !== 'phone'"
          class="mt-1 text-xs text-red-600 dark:text-red-400 leading-snug"
        >
          {{ saveHttpError }}
        </p>
      </div>
      
      <!-- Display mode for text/number/date/tags -->
      <div
        v-else
        @click="handleClick($event)"
        :class="stackDisplayModeClass"
      >
        <div v-if="type === 'tags' || type === 'multi-select'" class="flex flex-wrap gap-1.5">
          <TagMultiPicklistField
            v-if="type === 'multi-select'"
            :model-value="multiSelectValue"
            :options="options"
            :field-key="fieldKey"
            :module-key="moduleKey"
            variant="form"
            disabled
            :placeholder="t('records.editableSelectOption')"
          />
          <template v-else>
            <span
              v-for="(tag, index) in tagList"
              :key="`${tag}-${index}`"
              :style="getTagChipStyle ? getTagChipStyle(tag) : undefined"
              :class="['inline-block text-xs px-2 py-0.5 rounded', (getTagChipClass ? getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
            >
              {{ tag }}
            </span>
          </template>
          <span v-if="type === 'tags' && tagList.length === 0" class="text-record-empty">—</span>
        </div>
        <slot v-else>
          <a
            v-if="type === 'url' && normalizedUrlHref && displayValue !== null && displayValue !== undefined && displayValue !== ''"
            :href="normalizedUrlHref"
            target="_blank"
            rel="noopener noreferrer"
            :class="
              compact && multiline
                ? 'block max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-indigo-600 dark:text-indigo-400 hover:underline'
                : 'editable-labeled-value__text block truncate text-indigo-600 dark:text-indigo-400 hover:underline'
            "
            @click.stop
          >{{ displayValue }}</a>
          <span
            v-else-if="displayValue !== null && displayValue !== undefined && displayValue !== ''"
            :class="
              compact && multiline
                ? 'block max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100'
                : 'editable-labeled-value__text block truncate'
            "
          >{{ displayValue }}</span>
          <span v-else class="editable-labeled-value__text block w-full truncate text-record-empty">—</span>
        </slot>
      </div>
    </dd>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const { t } = useI18n();
import {
  CheckIcon,
  ChevronUpDownIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  DevicePhoneMobileIcon,
  MagnifyingGlassIcon,
  TagIcon,
  UserIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import Avatar from '@/components/common/Avatar.vue';
import PhoneInput from '@/components/common/PhoneInput.vue';
import TagMultiPicklistField from '@/components/common/TagMultiPicklistField.vue';
import { useDefaultPhoneCountry } from '@/composables/useDefaultPhoneCountry';
import PeopleFirstNameWithSalutationField from '@/components/people/PeopleFirstNameWithSalutationField.vue';
import DatePicker from '@/components/common/DatePicker.vue';
import { sanitizeInternationalPhone, validatePhoneValue } from '@/utils/phoneInput';
import { getApiErrorMessage } from '@/utils/httpErrors';

import {
  FORM_FIELD_CONTROL_CLASS,
  FORM_FIELD_INVALID_CLASS,
  FORM_FIELD_LABEL_CLASS,
  FORM_FIELD_LISTBOX_CLASS,
  FORM_FIELD_PHONE_INPUT_CLASS,
  FORM_FIELD_READ_ONLY_CLASS,
  joinFormFieldClasses,
} from '@/utils/formFieldControlClasses';

/** Match DynamicFormField / quick create drawer — keep in sync via formFieldControlClasses. */
const DRAWER_FIELD_LABEL_CLASS = FORM_FIELD_LABEL_CLASS;
const DRAWER_FIELD_CONTROL_CLASS = `mt-1 ${FORM_FIELD_CONTROL_CLASS}`;
const DRAWER_FIELD_TEXTAREA_CLASS = `${DRAWER_FIELD_CONTROL_CLASS} resize-none`;
const DRAWER_FIELD_READ_ONLY_DISPLAY_CLASS = `mt-1 ${FORM_FIELD_READ_ONLY_CLASS}`;
const DRAWER_FIELD_LISTBOX_CLASS = FORM_FIELD_LISTBOX_CLASS;

function joinDrawerFieldClasses(...parts) {
  return joinFormFieldClasses(...parts);
}

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number, Object, Array, Boolean, null],
    default: null
  },
  type: {
    type: String,
    default: 'text', // 'text', 'number', 'date', 'select', 'user', 'entity', 'tags', 'multi-select'
    validator: (value) => ['text', 'url', 'phone', 'number', 'date', 'select', 'user', 'entity', 'tags', 'multi-select'].includes(value)
  },
  multiline: {
    type: Boolean,
    default: false
  },
  rows: {
    type: Number,
    default: 3
  },
  canEdit: {
    type: Boolean,
    default: true
  },
  // For select type
  options: {
    type: Array,
    default: () => []
  },
  allowEmpty: {
    type: Boolean,
    default: true
  },
  emptyLabel: {
    type: String,
    default: '—'
  },
  // For number type
  min: {
    type: Number,
    default: undefined
  },
  max: {
    type: Number,
    default: undefined
  },
  step: {
    type: Number,
    default: 1
  },
  // For user type - users list
  users: {
    type: Array,
    default: () => []
  },
  // Format function for display value
  formatValue: {
    type: Function,
    default: null
  },
  /** For type 'tags': optional (tagName) => string of chip Tailwind classes */
  getTagChipClass: {
    type: Function,
    default: null
  },
  /** For type 'tags': optional (tagName) => inline style object (e.g. picklist badge colors) */
  getTagChipStyle: {
    type: Function,
    default: null
  },
  /** When set (e.g. record tag popover), click opens full tag UI instead of inline edit */
  onTagsOpen: {
    type: Function,
    default: null
  },
  /** 'stack' = label above value; 'row' = icon + label left, value right (Core Fields style) */
  layout: {
    type: String,
    default: 'stack',
    validator: (v) => ['stack', 'row'].includes(v)
  },
  /** Dense label + value (stack layout): for narrow panes / sidebars */
  compact: {
    type: Boolean,
    default: false
  },
  rowPaddingClass: {
    type: String,
    default: 'py-2 px-4 min-h-[2rem]'
  },
  /** ISO country on the parent record — overrides org default for phone fields */
  recordCountry: {
    type: String,
    default: ''
  },
  fieldKey: {
    type: String,
    default: ''
  },
  moduleKey: {
    type: String,
    default: ''
  },
  prefixIcon: {
    type: [Object, Function],
    default: null
  },
  /** Linked record path — when set with onOpenRecord, entity display value opens the record. */
  recordPath: {
    type: String,
    default: ''
  },
  onOpenRecord: {
    type: Function,
    default: null
  },
  /**
   * When set, called instead of relying on a fire-and-forget @save handler.
   * Must return a Promise; on failure the field stays in edit mode and shows the error.
   */
  commitSave: {
    type: Function,
    default: null
  },
  peopleFirstNameWithSalutation: {
    type: Boolean,
    default: false
  },
  salutationValue: {
    type: String,
    default: ''
  },
  salutationOptions: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:value', 'save']);

const { defaultPhoneCountry } = useDefaultPhoneCountry(
  computed(() => (props.recordCountry ? { country: props.recordCountry } : null))
);

const fieldIcon = computed(() => {
  if (props.prefixIcon) return props.prefixIcon;
  const map = {
    number: CurrencyDollarIcon,
    date: CalendarDaysIcon,
    text: DocumentTextIcon,
    phone: DevicePhoneMobileIcon,
    select: TagIcon,
    'multi-select': TagIcon,
    user: UserIcon
  };
  return map[props.type] || DocumentTextIcon;
});

/** Stack layout, display mode (not editing): compact pane vs default hover row */
const stackDisplayModeClass = computed(() => {
  const classes = ['editable-labeled-value__display'];
  if (props.compact) {
    return classes;
  }
  if (props.canEdit) {
    classes.push(
      (props.type === 'tags' && props.onTagsOpen ? 'cursor-pointer' : 'cursor-text') +
        ' hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors'
    );
  }
  return classes;
});

const isEditing = ref(false);
const localValue = ref(null);
const localSalutation = ref('');
const inputRef = ref(null);
const users = ref(props.users || []);
/** Filters select/user/entity Listbox options (inline record details). */
const listboxSearchQuery = ref('');
/** Inline error for phone (incomplete digits on blur) */
const phoneError = ref(null);
/** Server / validation error after commitSave fails */
const saveHttpError = ref(null);

/** Right-pane Details tab — DynamicFormField / quick create drawer control classes. */
const compactDrawerControlClass = computed(() => {
  const hasErr = Boolean(saveHttpError.value || (props.type === 'phone' && phoneError.value));
  return joinDrawerFieldClasses(
    DRAWER_FIELD_CONTROL_CLASS,
    hasErr && 'border border-red-500 dark:border-red-500'
  );
});

const compactDrawerTextareaClass = computed(() => {
  const hasErr = Boolean(saveHttpError.value);
  return joinDrawerFieldClasses(
    DRAWER_FIELD_TEXTAREA_CLASS,
    hasErr && 'border border-red-500 dark:border-red-500'
  );
});

const compactDrawerListboxClass = computed(() => {
  const hasErr = Boolean(saveHttpError.value);
  return joinDrawerFieldClasses(
    DRAWER_FIELD_LISTBOX_CLASS,
    hasErr && 'border border-red-500 dark:border-red-500'
  );
});

const compactDrawerReadOnlyClass = computed(() => DRAWER_FIELD_READ_ONLY_DISPLAY_CLASS);

const compactDrawerDisplayClass = computed(() => {
  const clickable =
    props.type === 'tags' && typeof props.onTagsOpen === 'function' ? 'cursor-pointer' : 'cursor-text';
  return joinDrawerFieldClasses(compactDrawerControlClass.value, clickable);
});

const isValidObjectId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

/** Matches DynamicFormField / quick create drawer phone control styling. */
const formPhoneInputClass = computed(() => {
  const hasErr = phoneError.value || saveHttpError.value;
  return joinDrawerFieldClasses(
    FORM_FIELD_PHONE_INPUT_CLASS,
    hasErr && FORM_FIELD_INVALID_CLASS
  );
});

/**
 * Stack layout inline edit (non-compact pane only).
 */
const stackSingleLineEditInputClass = computed(() => {
  const baseFocus =
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const hasErr = saveHttpError.value || (props.type === 'phone' && phoneError.value);
  const borderClass = hasErr
    ? 'border-red-500 dark:border-red-500'
    : 'border-gray-300 dark:border-gray-600';
  return `w-full px-2 py-1 text-sm border rounded ${borderClass} ${baseFocus}`;
});

const stackMultilineEditInputClass = computed(() => {
  const baseFocus =
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y min-h-[80px]';
  const borderClass = saveHttpError.value
    ? 'border-red-500 dark:border-red-500'
    : 'border-gray-300 dark:border-gray-600';
  return `w-full px-2 py-1 text-sm border rounded ${borderClass} ${baseFocus}`;
});

// Fetch users if type is 'user' and users not provided
onMounted(async () => {
  if (props.type === 'user' && (!props.users || props.users.length === 0)) {
    try {
      const response = await apiClient.get('/users/list');
      if (response.success && Array.isArray(response.data)) {
        users.value = response.data.filter((u) => isValidObjectId(String(u?._id || '')));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  } else if (props.users && props.users.length > 0) {
    users.value = props.users;
  }
});

// Initialize local value based on type
const initializeLocalValue = () => {
  if (props.type === 'date' && props.value) {
    // Convert date to YYYY-MM-DD format for date input
    const date = new Date(props.value);
    if (!isNaN(date.getTime())) {
      localValue.value = date.toISOString().split('T')[0];
    } else {
      localValue.value = props.value;
    }
  } else if (props.type === 'user') {
    // Extract user ID if value is an object
    if (props.value && typeof props.value === 'object' && props.value._id) {
      localValue.value = props.value._id;
    } else if (props.value) {
      localValue.value = props.value;
    } else {
      localValue.value = null;
    }
  } else if (props.type === 'phone') {
    localValue.value = sanitizeInternationalPhone(props.value == null ? '' : String(props.value), defaultPhoneCountry.value);
  } else if (props.type === 'multi-select') {
    localValue.value = normalizeMultiSelectValue(props.value);
  } else {
    localValue.value = props.value;
  }
  localSalutation.value = props.salutationValue ? String(props.salutationValue) : '';
};

// Initialize on mount
initializeLocalValue();

watch(() => props.value, () => {
  if (!isEditing.value || isPeopleFirstNameInlineEditor.value) {
    phoneError.value = null;
    saveHttpError.value = null;
    initializeLocalValue();
  }
});

watch(() => props.salutationValue, () => {
  if (!isEditing.value || isPeopleFirstNameInlineEditor.value) {
    localSalutation.value = props.salutationValue ? String(props.salutationValue) : '';
  }
});

function buildCommitValue() {
  if (props.peopleFirstNameWithSalutation) {
    return {
      firstName: String(localValue.value ?? '').trim(),
      salutation: localSalutation.value ? String(localSalutation.value).trim() : null,
    };
  }
  return localValue.value;
}

const isPeopleFirstNameInlineEditor = computed(() =>
  props.compact === true
  && props.canEdit === true
  && props.peopleFirstNameWithSalutation === true
  && (props.type === 'text' || props.type === 'url')
  && !props.multiline
);

function onFirstNameFieldUpdate(value) {
  localValue.value = value == null ? '' : String(value);
}

async function onSalutationFieldUpdate(value) {
  localSalutation.value = value == null || value === '' ? '' : String(value);
  await nextTick();
  await commitPeopleFirstNameSave();
}

async function commitPeopleFirstNameSave() {
  if (!props.peopleFirstNameWithSalutation) return;

  const valueToSave = buildCommitValue();
  if (!hasPendingChanges(valueToSave)) {
    return;
  }

  if (typeof props.commitSave === 'function') {
    saveHttpError.value = null;
    try {
      await props.commitSave(valueToSave);
      emit('update:value', valueToSave.firstName);
      emit('save', valueToSave);
      if (!isPeopleFirstNameInlineEditor.value) {
        isEditing.value = false;
      }
    } catch (e) {
      saveHttpError.value = getApiErrorMessage(e);
      if (!isPeopleFirstNameInlineEditor.value) {
        await nextTick();
        inputRef.value?.focus?.({ preventScroll: true });
      }
    }
    return;
  }

  emit('update:value', valueToSave.firstName);
  emit('save', valueToSave);
  if (!isPeopleFirstNameInlineEditor.value) {
    isEditing.value = false;
  }
}

function hasPendingChanges(valueToSave) {
  if (props.peopleFirstNameWithSalutation) {
    const payload = typeof valueToSave === 'object' && valueToSave != null
      ? valueToSave
      : buildCommitValue();
    const currentSal = props.salutationValue ? String(props.salutationValue).trim() : '';
    const nextSal = payload.salutation ? String(payload.salutation).trim() : '';
    return String(payload.firstName ?? '').trim() !== String(props.value ?? '').trim() || nextSal !== currentSal;
  }
  return valueToSave !== props.value;
}

function getEntityOrPeopleRecordLabel(val) {
  if (val == null) return null;
  if (typeof val === 'object') {
    if (val.name) return String(val.name).trim() || null;
    const first = val.firstName ?? val.first_name;
    const last = val.lastName ?? val.last_name;
    const n = [first, last].filter(Boolean).join(' ').trim();
    if (n) return n;
    if (val.email) return String(val.email);
    if (val.label) return String(val.label);
  }
  return null;
}

const displayValue = computed(() => {
  if (!['user', 'entity', 'select', 'tags', 'multi-select'].includes(props.type) && props.formatValue) {
    return props.formatValue(props.value);
  }
  
  if (props.type === 'user' && props.value) {
    if (typeof props.value === 'object') {
      return getUserDisplayName(props.value);
    }
    const id = String(props.value);
    const user = users.value.find(u => String(u._id) === id);
    if (user) {
      return getUserDisplayName(user);
    }
    const fromOptions = (props.options || []).find((o) => {
      const v = o?.value ?? o?._id ?? o?.id;
      return v != null && String(v) === id;
    });
    if (fromOptions) {
      return fromOptions.label ?? fromOptions.name ?? getUserDisplayName(fromOptions) ?? id;
    }
    return props.value;
  }

  if (props.type === 'entity' && props.value) {
    const fromObj = getEntityOrPeopleRecordLabel(props.value);
    if (fromObj) return fromObj;
    if (typeof props.value === 'string' || typeof props.value === 'number') {
      const id = String(props.value);
      const rawOpts = props.options || [];
      const found = rawOpts.find((o) => {
        const v = o?.value ?? o?._id ?? o?.id;
        return v != null && String(v) === id;
      });
      if (found) {
        return found.label ?? found.name ?? getEntityOrPeopleRecordLabel(found) ?? id;
      }
    }
    if (typeof props.value === 'object') {
      return getEntityOrPeopleRecordLabel(props.value) ?? String(props.value);
    }
    return String(props.value);
  }

  if (props.type === 'multi-select') {
    const values = multiSelectValue.value;
    if (!values.length) return null;
    return values.map((item) => {
      const id = item != null && typeof item === 'object' ? (item.value ?? item.label ?? item.name) : item;
      const match = (props.options || []).find((opt) => {
        const optId = opt?.value ?? opt?._id ?? opt?.id;
        return optId != null && String(optId) === String(id);
      });
      return match?.label ?? String(id ?? '');
    }).filter(Boolean).join(', ');
  }

  if (props.type === 'select' && props.value != null && props.value !== '') {
    const rawId = typeof props.value === 'object'
      ? (props.value.value ?? props.value._id ?? props.value.id ?? props.value)
      : props.value;
    const match = (props.options || []).find((opt) => {
      const optId = opt?.value ?? opt?._id ?? opt?.id;
      return optId != null && String(optId) === String(rawId);
    });
    if (match) return match.label ?? match.name ?? String(rawId);
    return String(rawId);
  }
  
  return props.value;
});

const selectedUserForAvatar = computed(() => {
  if (props.type !== 'user' || !props.value) return null;
  if (typeof props.value === 'object') {
    return {
      firstName: props.value.firstName || props.value.first_name,
      lastName: props.value.lastName || props.value.last_name,
      email: props.value.email,
      avatar: props.value.avatar,
      name: props.value.name,
    };
  }
  const id = String(props.value);
  const fromUsers = (users.value || []).find((u) => String(u?._id ?? u?.id) === id);
  if (fromUsers) return fromUsers;
  const fromOptions = (props.options || []).find((o) => {
    const v = o?.value ?? o?._id ?? o?.id;
    return v != null && String(v) === id;
  });
  if (!fromOptions) return null;
  return {
    _id: fromOptions.value ?? fromOptions._id,
    firstName: fromOptions.firstName ?? fromOptions.first_name,
    lastName: fromOptions.lastName ?? fromOptions.last_name,
    email: fromOptions.email,
    avatar: fromOptions.avatar,
    name: fromOptions.label ?? fromOptions.name,
  };
});

const hasDisplayValue = computed(() => {
  if (props.type === 'multi-select') return multiSelectValue.value.length > 0;
  if (props.type === 'tags') return tagList.value.length > 0;
  const v = displayValue.value;
  return v !== null && v !== undefined && v !== '';
});

const normalizedUrlHref = computed(() => {
  if (props.type !== 'url') return null;
  const raw = displayValue.value == null ? '' : String(displayValue.value).trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
});

/** When true, the whole value cell is clickable to enter edit (row layout, text/number/date/tags, not editing). */
const isValueCellClickable = computed(() => {
  if (props.layout !== 'row' || !props.canEdit || isEditing.value) return false;
  if (props.layout === 'row' && props.type === 'phone') return false;
  if (props.type === 'multi-select') return false;
  if (props.type === 'tags' && typeof props.onTagsOpen === 'function') return true;
  return ['text', 'url', 'number', 'date', 'tags'].includes(props.type);
});

const onValueCellClick = (event) => {
  if (isValueCellClickable.value) handleClick(event);
};

const tagList = computed(() => {
  if (props.type !== 'tags') return [];
  const v = props.value;
  if (Array.isArray(v)) {
    return v.map((item) => (item != null && typeof item === 'object' ? (item.name || item.label || item.title) : String(item))).filter(Boolean);
  }
  return [];
});

function normalizeMultiSelectValue(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.map((item) => (item != null && typeof item === 'object' ? (item.value ?? item.label ?? item.name ?? item) : item)).filter((item) => item != null && String(item).trim() !== '');
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeMultiSelectValue(parsed);
      } catch {
        // fall through
      }
    }
    return trimmed ? [trimmed] : [];
  }
  return [value];
}

const multiSelectValue = computed(() => normalizeMultiSelectValue(props.value));

function multiSelectValuesEqual(a, b) {
  const left = normalizeMultiSelectValue(a).map(String).sort();
  const right = normalizeMultiSelectValue(b).map(String).sort();
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

const handleMultiSelectChange = async (value) => {
  const next = normalizeMultiSelectValue(value);
  if (multiSelectValuesEqual(next, props.value)) return;
  saveHttpError.value = null;
  if (typeof props.commitSave === 'function') {
    try {
      await props.commitSave(next);
      emit('update:value', next);
      emit('save', next);
    } catch (e) {
      saveHttpError.value = getApiErrorMessage(e);
    }
    return;
  }
  emit('update:value', next);
  emit('save', next);
};

// For select/user/entity Listbox: model value
const selectModelValue = computed(() => {
  if (props.type === 'user' || props.type === 'entity') {
    if (props.value && typeof props.value === 'object' && (props.value._id || props.value.id)) {
      return props.value._id || props.value.id;
    }
    return props.value || null;
  }
  return props.value;
});

// For select/user/entity Listbox: options array
const selectOptions = computed(() => {
  if (props.type === 'select') return props.options || [];
  if (props.type === 'entity') {
    const raw = props.options || [];
    const base = raw.map((o) => {
      if (o && typeof o === 'object' && 'value' in o && 'label' in o) return { value: o.value, label: o.label };
      const id = o?._id ?? o?.id ?? o?.value;
      const label = o?.label ?? o?.name ?? getEntityOrPeopleRecordLabel(o) ?? (id != null ? String(id) : '—');
      return { value: id, label };
    });
    const selectedId = selectModelValue.value;
    if (
      selectedId != null &&
      isValidObjectId(String(selectedId)) &&
      !base.some((opt) => String(opt.value) === String(selectedId))
    ) {
      const fallbackLabel = getEntityOrPeopleRecordLabel(props.value) || 'Unknown record';
      base.unshift({ value: selectedId, label: fallbackLabel });
    }
    return base;
  }
  if (props.type === 'user') {
    const optionUsers = (props.options || []).map((o) => {
      if (o && typeof o === 'object' && 'value' in o) {
        return {
          _id: o.value,
          firstName: o.firstName ?? o.first_name,
          lastName: o.lastName ?? o.last_name,
          email: o.email,
          name: o.label ?? o.name,
        };
      }
      return o;
    });
    const mergedUsers = [...(users.value || [])];
    for (const u of optionUsers) {
      const id = u?._id ?? u?.id;
      if (id != null && !mergedUsers.some((existing) => String(existing?._id ?? existing?.id) === String(id))) {
        mergedUsers.push(u);
      }
    }
    const mapped = mergedUsers.map(u => ({
      value: u._id ?? u.id,
      label: getUserDisplayName(u)
    }));
    const selectedId = selectModelValue.value;
    if (
      selectedId != null &&
      isValidObjectId(String(selectedId)) &&
      !mapped.some((opt) => String(opt.value) === String(selectedId))
    ) {
      const fallbackLabel = typeof props.value === 'object'
        ? getUserDisplayName(props.value)
        : String(props.value);
      mapped.unshift({ value: selectedId, label: fallbackLabel || t('records.editableUnknownUser') });
    }
    return mapped;
  }
  return [];
});

const enablePicklistSearch = computed(() => {
  const count = selectOptions.value?.length || 0;
  if (count === 0) return false;
  if (props.type === 'entity') return true;
  return count > 6;
});

const canOpenLinkedRecord = computed(
  () => Boolean(props.recordPath) && typeof props.onOpenRecord === 'function'
);

function onLinkedRecordClick(e) {
  if (!canOpenLinkedRecord.value) return;
  e?.stopPropagation?.();
  props.onOpenRecord();
}

const showListboxSearch = computed(
  () =>
    (props.type === 'select' || props.type === 'user' || props.type === 'entity') &&
    enablePicklistSearch.value
);

const listboxSearchPlaceholder = computed(() => t('records.editableListboxSearchPh'));

const filteredSelectOptions = computed(() => {
  const opts = selectOptions.value || [];
  const q = listboxSearchQuery.value.trim().toLowerCase();
  if (!q) return opts;
  return opts.filter((o) => {
    const label = String(o.label ?? '').toLowerCase();
    const val = String(o.value ?? '');
    return label.includes(q) || val.toLowerCase().includes(q);
  });
});

const handleSelectChange = async (value) => {
  listboxSearchQuery.value = '';
  if (value === props.value || (props.type === 'user' && value === (props.value?._id ?? props.value))) {
    return;
  }
  saveHttpError.value = null;
  if (typeof props.commitSave === 'function') {
    try {
      await props.commitSave(value);
      emit('update:value', value);
      emit('save', value);
    } catch (e) {
      saveHttpError.value = getApiErrorMessage(e);
    }
    return;
  }
  emit('update:value', value);
  emit('save', value);
};

const getUserDisplayName = (user) => {
  if (!user) return t('records.editableUnassigned');
  const name = [user.firstName || user.first_name, user.lastName || user.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || user.username || user.email || user._id || 'Unknown';
};

const handleClick = (event) => {
  if (!props.canEdit) return;
  if (props.type === 'tags' && typeof props.onTagsOpen === 'function') {
    props.onTagsOpen(event);
    return;
  }
  isEditing.value = true;
  phoneError.value = null;
  saveHttpError.value = null;
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus({ preventScroll: true });
      if (props.type === 'text' || props.type === 'url' || props.type === 'number') {
        inputRef.value.select();
      } else if (props.type === 'date') {
        inputRef.value?.open?.();
      } else if (props.type === 'phone') {
        inputRef.value?.select?.();
      }
    }
  });
};

function onPhoneInput(value) {
  phoneError.value = null;
  saveHttpError.value = null;
  localValue.value = sanitizeInternationalPhone(value == null ? '' : String(value), defaultPhoneCountry.value);
}

async function savePhoneValue() {
  let valueToSave = localValue.value;
  valueToSave = sanitizeInternationalPhone(valueToSave == null ? '' : String(valueToSave), defaultPhoneCountry.value);
  localValue.value = valueToSave;
  const phoneValidation = validatePhoneValue(valueToSave, defaultPhoneCountry.value);
  if (!phoneValidation.isValid) {
    phoneError.value = phoneValidation.error;
    return false;
  }
  phoneError.value = null;

  if (valueToSave === props.value) {
    return true;
  }

  if (typeof props.commitSave === 'function') {
    saveHttpError.value = null;
    try {
      await props.commitSave(valueToSave);
      emit('update:value', valueToSave);
      emit('save', valueToSave);
      return true;
    } catch (e) {
      saveHttpError.value = getApiErrorMessage(e);
      return false;
    }
  }

  emit('update:value', valueToSave);
  emit('save', valueToSave);
  return true;
}

const handlePhoneRowBlur = async () => {
  await savePhoneValue();
};

const handlePhoneRowCancel = () => {
  phoneError.value = null;
  saveHttpError.value = null;
  initializeLocalValue();
};

const handleBlur = async () => {
  if (props.peopleFirstNameWithSalutation) {
    if (!isEditing.value && !isPeopleFirstNameInlineEditor.value) return;
    await commitPeopleFirstNameSave();
    return;
  }

  if (!isEditing.value) return;

  let valueToSave = localValue.value;
  if (props.type === 'phone') {
    valueToSave = sanitizeInternationalPhone(valueToSave == null ? '' : String(valueToSave), defaultPhoneCountry.value);
    localValue.value = valueToSave;
    const phoneValidation = validatePhoneValue(valueToSave, defaultPhoneCountry.value);
    if (!phoneValidation.isValid) {
      phoneError.value = phoneValidation.error;
      return;
    }
    phoneError.value = null;
  }

  // Convert date back to ISO string if needed
  if (props.type === 'date' && valueToSave) {
    const date = new Date(valueToSave + 'T00:00:00');
    valueToSave = date.toISOString();
  }

  if (hasPendingChanges(valueToSave)) {
    if (typeof props.commitSave === 'function') {
      saveHttpError.value = null;
      try {
        await props.commitSave(valueToSave);
        emit('update:value', valueToSave);
        emit('save', valueToSave);
        isEditing.value = false;
      } catch (e) {
        saveHttpError.value = getApiErrorMessage(e);
        // Keep localValue as typed — do not reset from props or the invalid input disappears
        await nextTick();
        if (inputRef.value) inputRef.value.focus?.({ preventScroll: true });
      }
      return;
    }
    emit('update:value', valueToSave);
    emit('save', valueToSave);
  } else {
    initializeLocalValue();
  }

  isEditing.value = false;
};

const handleCancel = () => {
  isEditing.value = false;
  phoneError.value = null;
  saveHttpError.value = null;
  initializeLocalValue();
};
</script>

<style scoped>
.editable-labeled-value__display {
  min-height: 1.5rem;
}

.editable-labeled-value__text {
  display: block;
  min-width: 0;
}
</style>

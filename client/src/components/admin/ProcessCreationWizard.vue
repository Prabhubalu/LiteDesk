<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('process.wizardCreateHeading') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ t('process.wizardCreateSubheading') }}
          </p>
        </div>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Progress Stepper -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <nav :aria-label="t('process.wizardProgressAria')">
          <ol role="list" class="flex items-center">
            <li v-for="(step, stepIdx) in steps" :key="step.id" class="relative flex-1">
              <div class="flex items-center">
                <div
                  :class="[
                    'flex h-10 w-10 items-center justify-center rounded-full border-2',
                    step.status === 'complete'
                      ? 'border-indigo-600 bg-indigo-600'
                      : step.status === 'current'
                      ? 'border-indigo-600 bg-white dark:bg-gray-800'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  ]"
                >
                  <svg
                    v-if="step.status === 'complete'"
                    class="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span
                    v-else
                    :class="[
                      'text-sm font-medium',
                      step.status === 'current'
                        ? 'text-indigo-600'
                        : 'text-gray-500 dark:text-gray-400'
                    ]"
                  >
                    {{ step.id }}
                  </span>
                </div>
                <div class="ml-4 min-w-0 flex-1">
                  <p
                    :class="[
                      'text-sm font-medium',
                      step.status === 'current'
                        ? 'text-indigo-600'
                        : step.status === 'complete'
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    ]"
                  >
                    {{ step.name }}
                  </p>
                </div>
              </div>
              <div v-if="stepIdx !== steps.length - 1" class="absolute top-5 left-5 -ml-px h-0.5 w-full bg-gray-300 dark:bg-gray-600" aria-hidden="true"></div>
            </li>
          </ol>
        </nav>
      </div>

      <!-- Step Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Step 1: Scope (app, module, starts when) -->
        <div v-if="currentStep === 0" class="max-w-2xl mx-auto">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.wizardScopeHeading') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('process.wizardScopeIntro') }}
            </p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('process.fieldApp') }} <span class="text-red-500">*</span>
              </label>
              <HeadlessSelect
                v-model="wizardData.appKey"
                :options="appOptions"
                allow-empty
                :empty-label="t('process.phSelectApp')"
                :button-class="WIZARD_SELECT_BUTTON_CLASS"
                @update:model-value="onAppChange"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('process.fieldModule') }} <span class="text-red-500">*</span>
              </label>
              <HeadlessSelect
                v-model="wizardData.entityType"
                :options="moduleOptions"
                allow-empty
                :empty-label="modulePlaceholder"
                :disabled="!wizardData.appKey"
                :button-class="WIZARD_SELECT_BUTTON_CLASS"
                @update:model-value="onModuleChange"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('process.fieldStartsWhen') }} <span class="text-red-500">*</span>
              </label>
              <HeadlessSelect
                v-model="wizardData.coreTrigger"
                :options="coreTriggerOptionsList"
                allow-empty
                :empty-label="startsWhenPlaceholder"
                :placeholder="startsWhenPlaceholder"
                :disabled="!wizardData.entityType"
                :button-class="WIZARD_SELECT_BUTTON_CLASS"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ startsWhenHint }}</p>
              <div v-if="(wizardData.coreTrigger === 'record_updated' || wizardData.coreTrigger === 'record_created_or_updated') && wizardData.entityType" class="mt-3">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.fieldWatchChanges') }}</label>
                <HeadlessSelect
                  v-model="wizardData.updateWatchField"
                  :options="wizardWatchFieldOptions"
                  :button-class="WIZARD_SELECT_BUTTON_CLASS"
                />
              </div>
              <div v-if="wizardData.coreTrigger === 'schedule'" class="mt-3 space-y-2">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('process.fieldFrequency') }}</label>
                <HeadlessSelect
                  v-model="wizardData.schedule.preset"
                  :options="schedulePresetOptions"
                  :button-class="WIZARD_SELECT_BUTTON_CLASS"
                />
              </div>
              <p v-if="wizardData.coreTrigger === 'webhook'" class="text-xs text-amber-700 dark:text-amber-300 mt-2">
                {{ t('process.wizardWebhookHint') }}
              </p>
            </div>

            <!-- Optional Conditions -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <label class="flex items-center cursor-pointer">
                <HeadlessCheckbox
                  v-model="wizardData.hasCondition"
                  checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {{ t('process.wizardApplySomeCases') }}
                </span>
              </label>

              <div v-if="wizardData.hasCondition" class="mt-4 space-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldField') }}
                    </label>
                    <input
                      v-model="wizardData.conditionField"
                      type="text"
                      :placeholder="t('process.phAmount')"
                      class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldOperator') }}
                    </label>
                    <HeadlessSelect
                      v-model="wizardData.conditionOperator"
                      :options="wizardConditionOperatorOptions"
                      :button-class="WIZARD_SELECT_BUTTON_CLASS"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldValue') }}
                    </label>
                    <input
                      v-model="wizardData.conditionValue"
                      type="text"
                      :placeholder="t('process.phAmountValue')"
                      class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: What should the system control? -->
        <div v-if="currentStep === 1" class="max-w-2xl mx-auto">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.wizardWhatHeading') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('process.wizardWhatIntro') }}
            </p>
          </div>

          <div class="space-y-4">
            <!-- Field Behavior -->
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg">
              <label class="flex items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <HeadlessCheckbox
                  v-model="wizardData.controls.fieldBehavior"
                  checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div class="ml-3 flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('process.wizardControlFieldBehavior') }}</span>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ t('process.wizardControlFieldBehaviorDesc') }}
                  </p>
                </div>
              </label>

              <div v-if="wizardData.controls.fieldBehavior" class="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldField') }}
                  </label>
                  <input
                    v-model="wizardData.fieldRule.fieldKey"
                    type="text"
                    :placeholder="t('process.phApproval')"
                    class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldRuleType') }}
                  </label>
                  <HeadlessSelect
                    v-model="wizardData.fieldRule.rule"
                    :options="wizardFieldRuleOptions"
                    :button-class="WIZARD_SELECT_BUTTON_CLASS"
                  />
                </div>
                <div v-if="wizardData.fieldRule.rule === 'default'">
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldDefaultValue') }}
                  </label>
                  <input
                    v-model="wizardData.fieldRule.value"
                    type="text"
                    :placeholder="t('process.phDefaultValue')"
                    class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div v-if="wizardData.fieldRule.rule === 'visibility'">
                  <label class="flex items-center">
                    <HeadlessCheckbox
                      v-model="wizardData.fieldRule.value"
                      checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span class="ml-2 text-xs text-gray-700 dark:text-gray-300">{{ t('process.fieldShowField') }}</span>
                  </label>
                </div>
                <div v-if="wizardData.fieldRule.rule === 'mandatory'" class="text-xs text-gray-500 dark:text-gray-400 italic">
                  {{ t('process.wizardFieldMandatoryHint') }}
                </div>
              </div>
            </div>

            <!-- Ownership & Assignment -->
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg">
              <label class="flex items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <HeadlessCheckbox
                  v-model="wizardData.controls.ownership"
                  checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div class="ml-3 flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('process.wizardControlOwnership') }}</span>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ t('process.wizardControlOwnershipDesc') }}
                  </p>
                </div>
              </label>

              <div v-if="wizardData.controls.ownership" class="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldAssignmentType') }}
                  </label>
                  <HeadlessSelect
                    v-model="wizardData.ownershipRule.assignment"
                    :options="wizardOwnershipAssignmentOptions"
                    :button-class="WIZARD_SELECT_BUTTON_CLASS"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldTarget') }}
                  </label>
                  <input
                    v-model="wizardData.ownershipRule.target"
                    type="text"
                    :placeholder="t('process.phOwnershipTarget')"
                    class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 italic">
                  {{ t('process.wizardOwnershipHint') }}
                </div>
              </div>
            </div>

            <!-- Status / Stage Transitions -->
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg">
              <label class="flex items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <HeadlessCheckbox
                  v-model="wizardData.controls.statusGuard"
                  checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div class="ml-3 flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('process.wizardControlStatus') }}</span>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ t('process.wizardControlStatusDesc') }}
                  </p>
                </div>
              </label>

              <div v-if="wizardData.controls.statusGuard" class="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldField') }}
                  </label>
                  <HeadlessSelect
                    v-model="wizardData.statusGuard.field"
                    :options="wizardStatusGuardFieldOptions"
                    :button-class="WIZARD_SELECT_BUTTON_CLASS"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldFrom') }}
                    </label>
                    <input
                      v-model="wizardData.statusGuard.from"
                      type="text"
                      :placeholder="t('process.phStatusFrom')"
                      class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldTo') }}
                    </label>
                    <input
                      v-model="wizardData.statusGuard.to"
                      type="text"
                      :placeholder="t('process.phStatusTo')"
                      class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldBlockReason') }}
                  </label>
                  <input
                    v-model="wizardData.statusGuard.blockReason"
                    type="text"
                    :placeholder="t('process.phBlockReason')"
                    class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg">
              <label class="flex items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <HeadlessCheckbox
                  v-model="wizardData.controls.actions"
                  checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div class="ml-3 flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('process.wizardControlActions') }}</span>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ t('process.wizardControlActionsDesc') }}
                  </p>
                </div>
              </label>

              <div v-if="wizardData.controls.actions" class="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.fieldActionType') }}
                  </label>
                  <HeadlessSelect
                    v-model="wizardData.action.actionType"
                    :options="wizardActionTypeOptions"
                    allow-empty
                    :empty-label="t('process.phSelectAction')"
                    :placeholder="t('process.phSelectAction')"
                    :button-class="WIZARD_SELECT_BUTTON_CLASS"
                  />
                </div>

                <!-- Create Task Params -->
                <div v-if="wizardData.action.actionType === 'create_task'" class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldTaskTitle') }} <span class="text-red-500">*</span>
                    </label>
                    <input
                      v-model="wizardData.action.params.title"
                      type="text"
                      :placeholder="t('process.phTaskTitle')"
                      class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldDescription') }}
                    </label>
                    <textarea
                      v-model="wizardData.action.params.description"
                      rows="2"
                      :placeholder="t('process.phTaskDescription')"
                      class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    ></textarea>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldAssignTo') }}
                    </label>
                    <HeadlessSelect
                      v-model="wizardData.action.params.assignee"
                      :options="wizardActionRecipientOptions"
                      :button-class="WIZARD_SELECT_BUTTON_CLASS"
                    />
                  </div>
                </div>

                <!-- Notify User Params -->
                <div v-if="wizardData.action.actionType === 'notify_user'" class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldMessage') }} <span class="text-red-500">*</span>
                    </label>
                    <textarea
                      v-model="wizardData.action.params.message"
                      rows="3"
                      :placeholder="t('process.phNotifyMessage')"
                      class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    ></textarea>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('process.fieldRecipient') }}
                    </label>
                    <HeadlessSelect
                      v-model="wizardData.action.params.recipient"
                      :options="wizardActionRecipientOptions"
                      :button-class="WIZARD_SELECT_BUTTON_CLASS"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Review & Create -->
        <div v-if="currentStep === 2" class="max-w-2xl mx-auto">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.wizardReviewHeading') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('process.wizardReviewIntro') }}
            </p>
          </div>

          <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 space-y-4">
            <div>
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.wizardReviewScope') }}</h4>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                {{ scopeSummary }}
                <span v-if="wizardData.hasCondition">
                  <br />{{ t('process.wizardReviewCondition', {
                    field: wizardData.conditionField,
                    operator: getOperatorLabel(wizardData.conditionOperator),
                    value: wizardData.conditionValue
                  }) }}
                </span>
              </p>
            </div>

            <div v-if="hasControls()">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.wizardReviewThen') }}</h4>
              <ul class="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li v-if="wizardData.controls.fieldBehavior">
                  {{ t('process.wizardReviewFieldRule', { field: wizardData.fieldRule.fieldKey, rule: getFieldRuleDescription() }) }}
                </li>
                <li v-if="wizardData.controls.ownership">
                  {{ t('process.wizardReviewOwnership', { target: wizardData.ownershipRule.target, assignment: wizardData.ownershipRule.assignment }) }}
                </li>
                <li v-if="wizardData.controls.statusGuard">
                  <template v-if="wizardData.statusGuard.blockReason">
                    {{ t('process.wizardReviewStatusBlock', {
                      field: wizardData.statusGuard.field,
                      from: wizardData.statusGuard.from,
                      to: wizardData.statusGuard.to,
                      reason: wizardData.statusGuard.blockReason
                    }) }}
                  </template>
                  <template v-else>
                    {{ t('process.wizardReviewStatusAllow', {
                      field: wizardData.statusGuard.field,
                      from: wizardData.statusGuard.from,
                      to: wizardData.statusGuard.to
                    }) }}
                  </template>
                </li>
                <li v-if="wizardData.controls.actions">
                  {{ getActionDescription() }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Process Name -->
          <div class="mt-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('process.fieldProcessName') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="wizardData.name"
              type="text"
              :placeholder="t('process.phProcessName')"
              class="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-indigo-500"
            />
          </div>

          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('process.fieldDescriptionOptional') }}
            </label>
            <textarea
              v-model="wizardData.description"
              rows="3"
              :placeholder="t('process.phProcessDescription')"
              class="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-indigo-500"
            ></textarea>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="mt-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {{ error }}
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {{ t('actions.cancel') }}
        </button>
        <div class="flex items-center gap-3">
          <button
            v-if="currentStep > 0"
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="previousStep"
          >
            {{ t('actions.previous') }}
          </button>
          <button
            v-if="currentStep < steps.length - 1"
            type="button"
            :disabled="!canProceed"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="nextStep"
          >
            {{ t('actions.next') }}
          </button>
          <button
            v-else
            type="button"
            :disabled="saving || !canCreate"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="createProcess"
          >
            <span v-if="saving">{{ t('process.wizardCreating') }}</span>
            <span v-else>{{ t('process.wizardCreateProcess') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  getAppOptions,
  getModuleOptions,
  loadProcessScopeFromRegistry,
  WIZARD_SELECT_BUTTON_CLASS,
  coreTriggerOptions,
  getSchedulePresetOptions,
  getCoreTriggerDescription,
  updateWatchFieldOptions,
  coerceCoreTriggerForModule,
  applyCoreTrigger,
  buildTriggerFromCore,
  buildProcessScopeSentence
} from '@/utils/processDesignerConstants';

const { t } = useI18n();
const registryAppOptions = ref([]);
const registryModulesByApp = ref({});

loadProcessScopeFromRegistry(t)
  .then((scope) => {
    registryAppOptions.value = scope.appOptions;
    registryModulesByApp.value = scope.modulesByApp;
  })
  .catch((e) => console.error('Failed to load process scope from registry', e));

const wizardConditionOperatorOptions = computed(() => [
  { value: 'equals', label: t('process.opEquals') },
  { value: 'not_equals', label: t('process.opNotEquals') },
  { value: 'greater_than', label: t('process.opGreaterThan') },
  { value: 'less_than', label: t('process.opLessThan') },
  { value: 'contains', label: t('process.opContains') }
]);

const wizardFieldRuleOptions = computed(() => [
  { value: 'mandatory', label: t('process.fieldRuleMandatory') },
  { value: 'default', label: t('process.fieldRuleDefault') },
  { value: 'visibility', label: t('process.fieldRuleVisibility') }
]);

const wizardOwnershipAssignmentOptions = computed(() => [
  { value: 'owner', label: t('process.ownershipSpecificUser') },
  { value: 'role', label: t('process.ownershipRole') },
  { value: 'rule', label: t('process.ownershipRuleBased') }
]);

const wizardStatusGuardFieldOptions = computed(() => [
  { value: 'status', label: t('process.statusFieldStatus') },
  { value: 'lifecycle', label: t('process.statusFieldLifecycle') },
  { value: 'stage', label: t('process.statusFieldStage') }
]);

const wizardActionTypeOptions = computed(() => [
  { value: 'create_task', label: t('process.actionCreateTaskLower') },
  { value: 'notify_user', label: t('process.actionNotifyUserLower') },
  { value: 'start_process', label: t('process.actionStartProcessLower') }
]);

const wizardActionRecipientOptions = computed(() => [
  { value: 'owner', label: t('process.assigneeOwner') },
  { value: 'triggeredBy', label: t('process.assigneeTriggeredBy') }
]);

const emit = defineEmits(['close', 'saved']);

const currentStep = ref(0);
const saving = ref(false);
const error = ref(null);

const steps = computed(() => [
  { id: '1', name: t('process.wizardStepScope'), status: currentStep.value > 0 ? 'complete' : currentStep.value === 0 ? 'current' : 'upcoming' },
  { id: '2', name: t('process.wizardStepWhat'), status: currentStep.value > 1 ? 'complete' : currentStep.value === 1 ? 'current' : 'upcoming' },
  { id: '3', name: t('process.wizardStepReview'), status: currentStep.value === 2 ? 'current' : currentStep.value > 2 ? 'complete' : 'upcoming' }
]);

const wizardData = ref({
  name: '',
  description: '',
  coreTrigger: '',
  updateWatchField: '__any__',
  schedule: { preset: 'daily', hour: 9, minute: 0 },
  appKey: '',
  entityType: '',
  hasCondition: false,
  conditionField: '',
  conditionOperator: 'equals',
  conditionValue: '',
  controls: {
    fieldBehavior: false,
    ownership: false,
    statusGuard: false,
    actions: false
  },
  fieldRule: {
    fieldKey: '',
    rule: 'mandatory',
    value: ''
  },
  ownershipRule: {
    assignment: 'owner',
    target: ''
  },
  statusGuard: {
    field: 'stage',
    from: '',
    to: '',
    blockReason: ''
  },
  action: {
    actionType: '',
    params: {
      title: '',
      description: '',
      assignee: 'owner',
      message: '',
      recipient: 'owner'
    }
  }
});

const appOptions = computed(() =>
  registryAppOptions.value.length ? registryAppOptions.value : getAppOptions(t)
);
const moduleOptions = computed(() => {
  const key = String(wizardData.value.appKey || '').toUpperCase();
  if (key && registryModulesByApp.value[key]) return registryModulesByApp.value[key];
  return getModuleOptions(t, wizardData.value.appKey);
});
const coreTriggerOptionsList = computed(() => coreTriggerOptions(t));
const schedulePresetOptions = computed(() => getSchedulePresetOptions(t));
const wizardWatchFieldOptions = computed(() => updateWatchFieldOptions(wizardData.value.entityType, t));

const modulePlaceholder = computed(() => {
  if (!wizardData.value.appKey) return t('process.settingsSelectAppFirst');
  return t('process.phSelectModule');
});

const startsWhenPlaceholder = computed(() => {
  if (!wizardData.value.entityType) return t('process.settingsSelectModuleFirst');
  return t('process.settingsChooseStart');
});

const startsWhenHint = computed(() => {
  if (!wizardData.value.entityType) return t('process.settingsPickModuleFirst');
  return getCoreTriggerDescription(t, wizardData.value.coreTrigger);
});

const scopeSummary = computed(() => {
  const app = appOptions.value.find((a) => a.value === wizardData.value.appKey)?.label || wizardData.value.appKey;
  const mod = moduleOptions.value.find((m) => m.value === wizardData.value.entityType)?.label || wizardData.value.entityType;
  const when = buildProcessScopeSentence(
    {
      appKey: wizardData.value.appKey,
      entityType: wizardData.value.entityType,
      coreTrigger: wizardData.value.coreTrigger,
      trigger: buildTriggerFromCore(wizardData.value.coreTrigger, wizardData.value.entityType, {
        updateWatchField: wizardData.value.updateWatchField,
        schedule: wizardData.value.schedule
      })
    },
    t
  );
  return `${app} · ${mod} — ${when}`;
});

function onAppChange() {
  wizardData.value.entityType = '';
  wizardData.value.coreTrigger = '';
}

function onModuleChange() {
  if (!wizardData.value.entityType) {
    wizardData.value.coreTrigger = '';
    return;
  }
  wizardData.value.coreTrigger = coerceCoreTriggerForModule(wizardData.value.coreTrigger);
}

const canProceed = computed(() => {
  if (currentStep.value === 0) {
    return !!(wizardData.value.appKey && wizardData.value.entityType && wizardData.value.coreTrigger);
  }
  if (currentStep.value === 1) {
    return Object.values(wizardData.value.controls).some((v) => v);
  }
  return true;
});

const canCreate = computed(() => {
  if (!wizardData.value.name.trim()) return false;
  if (!wizardData.value.coreTrigger) return false;
  if (!hasControls()) return false;
  
  // Validate field rule if enabled
  if (wizardData.value.controls.fieldBehavior && !wizardData.value.fieldRule.fieldKey) {
    return false;
  }
  
  // Validate ownership rule if enabled
  if (wizardData.value.controls.ownership && !wizardData.value.ownershipRule.target) {
    return false;
  }
  
  // Validate status guard if enabled
  if (wizardData.value.controls.statusGuard && (!wizardData.value.statusGuard.from || !wizardData.value.statusGuard.to)) {
    return false;
  }
  
  // Validate action if enabled
  if (wizardData.value.controls.actions) {
    if (!wizardData.value.action.actionType) return false;
    if (wizardData.value.action.actionType === 'create_task' && !wizardData.value.action.params.title) {
      return false;
    }
    if (wizardData.value.action.actionType === 'notify_user' && !wizardData.value.action.params.message) {
      return false;
    }
  }
  
  return true;
});

const hasControls = () => {
  return Object.values(wizardData.value.controls).some(v => v);
};

const getOperatorLabel = (op) => {
  const labels = {
    equals: '=',
    not_equals: '≠',
    greater_than: '>',
    less_than: '<',
    contains: t('process.opSymbolContains')
  };
  return labels[op] || op;
};

const getFieldRuleDescription = () => {
  if (wizardData.value.fieldRule.rule === 'mandatory') {
    return t('process.wizardFieldRuleMandatory');
  }
  if (wizardData.value.fieldRule.rule === 'default') {
    return t('process.wizardFieldRuleDefault', { value: wizardData.value.fieldRule.value });
  }
  return wizardData.value.fieldRule.value
    ? t('process.wizardFieldRuleVisible')
    : t('process.wizardFieldRuleHidden');
};

const getActionDescription = () => {
  if (wizardData.value.action.actionType === 'create_task') {
    return t('process.wizardActionCreateTask', { title: wizardData.value.action.params.title });
  }
  if (wizardData.value.action.actionType === 'notify_user') {
    return t('process.wizardActionNotify', {
      recipient: wizardData.value.action.params.recipient === 'owner'
        ? t('process.wizardActionNotifyOwner')
        : t('process.wizardActionNotifyUser')
    });
  }
  return t('process.wizardActionRun');
};

const nextStep = () => {
  if (canProceed.value && currentStep.value < steps.value.length - 1) {
    currentStep.value++;
  }
};

const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
};

const generateProcessDefinition = () => {
  const nodes = [];
  const edges = [];
  let nodeIdCounter = 1;

  // Generate node ID helper
  const getNodeId = (prefix) => `${prefix}_${nodeIdCounter++}`;

  const applied = applyCoreTrigger(wizardData.value.coreTrigger, wizardData.value.entityType, {
    updateWatchField: wizardData.value.updateWatchField,
    schedule: wizardData.value.schedule
  });
  const trigger = buildTriggerFromCore(wizardData.value.coreTrigger, wizardData.value.entityType, {
    updateWatchField: wizardData.value.updateWatchField,
    schedule: wizardData.value.schedule
  });

  if (applied.needsTriggerNode) {
    const triggerNodeId = getNodeId('trigger');
    const triggerConfig =
      applied.type === 'domain_event'
        ? { eventType: applied.eventType, triggerKind: 'domain_event' }
        : { triggerKind: applied.type };
    nodes.push({
      id: triggerNodeId,
      type: 'trigger',
      config: triggerConfig
    });
  }

  // Add condition node if condition exists
  let lastNodeId = nodes.length > 0 ? nodes[nodes.length - 1].id : null;
  if (wizardData.value.hasCondition && wizardData.value.conditionField) {
    const conditionNodeId = getNodeId('condition');
    nodes.push({
      id: conditionNodeId,
      type: 'condition',
      config: {
        condition: {
          field: `event.currentState.${wizardData.value.conditionField}`,
          operator: wizardData.value.conditionOperator,
          value: wizardData.value.conditionValue
        }
      }
    });
    if (lastNodeId) {
      edges.push({
        fromNodeId: lastNodeId,
        toNodeId: conditionNodeId
      });
    }
    lastNodeId = conditionNodeId;
  }

  // Add field rule node
  if (wizardData.value.controls.fieldBehavior && wizardData.value.fieldRule.fieldKey) {
    const fieldRuleNodeId = getNodeId('field_rule');
    nodes.push({
      id: fieldRuleNodeId,
      type: 'field_rule',
      config: {
        entityType: wizardData.value.entityType,
        fieldKey: wizardData.value.fieldRule.fieldKey,
        rule: wizardData.value.fieldRule.rule,
        value: wizardData.value.fieldRule.rule === 'visibility' 
          ? wizardData.value.fieldRule.value 
          : wizardData.value.fieldRule.value || true
      }
    });
    if (lastNodeId) {
      edges.push({
        fromNodeId: lastNodeId,
        toNodeId: fieldRuleNodeId
      });
    }
    lastNodeId = fieldRuleNodeId;
  }

  // Add ownership rule node
  if (wizardData.value.controls.ownership && wizardData.value.ownershipRule.target) {
    const ownershipNodeId = getNodeId('ownership_rule');
    nodes.push({
      id: ownershipNodeId,
      type: 'ownership_rule',
      config: {
        entityType: wizardData.value.entityType,
        assignment: wizardData.value.ownershipRule.assignment,
        target: wizardData.value.ownershipRule.target
      }
    });
    if (lastNodeId) {
      edges.push({
        fromNodeId: lastNodeId,
        toNodeId: ownershipNodeId
      });
    }
    lastNodeId = ownershipNodeId;
  }

  // Add status guard node
  if (wizardData.value.controls.statusGuard && wizardData.value.statusGuard.from && wizardData.value.statusGuard.to) {
    const statusGuardNodeId = getNodeId('status_guard');
    nodes.push({
      id: statusGuardNodeId,
      type: 'status_guard',
      config: {
        entityType: wizardData.value.entityType,
        field: wizardData.value.statusGuard.field,
        allowedTransitions: [`${wizardData.value.statusGuard.from} → ${wizardData.value.statusGuard.to}`]
      }
    });
    if (lastNodeId) {
      edges.push({
        fromNodeId: lastNodeId,
        toNodeId: statusGuardNodeId
      });
    }
    lastNodeId = statusGuardNodeId;
  }

  // Add action node
  if (wizardData.value.controls.actions && wizardData.value.action.actionType) {
    const actionNodeId = getNodeId('action');
    const actionParams = { ...wizardData.value.action.params };
    
    // Clean up empty params
    Object.keys(actionParams).forEach(key => {
      if (actionParams[key] === '') {
        delete actionParams[key];
      }
    });

    nodes.push({
      id: actionNodeId,
      type: 'action',
      config: {
        actionType: wizardData.value.action.actionType,
        params: actionParams
      }
    });
    if (lastNodeId) {
      edges.push({
        fromNodeId: lastNodeId,
        toNodeId: actionNodeId
      });
    }
    lastNodeId = actionNodeId;
  }

  // Add end node
  const endNodeId = getNodeId('end');
  nodes.push({
    id: endNodeId,
    type: 'end',
    config: {}
  });
  if (lastNodeId) {
    edges.push({
      fromNodeId: lastNodeId,
      toNodeId: endNodeId
    });
  }

  return {
    name: wizardData.value.name,
    description: wizardData.value.description || '',
    appKey: wizardData.value.appKey,
    entityType: wizardData.value.entityType,
    trigger,
    triggerConfigured: true,
    status: 'draft',
    version: 1,
    nodes,
    edges
  };
};

const createProcess = async () => {
  if (!canCreate.value) return;

  saving.value = true;
  error.value = null;

  try {
    const processDefinition = generateProcessDefinition();
    const response = await apiClient.post('/admin/processes', processDefinition);

    if (response.success) {
      emit('saved', response.data);
      emit('close');
    } else {
      error.value = response.message || t('process.wizardCreateFailed');
    }
  } catch (err) {
    error.value = err.message || t('process.wizardCreateFailed');
    console.error('Error creating process:', err);
  } finally {
    saving.value = false;
  }
};
</script>

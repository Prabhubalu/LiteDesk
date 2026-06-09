import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

export function usePlaybookStageActions(getCurrentPipeline) {
  const { t } = useI18n();

  const actionModalState = reactive({
    open: false,
    stageKey: '',
    actionIndex: null,
    isNew: false
  });

  const actionModalDraft = ref(null);
  const actionModalSnapshot = ref('');

  const playbookActionTypes = computed(() => [
    { value: 'task', label: t('settings.modFieldsPbActionTask') },
    { value: 'call', label: t('settings.modFieldsPbActionCall') },
    { value: 'meeting', label: t('settings.modFieldsPbActionMeeting') },
    { value: 'email', label: t('settings.modFieldsPbActionEmail') },
    { value: 'event', label: t('settings.modFieldsPbActionEvent') },
    { value: 'document', label: t('settings.modFieldsPbActionDocument') },
    { value: 'approval', label: t('settings.modFieldsPbActionApproval') },
    { value: 'alert', label: t('settings.modFieldsPbActionAlert') },
    { value: 'other', label: t('settings.modFieldsPbActionOther') }
  ]);

  const playbookTriggerOptions = computed(() => [
    { value: 'stage_entry', label: t('settings.modFieldsPbTriggerStageEntry') },
    { value: 'after_action', label: t('settings.modFieldsPbTriggerAfterAction') },
    { value: 'time_delay', label: t('settings.modFieldsPbTriggerTimeDelay') },
    { value: 'custom', label: t('settings.modFieldsPbTriggerCustom') }
  ]);

  const playbookAlertTypeOptions = computed(() => [
    { value: 'in_app', label: t('settings.modFieldsPbAlertInApp') },
    { value: 'email', label: t('settings.modFieldsPbAlertEmail') },
    { value: 'sms', label: t('settings.modFieldsPbAlertSms') }
  ]);

  const playbookDelayUnitOptions = computed(() => [
    { value: 'minutes', label: t('settings.modFieldsPbDelayMinutes') },
    { value: 'hours', label: t('settings.modFieldsPbDelayHours') },
    { value: 'days', label: t('settings.modFieldsPbDelayDays') }
  ]);

  const playbookResourceTypes = computed(() => [
    { value: 'document', label: t('settings.modFieldsPbResourceDocument') },
    { value: 'link', label: t('settings.modFieldsPbResourceLink') },
    { value: 'form', label: t('settings.modFieldsPbResourceForm') },
    { value: 'template', label: t('settings.modFieldsPbResourceTemplate') },
    { value: 'other', label: t('settings.modFieldsPbResourceOther') }
  ]);

  const playbookAssignmentOptions = computed(() => [
    { value: 'deal_owner', label: t('settings.modFieldsPbAssignDealOwner') },
    { value: 'stage_owner', label: t('settings.modFieldsPbAssignStageOwner') },
    { value: 'role', label: t('settings.modFieldsPbAssignRole') },
    { value: 'team', label: t('settings.modFieldsPbAssignTeam') },
    { value: 'specific_user', label: t('settings.modFieldsPbAssignSpecificUser') }
  ]);

  function slugify(value = '') {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || `item-${Date.now()}`;
  }

  function normalizePlaybookAssignment(assignment = {}) {
    const type = playbookAssignmentOptions.value.some(opt => opt.value === assignment.type)
      ? assignment.type
      : 'deal_owner';
    return {
      type,
      targetId: assignment.targetId || null,
      targetType: assignment.targetType || '',
      targetName: assignment.targetName || ''
    };
  }

  function normalizeActionTrigger(trigger = {}) {
    const type = playbookTriggerOptions.value.some(opt => opt.value === trigger.type)
      ? trigger.type
      : 'stage_entry';
    let delay = null;
    if (trigger.delay && typeof trigger.delay === 'object') {
      const amount = Math.max(0, Number(trigger.delay.amount) || 0);
      const unit = playbookDelayUnitOptions.value.some(opt => opt.value === trigger.delay.unit)
        ? trigger.delay.unit
        : 'days';
      delay = { amount, unit };
    }
    const conditions = Array.isArray(trigger.conditions)
      ? trigger.conditions.map(condition => ({
          field: condition.field || '',
          operator: condition.operator || 'equals',
          value: condition.value
        }))
      : [];
    return {
      type,
      sourceActionKey: trigger.sourceActionKey ? slugify(trigger.sourceActionKey) : '',
      delay,
      conditions,
      description: trigger.description || ''
    };
  }

  function normalizeActionAlerts(alerts = []) {
    if (!Array.isArray(alerts)) return [];
    return alerts.map(alert => {
      const type = playbookAlertTypeOptions.value.some(opt => opt.value === alert.type)
        ? alert.type
        : 'in_app';
      let offset = null;
      if (alert.offset && typeof alert.offset === 'object') {
        const amount = Math.max(0, Number(alert.offset.amount) || 0);
        const unit = playbookDelayUnitOptions.value.some(opt => opt.value === alert.offset.unit)
          ? alert.offset.unit
          : 'hours';
        offset = { amount, unit };
      }
      const recipients = Array.isArray(alert.recipients)
        ? alert.recipients.map(r => String(r || '').trim()).filter(Boolean)
        : [];
      return {
        type,
        offset,
        recipients,
        message: alert.message || ''
      };
    });
  }

  const playbookExitConditionOperators = computed(() => [
    { value: 'equals', label: t('settings.modFieldsOpEquals') },
    { value: 'not_equals', label: t('settings.modFieldsOpNotEquals') },
    { value: 'contains', label: t('settings.modFieldsOpContains') },
    { value: 'in', label: t('settings.modFieldsOpIn') },
    { value: 'not_in', label: t('settings.modFieldsOpNotIn') },
    { value: 'exists', label: t('settings.modFieldsOpExists') },
    { value: 'gt', label: t('settings.modFieldsOpGt') },
    { value: 'gte', label: t('settings.modFieldsOpGte') },
    { value: 'lt', label: t('settings.modFieldsOpLt') },
    { value: 'lte', label: t('settings.modFieldsOpLte') }
  ]);

  const playbookExitConditionFields = computed(() => [
    { value: 'amount', label: t('settings.salesPlayExitFieldAmount') },
    { value: 'probability', label: t('settings.salesPlayExitFieldProbability') },
    { value: 'stage', label: t('settings.salesPlayExitFieldStage') },
    { value: 'status', label: t('settings.salesPlayExitFieldStatus') },
    { value: 'priority', label: t('settings.salesPlayExitFieldPriority') },
    { value: 'type', label: t('settings.salesPlayExitFieldType') },
    { value: 'derivedStatus', label: t('settings.salesPlayExitFieldDerivedStatus') },
    { value: 'currency', label: t('settings.salesPlayExitFieldCurrency') }
  ]);

  function normalizeExitCondition(condition = {}) {
    const operator = playbookExitConditionOperators.value.some(opt => opt.value === condition.operator)
      ? condition.operator
      : 'equals';
    return {
      field: condition.field || '',
      operator,
      value: condition.value ?? ''
    };
  }

  function addExitCondition(stage) {
    ensureStagePlaybook(stage);
    if (!Array.isArray(stage.playbook.exitCriteria.conditions)) {
      stage.playbook.exitCriteria.conditions = [];
    }
    stage.playbook.exitCriteria.conditions.push(normalizeExitCondition({}));
  }

  function removeExitCondition(stage, conditionIndex) {
    ensureStagePlaybook(stage);
    if (!Array.isArray(stage.playbook.exitCriteria.conditions)) return;
    stage.playbook.exitCriteria.conditions.splice(conditionIndex, 1);
  }

  function normalizeActionResources(resources = []) {
    if (!Array.isArray(resources)) return [];
    return resources.map(resource => ({
      name: resource?.name || '',
      type: playbookResourceTypes.value.some(opt => opt.value === resource?.type) ? resource.type : 'document',
      url: resource?.url || '',
      description: resource?.description || ''
    }));
  }

  function ensureStagePlaybook(stage) {
    if (!stage) return;
    if (!stage.playbook || typeof stage.playbook !== 'object') {
      stage.playbook = {
        enabled: false,
        actions: [],
        mode: 'sequential',
        autoAdvance: false,
        exitCriteria: { type: 'manual', customDescription: '', nextStageKey: '', conditions: [] },
        notes: ''
      };
    }
    if (!Array.isArray(stage.playbook.actions)) {
      stage.playbook.actions = [];
    }
    if (!stage.playbook.exitCriteria) {
      stage.playbook.exitCriteria = {
        type: stage.status === 'won' || stage.status === 'lost' ? 'manual' : 'all_actions_completed',
        customDescription: '',
        nextStageKey: '',
        conditions: []
      };
    }
    if (!Array.isArray(stage.playbook.exitCriteria.conditions)) {
      stage.playbook.exitCriteria.conditions = [];
    } else {
      stage.playbook.exitCriteria.conditions = stage.playbook.exitCriteria.conditions.map(normalizeExitCondition);
    }
    if (stage.playbook.mode === 'parallel') {
      stage.playbook.mode = 'non_sequential';
    }
    const needsActionNormalization = stage.playbook.actions.some((action) =>
      !action?.key
      || !action?.trigger
      || !action?.assignment
      || !Array.isArray(action?.dependencies)
      || !Array.isArray(action?.alerts)
      || !Array.isArray(action?.resources)
    );
    if (!needsActionNormalization) return;
    stage.playbook.actions = stage.playbook.actions.map((action, index) => {
      const key = action?.key || slugify(`${stage.key}-action-${index}`);
      const title = action?.title || `Action ${index + 1}`;
      const actionType = playbookActionTypes.value.some(opt => opt.value === action?.actionType) ? action.actionType : 'task';
      const trigger = normalizeActionTrigger(action?.trigger || {});
      if (trigger.type === 'time_delay' && !trigger.delay) {
        trigger.delay = { amount: 0, unit: 'hours' };
      }
      const alerts = normalizeActionAlerts(action?.alerts || []).map(alert => {
        if (!alert.offset) {
          alert.offset = { amount: 0, unit: 'hours' };
        }
        return alert;
      });
      const resources = normalizeActionResources(action?.resources || []);
      return {
        key,
        title,
        description: action?.description || '',
        actionType,
        dueInDays: Math.max(0, Number(action?.dueInDays) || 0),
        assignment: normalizePlaybookAssignment(action?.assignment || {}),
        required: action?.required !== false,
        dependencies: Array.isArray(action?.dependencies) ? action.dependencies.filter(Boolean) : [],
        autoCreate: action?.autoCreate !== false,
        trigger,
        alerts,
        resources,
        metadata: typeof action?.metadata === 'object' && action.metadata !== null ? { ...action.metadata } : {}
      };
    });
  }

  const actionModalStage = computed(() => {
    if (!actionModalState.open) return null;
    const pipeline = getCurrentPipeline.value;
    if (!pipeline || !Array.isArray(pipeline.stages)) return null;
    return pipeline.stages.find(stage => stage.key === actionModalState.stageKey) || null;
  });

  const actionModalAction = computed(() => actionModalDraft.value);

  const actionModalActionIndex = computed(() => {
    if (!actionModalState.open) return -1;
    if (actionModalState.isNew) {
      const stage = actionModalStage.value;
      return stage?.playbook?.actions?.length ?? 0;
    }
    return typeof actionModalState.actionIndex === 'number' ? actionModalState.actionIndex : -1;
  });

  const isActionModalDirty = computed(() => {
    if (!actionModalDraft.value) return false;
    if (actionModalState.isNew) return true;
    return JSON.stringify(actionModalDraft.value) !== actionModalSnapshot.value;
  });

  const isActionModalOpen = computed(() => !!(actionModalState.open && actionModalStage.value && actionModalDraft.value));

  function resetActionModalDraft() {
    actionModalDraft.value = null;
    actionModalSnapshot.value = '';
  }

  function openActionModal(stage, actionIndex = 0, options = {}) {
    if (!stage) return;
    ensureStagePlaybook(stage);
    actionModalState.open = true;
    actionModalState.stageKey = stage.key;
    actionModalState.isNew = !!options.isNew;

    if (options.isNew && options.draft) {
      actionModalState.actionIndex = stage.playbook.actions.length;
      actionModalDraft.value = JSON.parse(JSON.stringify(options.draft));
      actionModalSnapshot.value = '';
      return;
    }

    const clampedIndex = Math.min(
      Math.max(0, typeof actionIndex === 'number' ? actionIndex : 0),
      Math.max(0, stage.playbook.actions.length - 1)
    );
    actionModalState.actionIndex = clampedIndex;
    const action = stage.playbook.actions[clampedIndex];
    if (!action) {
      closeActionModal();
      return;
    }
    actionModalDraft.value = JSON.parse(JSON.stringify(action));
    actionModalSnapshot.value = JSON.stringify(action);
  }

  function closeActionModal() {
    actionModalState.open = false;
    actionModalState.stageKey = '';
    actionModalState.actionIndex = null;
    actionModalState.isNew = false;
    resetActionModalDraft();
  }

  function discardActionModal() {
    closeActionModal();
  }

  function saveActionModal() {
    const stage = actionModalStage.value;
    const draft = actionModalDraft.value;
    if (!stage || !draft) {
      closeActionModal();
      return;
    }
    ensureStagePlaybook(stage);
    const normalizedDraft = JSON.parse(JSON.stringify(draft));
    if (actionModalState.isNew) {
      stage.playbook.actions.push(normalizedDraft);
    } else {
      const index = actionModalState.actionIndex;
      if (typeof index !== 'number' || index < 0 || index >= stage.playbook.actions.length) {
        closeActionModal();
        return;
      }
      stage.playbook.actions[index] = normalizedDraft;
      refreshPlaybookActionKey(stage, stage.playbook.actions[index]);
    }
    closeActionModal();
  }

  function createPlaybookActionDraft(stage, titleFallback, options = {}) {
    ensureStagePlaybook(stage);
    const index = stage.playbook.actions.length;
    const title = titleFallback || `Action ${index + 1}`;
    const actionType = playbookActionTypes.value.some(opt => opt.value === options.actionType)
      ? options.actionType
      : 'task';
    let key = slugify(`${stage.key}-${title}-${Date.now()}`);
    const existingKeys = new Set(stage.playbook.actions.map(action => action.key));
    while (existingKeys.has(key)) {
      key = `${key}-${Math.floor(Math.random() * 1000)}`;
    }
    return {
      key,
      title,
      description: '',
      actionType,
      dueInDays: 0,
      assignment: {
        type: 'deal_owner',
        targetId: null,
        targetType: '',
        targetName: ''
      },
      required: true,
      dependencies: [],
      autoCreate: true,
      trigger: normalizeActionTrigger({ type: 'stage_entry' }),
      alerts: [],
      resources: [],
      metadata: {}
    };
  }

  function addPlaybookAction(stage, titleFallback, options = {}) {
    const draft = createPlaybookActionDraft(stage, titleFallback, options);
    openActionModal(stage, stage.playbook.actions.length, { isNew: true, draft });
  }

  function removePlaybookAction(stage, actionIndex) {
    ensureStagePlaybook(stage);
    if (actionIndex < 0 || actionIndex >= stage.playbook.actions.length) return;
    const [removed] = stage.playbook.actions.splice(actionIndex, 1);
    if (removed?.key) {
      stage.playbook.actions.forEach(action => {
        action.dependencies = action.dependencies.filter(dep => dep !== removed.key);
      });
    }
    if (actionModalState.open && stage.key === actionModalState.stageKey) {
      if (actionModalState.actionIndex === actionIndex) {
        closeActionModal();
      } else if (typeof actionModalState.actionIndex === 'number' && actionModalState.actionIndex > actionIndex) {
        actionModalState.actionIndex = Math.max(0, actionModalState.actionIndex - 1);
      }
    }
  }

  function movePlaybookAction(stage, actionIndex, direction) {
    ensureStagePlaybook(stage);
    const newIndex = actionIndex + direction;
    if (newIndex < 0 || newIndex >= stage.playbook.actions.length) return;
    const [action] = stage.playbook.actions.splice(actionIndex, 1);
    stage.playbook.actions.splice(newIndex, 0, action);
    if (actionModalState.open && stage.key === actionModalState.stageKey && action?.key) {
      const updatedIndex = stage.playbook.actions.findIndex(a => a.key === action.key);
      actionModalState.actionIndex = updatedIndex;
    }
  }

  function refreshPlaybookActionKey(stage, action) {
    ensureStagePlaybook(stage);
    if (!action || !action.title) return;
    const currentKey = action.key;
    const slugBase = slugify(`${stage.key}-${action.title}`);
    if (!slugBase) return;
    const otherKeys = new Set(stage.playbook.actions.filter(a => a !== action).map(a => a.key));
    let candidate = slugBase;
    let counter = 1;
    while (otherKeys.has(candidate)) {
      candidate = `${slugBase}-${counter++}`;
    }
    if (candidate !== currentKey) {
      stage.playbook.actions.forEach(a => {
        a.dependencies = a.dependencies.map(dep => (dep === currentKey ? candidate : dep));
        if (a.trigger?.sourceActionKey === currentKey) {
          a.trigger.sourceActionKey = candidate;
        }
      });
      action.key = candidate;
    }
  }

  function refreshDraftActionKey(stage, draft) {
    if (!stage || !draft || !draft.title) return;
    const slugBase = slugify(`${stage.key}-${draft.title}`);
    if (!slugBase) return;
    const otherKeys = new Set(stage.playbook.actions.map(a => a.key));
    let candidate = slugBase;
    let counter = 1;
    while (otherKeys.has(candidate)) {
      candidate = `${slugBase}-${counter++}`;
    }
    draft.key = candidate;
  }

  function getPlaybookActionTypeLabel(actionType) {
    const option = playbookActionTypes.value.find(opt => opt.value === actionType);
    return option ? option.label : t('settings.modFieldsPbActionTask');
  }

  function getPlaybookAssignmentLabel(type) {
    const option = playbookAssignmentOptions.value.find(opt => opt.value === type);
    return option ? option.label : t('settings.modFieldsPbAssignDealOwner');
  }

  function getActionOptions(stage, currentAction) {
    if (!stage || !Array.isArray(stage.playbook?.actions)) return [];
    return stage.playbook.actions
      .filter(action => action.key !== currentAction?.key)
      .map(action => ({ value: action.key, label: action.title }));
  }

  function toggleActionDependency(stage, action, dependencyKey, checked) {
    ensureStagePlaybook(stage);
    if (!action || !dependencyKey) return;
    if (!Array.isArray(action.dependencies)) {
      action.dependencies = [];
    }
    if (checked) {
      if (!action.dependencies.includes(dependencyKey)) {
        action.dependencies.push(dependencyKey);
      }
    } else {
      action.dependencies = action.dependencies.filter(dep => dep !== dependencyKey);
    }
  }

  function handleTriggerTypeChange(action) {
    if (!action) return;
    if (!action.trigger || typeof action.trigger !== 'object') {
      action.trigger = normalizeActionTrigger({});
    }
    const normalized = normalizeActionTrigger(action.trigger);
    Object.assign(action.trigger, normalized);
    if (action.trigger.type === 'after_action') {
      action.trigger.sourceActionKey = action.trigger.sourceActionKey || '';
    } else {
      action.trigger.sourceActionKey = '';
    }
    if (action.trigger.type === 'time_delay') {
      if (!action.trigger.delay) {
        action.trigger.delay = { amount: 0, unit: 'hours' };
      }
    } else {
      action.trigger.delay = null;
    }
    if (action.trigger.type !== 'custom') {
      action.trigger.conditions = [];
    }
  }

  function ensureTriggerDelay(action) {
    if (!action) return;
    if (!action.trigger || typeof action.trigger !== 'object') {
      action.trigger = normalizeActionTrigger({});
    }
    if (!action.trigger.delay || typeof action.trigger.delay !== 'object') {
      action.trigger.delay = { amount: 0, unit: 'hours' };
    }
  }

  function updateTriggerDelayAmount(action, value) {
    ensureTriggerDelay(action);
    action.trigger.delay.amount = Math.max(0, Number(value) || 0);
  }

  function updateTriggerDelayUnit(action, unit) {
    ensureTriggerDelay(action);
    const fallback = playbookDelayUnitOptions.value[0]?.value || 'hours';
    action.trigger.delay.unit = playbookDelayUnitOptions.value.some(opt => opt.value === unit) ? unit : fallback;
  }

  function addActionAlert(stage, action) {
    ensureStagePlaybook(stage);
    if (!Array.isArray(action.alerts)) {
      action.alerts = [];
    }
    action.alerts.push({
      type: 'in_app',
      offset: { amount: 0, unit: 'hours' },
      recipients: [],
      message: ''
    });
  }

  function removeActionAlert(stage, action, alertIndex) {
    if (!Array.isArray(action.alerts)) return;
    action.alerts.splice(alertIndex, 1);
  }

  function ensureAlertOffset(alert) {
    if (!alert) return;
    if (!alert.offset || typeof alert.offset !== 'object') {
      alert.offset = { amount: 0, unit: 'hours' };
    }
  }

  function updateAlertOffsetAmount(alert, value) {
    ensureAlertOffset(alert);
    alert.offset.amount = Math.max(0, Number(value) || 0);
  }

  function updateAlertOffsetUnit(alert, unit) {
    ensureAlertOffset(alert);
    const fallback = playbookDelayUnitOptions.value[0]?.value || 'hours';
    alert.offset.unit = playbookDelayUnitOptions.value.some(opt => opt.value === unit) ? unit : fallback;
  }

  function updateAlertRecipients(alert, value) {
    if (!alert) return;
    const recipients = String(value || '')
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);
    alert.recipients = recipients;
  }

  function addActionResource(stage, action) {
    ensureStagePlaybook(stage);
    if (!Array.isArray(action.resources)) {
      action.resources = [];
    }
    action.resources.push({
      name: '',
      type: 'document',
      url: '',
      description: ''
    });
  }

  function removeActionResource(stage, action, resourceIndex) {
    if (!Array.isArray(action.resources)) return;
    action.resources.splice(resourceIndex, 1);
  }

  return {
    actionModalState,
    actionModalDraft,
    actionModalStage,
    actionModalAction,
    actionModalActionIndex,
    isActionModalOpen,
    isActionModalDirty,
    playbookActionTypes,
    playbookTriggerOptions,
    playbookAlertTypeOptions,
    playbookDelayUnitOptions,
    playbookResourceTypes,
    playbookAssignmentOptions,
    playbookExitConditionOperators,
    playbookExitConditionFields,
    addExitCondition,
    removeExitCondition,
    ensureStagePlaybook,
    openActionModal,
    closeActionModal,
    saveActionModal,
    discardActionModal,
    refreshDraftActionKey,
    addPlaybookAction,
    removePlaybookAction,
    movePlaybookAction,
    refreshPlaybookActionKey,
    getPlaybookActionTypeLabel,
    getPlaybookAssignmentLabel,
    getActionOptions,
    toggleActionDependency,
    handleTriggerTypeChange,
    updateTriggerDelayAmount,
    updateTriggerDelayUnit,
    addActionAlert,
    removeActionAlert,
    updateAlertOffsetAmount,
    updateAlertOffsetUnit,
    updateAlertRecipients,
    addActionResource,
    removeActionResource
  };
}

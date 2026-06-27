import { computed, ref } from 'vue';
import { stripHtmlForDetailDisplay } from '@/utils/fieldDisplay';

const TASK_DEFAULT_KEY_FIELDS = Object.freeze(['status', 'priority', 'startDate', 'dueDate', 'assignedTo', 'estimatedHours']);
const DETAIL_RENDERABLE_KEYS = Object.freeze(new Set([
  'assignedto', 'duedate', 'startdate', 'priority', 'status',
  'estimatedhours', 'actualhours', 'tags', 'relatedto'
]));
const EDITABLE_FIELD_TYPES = Object.freeze(new Set(['text', 'number', 'date', 'select', 'user']));

const normalizeFieldKey = (key) => String(key || '').toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');

const resolveValue = (value) => {
  if (typeof value === 'function') {
    return value();
  }
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value;
  }
  return value;
};

export const useTaskSectionDataProviders = (context = {}) => {
  const showAllDetails = ref(false);
  const showAllSubtasks = ref(false);
  const subtasksRenderLimit = ref(20);

  const detailsSectionExcludedFields = computed(() => {
    const baseExcluded = ['title', 'description', 'subtasks', 'projectId'];
    const systemExcluded = [
      'completedAt', 'deletedAt', 'deletedBy', 'deletionReason',
      'createdAt', 'updatedAt', 'createdBy', 'relatedToType', 'relatedToId'
    ];
    const keyFieldKeys = resolveValue(context.keyFieldKeys) || [];
    const keys = keyFieldKeys.length > 0 ? keyFieldKeys : TASK_DEFAULT_KEY_FIELDS;
    return Array.from(new Set([...baseExcluded, ...systemExcluded, ...keys]));
  });

  const detailsSectionFieldsOrdered = computed(() => {
    const excluded = detailsSectionExcludedFields.value;
    const excludedNorm = new Set(excluded.map(normalizeFieldKey));
    const moduleDefinition = resolveValue(context.taskModuleDefinition);
    const moduleFields = moduleDefinition?.fields || [];

    if (moduleFields.length === 0) {
      const getCoreTaskFields = context.getCoreTaskFields || (() => []);
      const getTaskFieldMetadata = context.getTaskFieldMetadata || (() => null);
      const customFields = resolveValue(context.customFields) || [];

      const coreFields = getCoreTaskFields();
      const displayableFields = coreFields.filter((field) => !excluded.includes(field));
      const core = displayableFields.filter((field) => {
        const metadata = getTaskFieldMetadata(field);
        return metadata && (metadata.intent === 'primary' || metadata.intent === 'state' || metadata.intent === 'scheduling');
      });
      const planning = displayableFields.filter((field) => {
        const metadata = getTaskFieldMetadata(field);
        return metadata && metadata.intent === 'tracking';
      });
      const relationships = displayableFields.filter((field) => {
        const metadata = getTaskFieldMetadata(field);
        return metadata && metadata.intent === 'detail';
      });
      if (displayableFields.includes('tags') && !relationships.includes('tags') && !planning.includes('tags')) {
        planning.push('tags');
      }
      const customKeys = customFields.map((field) => field?.key).filter(Boolean);
      return [...new Set([...core, ...planning, ...relationships, ...customKeys])];
    }

    const ordered = [];
    const seen = new Set();
    const sorted = [...moduleFields].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    for (const field of sorted) {
      const key = field?.key;
      if (!key) continue;
      const keyNorm = normalizeFieldKey(key);
      if (excludedNorm.has(keyNorm)) continue;
      if (seen.has(keyNorm)) continue;

      const showInDetail = field.visibility?.detail;
      if (showInDetail !== true && keyNorm !== 'relatedto') {
        continue;
      }

      seen.add(keyNorm);
      ordered.push(key);
    }

    return ordered;
  });

  const detailFieldsOrdered = computed(() => {
    const customFields = resolveValue(context.customFields) || [];
    const customKeys = customFields.map((field) => (field?.key || '').toLowerCase()).filter(Boolean);

    return detailsSectionFieldsOrdered.value.filter((key) => {
      const normalized = normalizeFieldKey(key);
      return DETAIL_RENDERABLE_KEYS.has(normalized) || customKeys.includes(normalized);
    });
  });

  const detailFieldCount = computed(() => detailFieldsOrdered.value.length);

  const shouldShowDetailsViewAll = computed(() => {
    return !showAllDetails.value && detailFieldCount.value > 5;
  });

  const visibleDetailFieldSet = computed(() => {
    if (showAllDetails.value || detailFieldCount.value <= 5) {
      return new Set(detailFieldsOrdered.value);
    }
    return new Set(detailFieldsOrdered.value.slice(0, 5));
  });

  const detailGroupFieldsMap = computed(() => ({
    details: detailFieldsOrdered.value
  }));

  const fieldGroups = computed(() => {
    const ordered = detailsSectionFieldsOrdered.value;
    return ordered.length > 0 ? [{ key: 'details', label: '' }] : [];
  });

  const getGroupFields = (groupKey) => {
    const rows = detailGroupFieldsMap.value[groupKey] || [];
    return rows.filter((fieldKey) => visibleDetailFieldSet.value.has(fieldKey));
  };

  const getTaskDetailFieldDisplayValue = (record, fieldKey) => {
    if (!record || !fieldKey) return '';

    const getAssignedToDisplay = context.getAssignedToDisplay || (() => '');
    const formatDate = context.formatDate || (() => '');
    const formatPriority = context.formatPriority || (() => '');
    const formatStatus = context.formatStatus || (() => '');
    const getRelatedToDisplay = context.getRelatedToDisplay || (() => '');
    const getCustomFieldByKey = context.getCustomFieldByKey || (() => null);

    if (fieldKey === 'assignedTo') return getAssignedToDisplay(record.assignedTo) || '';
    if (fieldKey === 'dueDate' || fieldKey === 'startDate') return record[fieldKey] ? formatDate(record[fieldKey]) : '';
    if (fieldKey === 'priority') return formatPriority(record.priority) || '';
    if (fieldKey === 'status') return formatStatus(record.status) || '';
    if (fieldKey === 'estimatedHours' || fieldKey === 'actualHours') {
      return record[fieldKey] != null && record[fieldKey] !== '' ? `${record[fieldKey]}h` : '';
    }
    if (fieldKey === 'tags') {
      return Array.isArray(record.tags) && record.tags.length ? record.tags.join(', ') : '';
    }
    if (fieldKey === 'relatedTo') return getRelatedToDisplay(record) || '';

    const customField = getCustomFieldByKey(fieldKey);
    if (customField) {
      const value = record[fieldKey] ?? customField.value;
      if (Array.isArray(value)) return value.join(', ');
      if (value == null || value === '') return '';
      return stripHtmlForDetailDisplay(String(value), customField);
    }

    const rawValue = record[fieldKey];
    if (rawValue == null || rawValue === '') return '';
    if (Array.isArray(rawValue)) return rawValue.join(', ');
    if (typeof rawValue === 'object') {
      return rawValue.name || rawValue.label || rawValue.title || rawValue._id || '';
    }
    return stripHtmlForDetailDisplay(String(rawValue), { key: fieldKey });
  };

  const getTaskDetailFieldRawValue = (record, fieldKey) => {
    if (!record || !fieldKey) return null;

    if (fieldKey === 'assignedTo') {
      const assignedTo = record.assignedTo;
      if (assignedTo && typeof assignedTo === 'object') {
        return assignedTo._id || assignedTo.id || null;
      }
      return assignedTo || null;
    }

    if (fieldKey === 'dueDate' || fieldKey === 'startDate') return record[fieldKey] || null;
    if (fieldKey === 'priority' || fieldKey === 'status') return record[fieldKey] || null;
    if (fieldKey === 'estimatedHours' || fieldKey === 'actualHours') {
      return record[fieldKey] != null && record[fieldKey] !== '' ? Number(record[fieldKey]) : null;
    }
    if (fieldKey === 'tags') {
      return Array.isArray(record.tags) ? record.tags : [];
    }
    if (fieldKey === 'relatedTo') return record.relatedTo || null;

    const customField = (context.getCustomFieldByKey || (() => null))(fieldKey);
    if (customField) {
      return record[fieldKey] ?? customField.value ?? null;
    }

    return record[fieldKey] ?? null;
  };

  const resolveFieldType = (fieldKey) => {
    const customField = (context.getCustomFieldByKey || (() => null))(fieldKey);
    if (customField) {
      return (context.getCustomFieldEditableType || (() => 'text'))(fieldKey);
    }
    return (context.getFieldType || (() => 'text'))(fieldKey);
  };

  const resolveFieldOptions = (fieldKey) => {
    const customField = (context.getCustomFieldByKey || (() => null))(fieldKey);
    if (customField) {
      return (context.getCustomFieldOptions || (() => undefined))(fieldKey);
    }
    return (context.getFieldOptions || (() => undefined))(fieldKey);
  };

  const resolveFieldMin = (fieldKey) => {
    const customField = (context.getCustomFieldByKey || (() => null))(fieldKey);
    if (!customField) return undefined;
    return (context.getCustomFieldNumberMin || (() => undefined))(fieldKey);
  };

  const resolveFieldStep = (fieldKey) => {
    const customField = (context.getCustomFieldByKey || (() => null))(fieldKey);
    if (!customField) return undefined;
    return (context.getCustomFieldNumberStep || (() => undefined))(fieldKey);
  };

  const canEditDetailField = (record, fieldKey, fieldType) => {
    const isFieldEditableByConfig = context.isFieldEditableByConfig || (() => true);
    if (!isFieldEditableByConfig(fieldKey, record)) return false;

    const canEditByContext = context.canEditField || (() => false);
    if (!canEditByContext(fieldKey, record)) return false;
    return EDITABLE_FIELD_TYPES.has(fieldType);
  };

  const canOpenDetailFieldEditor = (record, fieldKey) => {
    const isFieldEditableByConfig = context.isFieldEditableByConfig || (() => true);
    if (!isFieldEditableByConfig(fieldKey, record)) return false;

    const canEditRecord = context.canEditRecord || (() => false);
    if (!canEditRecord(record)) return false;

    const openRelatedToEditor = context.openRelatedToEditor;
    if (fieldKey === 'relatedTo' && typeof openRelatedToEditor === 'function') {
      return true;
    }

    const openTagsEditor = context.openTagsEditor;
    if (fieldKey === 'tags' && typeof openTagsEditor === 'function') {
      return true;
    }

    return false;
  };

  const completedSubtasksCount = computed(() => {
    const task = resolveValue(context.task);
    return task?.subtasks?.filter((subtask) => subtask.completed).length || 0;
  });

  const allSubtasks = computed(() => {
    const task = resolveValue(context.task);
    return Array.isArray(task?.subtasks) ? task.subtasks : [];
  });

  const totalSubtasksCount = computed(() => allSubtasks.value.length);
  const isSubtasksExpandedMode = computed(() => {
    return resolveValue(context.expandedLeftSection) === 'subtasks';
  });

  const visibleSubtasks = computed(() => {
    if (isSubtasksExpandedMode.value) {
      return allSubtasks.value;
    }

    if (!showAllSubtasks.value) {
      if (totalSubtasksCount.value <= 5) return allSubtasks.value;
      return allSubtasks.value.slice(0, 5);
    }

    if (totalSubtasksCount.value >= 50) {
      return allSubtasks.value.slice(0, subtasksRenderLimit.value);
    }

    return allSubtasks.value;
  });

  const shouldShowSubtasksViewAll = computed(() => {
    if (isSubtasksExpandedMode.value) return false;
    return !showAllSubtasks.value && totalSubtasksCount.value > 5;
  });

  const canLoadMoreSubtasks = computed(() => {
    if (isSubtasksExpandedMode.value) return false;
    return showAllSubtasks.value
      && totalSubtasksCount.value >= 50
      && visibleSubtasks.value.length < totalSubtasksCount.value;
  });

  const loadMoreSubtasks = () => {
    subtasksRenderLimit.value = Math.min(subtasksRenderLimit.value + 20, totalSubtasksCount.value);
  };

  const setShowAllDetails = (value) => {
    showAllDetails.value = !!value;
  };

  const setShowAllSubtasks = (value) => {
    showAllSubtasks.value = !!value;
  };

  const resetSectionState = () => {
    showAllDetails.value = false;
    showAllSubtasks.value = false;
    subtasksRenderLimit.value = 20;
  };

  const getDetailFields = (record) => {
    const getCustomFieldByKey = context.getCustomFieldByKey || (() => null);
    const getFieldLabel = context.getFieldLabel || ((fieldKey) => fieldKey);
    const saveDetailField = context.saveDetailField || (() => {});
    const groups = fieldGroups.value;
    const orderedKeys = groups.flatMap((group) => getGroupFields(group.key));

    return orderedKeys.map((fieldKey) => {
      const customField = getCustomFieldByKey(fieldKey);
      const fieldType = resolveFieldType(fieldKey);
      const canEdit = canEditDetailField(record, fieldKey, fieldType);
      const canOpenEditor = canOpenDetailFieldEditor(record, fieldKey);
      const field = {
        key: fieldKey,
        label: customField?.label || getFieldLabel(fieldKey),
        prefixIcon: context.resolveFieldPrefixIcon?.(fieldKey, fieldType) || null,
        value: getTaskDetailFieldRawValue(record, fieldKey),
        displayValue: getTaskDetailFieldDisplayValue(record, fieldKey),
        type: fieldType,
        options: resolveFieldOptions(fieldKey),
        min: resolveFieldMin(fieldKey),
        step: resolveFieldStep(fieldKey),
        canEdit,
        canOpenEditor,
        actionLabel: canOpenEditor ? (fieldKey === 'tags' ? 'Manage' : 'Edit') : null,
        onEdit: canOpenEditor
          ? (event) => {
            if (fieldKey === 'relatedTo') {
              context.openRelatedToEditor?.(event, fieldKey, record);
              return;
            }
            if (fieldKey === 'tags') {
              context.openTagsEditor?.(event, fieldKey, record);
            }
          }
          : null,
        onSave: canEdit
          ? (value) => saveDetailField(fieldKey, value, record)
          : null
      };
      if (fieldKey === 'tags' && typeof context.getTagChipClass === 'function') {
        field.getTagChipClass = context.getTagChipClass;
      }
      if (fieldKey === 'relatedTo' && typeof context.getRelatedToRecordPath === 'function') {
        const path = context.getRelatedToRecordPath(record);
        if (path) field.recordPath = path;
      }
      return field;
    });
  };

  const getSubtasks = () => {
    return visibleSubtasks.value.map((subtask, index) => ({
      id: String(subtask?._id || subtask?.id || `${subtask?.title || 'subtask'}-${index}`),
      title: String(subtask?.title || 'Untitled subtask'),
      completed: Boolean(subtask?.completed),
      raw: subtask
    }));
  };

  const getRelatedGroups = (record) => {
    if (!record) return [];

    const getRelatedRecordId = context.getRelatedRecordId || (() => null);
    const getRelatedRecordTitle = context.getRelatedRecordTitle || (() => '');
    const getRelatedRecordMeta = context.getRelatedRecordMeta || (() => '');

    const taskEvents = resolveValue(context.taskEvents);
    const taskPeople = resolveValue(context.taskPeople);
    const taskDeals = resolveValue(context.taskDeals);
    const taskForms = resolveValue(context.taskForms);

    const groups = [];

    if (record.projectId) {
      const projectRecord = typeof record.projectId === 'object' ? record.projectId : { _id: record.projectId };
      groups.push({
        key: 'project',
        label: 'Project',
        items: [{
          id: String(getRelatedRecordId(projectRecord) || 'project'),
          title: getRelatedRecordTitle('project', projectRecord),
          meta: getRelatedRecordMeta('project', projectRecord),
          type: 'project',
          recordId: getRelatedRecordId(projectRecord)
        }]
      });
    }

    if (Array.isArray(taskEvents) && taskEvents.length > 0) {
      groups.push({
        key: 'events',
        label: 'Events',
        items: taskEvents.slice(0, 5).map((event) => ({
          id: String(event?._id || ''),
          title: getRelatedRecordTitle('event', event),
          meta: getRelatedRecordMeta('event', event),
          type: 'event',
          recordId: String(event?._id || '')
        }))
      });
    }

    if (Array.isArray(taskPeople) && taskPeople.length > 0) {
      groups.push({
        key: 'people',
        label: 'People',
        items: taskPeople.slice(0, 5).map((person) => ({
          id: String(person?._id || ''),
          title: getRelatedRecordTitle('people', person),
          meta: getRelatedRecordMeta('people', person),
          type: 'people',
          recordId: String(person?._id || '')
        }))
      });
    }

    if (Array.isArray(taskDeals) && taskDeals.length > 0) {
      groups.push({
        key: 'deals',
        label: 'Deals',
        items: taskDeals.slice(0, 5).map((deal) => ({
          id: String(deal?._id || ''),
          title: getRelatedRecordTitle('deal', deal),
          meta: getRelatedRecordMeta('deal', deal),
          type: 'deal',
          recordId: String(deal?._id || '')
        }))
      });
    } else {
      const rt = record.relatedTo;
      const rtType = rt?.type;
      const rtId = rt?.id != null && typeof rt.id === 'object' && rt.id._id != null ? rt.id._id : rt?.id;
      if (rtType === 'deal' && rtId) {
        const dealRecord = typeof rt.id === 'object' ? rt.id : { _id: rtId, name: rt.name };
        groups.push({
          key: 'deals',
          label: 'Deals',
          items: [{
            id: String(rtId),
            title: getRelatedRecordTitle('deal', dealRecord),
            meta: getRelatedRecordMeta('deal', dealRecord),
            type: 'deal',
            recordId: String(rtId)
          }]
        });
      }
    }

    if (Array.isArray(taskForms) && taskForms.length > 0) {
      groups.push({
        key: 'forms',
        label: 'Forms',
        items: taskForms.slice(0, 5).map((form) => ({
          id: String(form?._id || ''),
          title: getRelatedRecordTitle('form', form),
          meta: getRelatedRecordMeta('form', form),
          type: 'form',
          recordId: String(form?._id || '')
        }))
      });
    }

    return groups;
  };

  return {
    showAllDetails,
    showAllSubtasks,
    detailFieldCount,
    shouldShowDetailsViewAll,
    shouldShowSubtasksViewAll,
    canLoadMoreSubtasks,
    completedSubtasksCount,
    totalSubtasksCount,
    setShowAllDetails,
    setShowAllSubtasks,
    loadMoreSubtasks,
    resetSectionState,
    getDetailFields,
    getSubtasks,
    getRelatedGroups
  };
};

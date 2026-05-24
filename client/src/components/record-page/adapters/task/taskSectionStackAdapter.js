import DescriptionSection from '@/components/record-page/sections/DescriptionSection.vue';
import DetailsSection from '@/components/record-page/sections/DetailsSection.vue';
import SubtasksSection from '@/components/record-page/sections/SubtasksSection.vue';
import RelatedSection from '@/components/record-page/sections/RelatedSection.vue';
import { createTaskRecordAdapter } from '@/components/record-page/adapters/taskRecordAdapter';
import { handleTaskSectionAction, resolveTaskSectionFlags } from './taskSectionActions';

const resolveValue = (input) => {
  if (typeof input === 'function') {
    return input();
  }
  if (input && typeof input === 'object' && 'value' in input) {
    return input.value;
  }
  return input;
};

export const TASK_STACK_SECTION_KEYS = Object.freeze(['description', 'details', 'subtasks', 'related']);

export const createTaskSectionStackAdapter = (context = {}) => {
  return createTaskRecordAdapter({
    getSections: () => {
      const {
        expandedLeftSection,
        isExpandedMode,
        shouldShowDetailsViewAll,
        shouldShowSubtasksViewAll,
        canLoadMoreSubtasks,
        canLinkRecords,
        completedSubtasksCount,
        totalSubtasksCount,
        detailFieldCount
      } = resolveTaskSectionFlags(context);
      const hasDescriptionHistory = context.canViewDescriptionHistory?.(resolveValue(context.task)) === true;

      if (expandedLeftSection === 'description-history' || expandedLeftSection === 'key-fields') {
        return [];
      }

      const visibleKeys = isExpandedMode
        ? TASK_STACK_SECTION_KEYS.filter((key) => key === expandedLeftSection)
        : TASK_STACK_SECTION_KEYS;

      const L = context.sectionLabels || {
        description: 'Description',
        details: 'Details',
        related: 'Related Records',
        expand: 'Expand',
        history: 'History',
        linkRecord: 'Link record',
        addRecord: 'Add record',
        addSubtask: 'Add subtask',
        viewMore: 'View more',
        subtasksWithCount: (c, t) => `Subtasks (${c}/${t})`,
      };

      const sections = {
        description: {
          key: 'description',
          title: L.description,
          component: DescriptionSection,
          className: 'pt-4 pb-4',
          actions: [
            ...(hasDescriptionHistory ? [{ key: 'description-history', type: 'history', label: L.history }] : []),
            ...(!isExpandedMode ? [{ key: 'expand-description', type: 'expand', label: L.expand }] : [])
          ]
        },
        details: {
          key: 'details',
          title: L.details,
          component: DetailsSection,
          className: 'pt-4 pb-2',
          actions: (!isExpandedMode ? [{ key: 'expand-details', type: 'expand', label: L.expand }] : [])
        },
        subtasks: {
          key: 'subtasks',
          title: L.subtasksWithCount(completedSubtasksCount, totalSubtasksCount),
          component: SubtasksSection,
          className: 'py-3',
          actions: [
            {
              key: 'add-subtask',
              type: 'plus',
              label: L.addSubtask,
              handler: () => context.startCreateSubtask?.()
            },
            ...(canLoadMoreSubtasks ? [{ key: 'load-more-subtasks', type: 'quick', label: L.viewMore }] : []),
            ...(!isExpandedMode ? [{ key: 'expand-subtasks', type: 'expand', label: L.expand }] : [])
          ]
        },
        related: {
          key: 'related',
          title: L.related,
          component: RelatedSection,
          className: 'py-3',
          actions: [
            ...(canLinkRecords ? [{ key: 'link-record', type: 'link', label: L.linkRecord }] : []),
            ...(canLinkRecords ? [{ key: 'add-record', type: 'plus', label: L.addRecord }] : []),
            ...(!isExpandedMode ? [{ key: 'expand-related', type: 'expand', label: L.expand }] : [])
          ]
        }
      };

      return visibleKeys.map((key) => sections[key]).filter(Boolean);
    },
    invokeSectionAction: (action, payload) => {
      handleTaskSectionAction(action, payload, context);
    },
    getDescription: (record) => context.getDescription?.(record) || '',
    canEditDescription: (record) => context.canEditDescription?.(record) === true,
    saveDescription: (value, record) => context.saveDescription?.(value, record),
    canViewDescriptionHistory: (record) => context.canViewDescriptionHistory?.(record) === true,
    openDescriptionHistory: (record) => context.openDescriptionHistory?.(record),
    getDetailFields: (record) => context.getDetailFields?.(record) || [],
    shouldShowDetailsViewAll: () => Boolean(resolveValue(context.shouldShowDetailsViewAll)),
    getDetailFieldCount: () => Number(resolveValue(context.detailFieldCount) || 0),
    viewAllDetails: () => context.setShowAllDetails?.(true),
    getSubtasks: (record) => context.getSubtasks?.(record) || [],
    toggleSubtask: (subtask, record) => context.toggleSubtask?.(subtask, record),
    canEditSubtasks: (record) => context.canEditSubtasks?.(record) === true,
    updateSubtaskTitle: (subtask, title, record) => context.updateSubtaskTitle?.(subtask, title, record),
    deleteSubtask: (subtask, record) => context.deleteSubtask?.(subtask, record),
    isDeletingSubtask: () => context.isDeletingSubtask?.() === true,
    deletingSubtaskId: () => String(context.deletingSubtaskId?.() || ''),
    shouldShowSubtasksViewAll: () => Boolean(resolveValue(context.shouldShowSubtasksViewAll)),
    getSubtasksTotalCount: () => Number(resolveValue(context.totalSubtasksCount) || 0),
    viewAllSubtasks: () => context.setShowAllSubtasks?.(true),
    isViewingAllSubtasks: () => Boolean(resolveValue(context.showAllSubtasks)),
    isCreatingSubtask: () => context.isCreatingSubtask?.() === true,
    getNewSubtaskTitle: () => context.getNewSubtaskTitle?.() || '',
    setNewSubtaskTitle: (value) => context.setNewSubtaskTitle?.(value),
    isSavingNewSubtask: () => context.isSavingNewSubtask?.() === true,
    cancelCreateSubtask: () => context.cancelCreateSubtask?.(),
    saveNewSubtask: () => context.saveNewSubtask?.(),
    getRelatedGroups: (record) => context.getRelatedGroups?.(record) || [],
    openRelatedItem: (item, group, record) => context.openRelatedItem?.(item, group, record),
    canUnlinkRelated: (item, group, record, ctx) => context.canUnlinkRelated?.(item, group, record, ctx),
    onUnlinkRelated: (item, group, record, ctx) => context.onUnlinkRelated?.(item, group, record, ctx)
  });
};

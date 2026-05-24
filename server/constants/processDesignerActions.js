'use strict';

/**
 * Process designer action definitions — maps to automationActionHandlers.execute(actionType).
 * Param schemas drive the inspector (no free-form JSON).
 */
const PROCESS_DESIGNER_ACTIONS = [
  {
    actionType: 'create_task',
    label: 'Create task',
    description: 'Creates a task linked to the record that triggered this process.',
    params: [
      {
        key: 'title',
        label: 'Task title',
        type: 'text',
        required: true,
        placeholder: 'e.g. Follow up on deal'
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        required: false,
        placeholder: 'Optional task details'
      },
      {
        key: 'assignee',
        label: 'Assign to',
        type: 'select',
        required: false,
        defaultValue: 'owner',
        options: [
          { value: 'owner', label: 'Record owner' },
          { value: 'triggeredBy', label: 'User who triggered' }
        ]
      },
      {
        key: 'dueInDays',
        label: 'Due in (days)',
        type: 'number',
        required: false,
        placeholder: 'Optional'
      }
    ]
  },
  {
    actionType: 'notify_user',
    label: 'Send notification',
    description: 'Sends an in-app notification to the record owner or triggering user.',
    params: [
      {
        key: 'message',
        label: 'Message',
        type: 'textarea',
        required: true,
        placeholder: 'Notification message'
      },
      {
        key: 'recipient',
        label: 'Recipient',
        type: 'select',
        required: false,
        defaultValue: 'owner',
        options: [
          { value: 'owner', label: 'Record owner' },
          { value: 'triggeredBy', label: 'User who triggered' }
        ]
      }
    ]
  },
  {
    actionType: 'start_process',
    label: 'Start another process',
    description: 'Starts a different active process for the same record (nested invocation).',
    params: [
      {
        key: 'processId',
        label: 'Process ID',
        type: 'text',
        required: true,
        placeholder: 'MongoDB process _id'
      }
    ]
  }
];

function getProcessDesignerActions() {
  return PROCESS_DESIGNER_ACTIONS.map((a) => ({
    ...a,
    params: a.params.map((p) => ({ ...p }))
  }));
}

module.exports = {
  PROCESS_DESIGNER_ACTIONS,
  getProcessDesignerActions
};

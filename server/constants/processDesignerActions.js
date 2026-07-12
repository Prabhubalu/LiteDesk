'use strict';

/**
 * Process designer actions — grouped, generic catalog.
 * Prefer module + field mapping over per-module action sprawl.
 * Maps to automationActionHandlers.execute(actionType).
 */

const { getCustomFunctionOptions } = require('../services/processCustomFunctions');

const TARGET_OPTIONS = [
  { value: 'current', label: 'Current record' },
  { value: 'related', label: 'Related / other record' }
];

const PROCESS_ACTION_GROUPS = [
  {
    groupKey: 'records',
    label: 'Records',
    actions: [
      {
        actionType: 'create_record',
        label: 'Create record',
        description: 'Creates a new record in the module you select. Map field values from static data or the triggering record.',
        params: [
          {
            key: 'moduleKey',
            label: 'Module',
            type: 'module',
            required: true
          },
          {
            key: 'fieldValues',
            label: 'Field values',
            type: 'field_map',
            dependsOn: 'moduleKey',
            required: true
          }
        ]
      },
      {
        actionType: 'update_record',
        label: 'Update record',
        description: 'Updates fields on the current record or another record in a selected module.',
        params: [
          {
            key: 'target',
            label: 'Target',
            type: 'select',
            required: true,
            defaultValue: 'current',
            options: TARGET_OPTIONS
          },
          {
            key: 'moduleKey',
            label: 'Module',
            type: 'module',
            required: true,
            showWhen: { key: 'target', equals: 'related' }
          },
          {
            key: 'recordId',
            label: 'Record ID',
            type: 'text',
            required: false,
            placeholder: 'Leave empty for current; or use {{trigger.id}}',
            showWhen: { key: 'target', equals: 'related' }
          },
          {
            key: 'fieldValues',
            label: 'Fields to update',
            type: 'field_map',
            dependsOn: 'moduleKey',
            required: true
          }
        ]
      },
      {
        actionType: 'delete_record',
        label: 'Delete record',
        description: 'Moves a record to trash (or archives) when conditions are met.',
        params: [
          {
            key: 'target',
            label: 'Target',
            type: 'select',
            required: true,
            defaultValue: 'current',
            options: TARGET_OPTIONS
          },
          {
            key: 'moduleKey',
            label: 'Module',
            type: 'module',
            required: true,
            showWhen: { key: 'target', equals: 'related' }
          },
          {
            key: 'recordId',
            label: 'Record ID',
            type: 'text',
            required: false,
            placeholder: 'Leave empty for current record',
            showWhen: { key: 'target', equals: 'related' }
          }
        ]
      },
      {
        actionType: 'create_task',
        label: 'Create task',
        description: 'Shortcut: creates a Task linked to the triggering record.',
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
      }
    ]
  },
  {
    groupKey: 'communication',
    label: 'Communication',
    actions: [
      {
        actionType: 'notify_user',
        label: 'Record alert',
        description: 'In-app alert/notification to the record owner or triggering user.',
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
        actionType: 'send_email',
        label: 'Email',
        description: 'Sends an email via the tenant CRM email provider to the trigger record, owner, triggering user, or a custom address.',
        params: [
          {
            key: 'to',
            label: 'To',
            type: 'select',
            required: true,
            defaultValue: 'record',
            options: [
              { value: 'record', label: 'Trigger record (email field)' },
              { value: 'owner', label: 'Record owner' },
              { value: 'triggeredBy', label: 'User who triggered' },
              { value: 'custom', label: 'Custom address' }
            ]
          },
          {
            key: 'customEmail',
            label: 'Custom email',
            type: 'text',
            required: false,
            placeholder: 'name@example.com',
            showWhen: { key: 'to', equals: 'custom' }
          },
          {
            key: 'bodyMode',
            label: 'Content',
            type: 'select',
            required: true,
            defaultValue: 'custom',
            options: [
              { value: 'custom', label: 'Custom message' },
              { value: 'template', label: 'Email template' }
            ]
          },
          {
            key: 'templateId',
            label: 'Email template',
            type: 'email_template',
            required: true,
            showWhen: { key: 'bodyMode', equals: 'template' }
          },
          {
            key: 'subject',
            label: 'Subject',
            type: 'text',
            required: false,
            placeholder: 'Email subject (optional when using a template)'
          },
          {
            key: 'body',
            label: 'Body',
            type: 'textarea',
            required: true,
            placeholder: 'Plain text or simple HTML',
            showWhen: { key: 'bodyMode', equals: 'custom' }
          }
        ]
      },
      {
        actionType: 'send_sms',
        label: 'SMS',
        description: 'Sends an SMS via the configured messaging provider (feature-flagged).',
        params: [
          {
            key: 'to',
            label: 'To',
            type: 'select',
            required: true,
            defaultValue: 'owner',
            options: [
              { value: 'owner', label: 'Record owner' },
              { value: 'triggeredBy', label: 'User who triggered' },
              { value: 'custom', label: 'Custom phone (E.164)' }
            ]
          },
          {
            key: 'customPhone',
            label: 'Custom phone',
            type: 'text',
            required: false,
            placeholder: '+15551234567',
            showWhen: { key: 'to', equals: 'custom' }
          },
          {
            key: 'message',
            label: 'Message',
            type: 'textarea',
            required: true,
            placeholder: 'SMS body (max ~160 chars)'
          }
        ]
      },
      {
        actionType: 'send_whatsapp',
        label: 'WhatsApp',
        description: 'Sends a WhatsApp message via the configured provider (feature-flagged).',
        params: [
          {
            key: 'to',
            label: 'To',
            type: 'select',
            required: true,
            defaultValue: 'owner',
            options: [
              { value: 'owner', label: 'Record owner' },
              { value: 'triggeredBy', label: 'User who triggered' },
              { value: 'custom', label: 'Custom phone (E.164)' }
            ]
          },
          {
            key: 'customPhone',
            label: 'Custom phone',
            type: 'text',
            required: false,
            placeholder: '+15551234567',
            showWhen: { key: 'to', equals: 'custom' }
          },
          {
            key: 'message',
            label: 'Message',
            type: 'textarea',
            required: true
          },
          {
            key: 'templateId',
            label: 'Template ID',
            type: 'text',
            required: false,
            placeholder: 'Optional approved template'
          }
        ]
      },
      {
        actionType: 'mobile_push',
        label: 'Mobile push',
        description: 'Sends a web/mobile push notification to the recipient’s active subscriptions.',
        params: [
          {
            key: 'recipient',
            label: 'Recipient',
            type: 'select',
            required: true,
            defaultValue: 'owner',
            options: [
              { value: 'owner', label: 'Record owner' },
              { value: 'triggeredBy', label: 'User who triggered' }
            ]
          },
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'message', label: 'Message', type: 'textarea', required: true }
        ]
      },
      {
        actionType: 'slack_notification',
        label: 'Slack',
        description: 'Posts a message to a Slack Incoming Webhook URL.',
        params: [
          {
            key: 'webhookUrl',
            label: 'Incoming webhook URL',
            type: 'text',
            required: true,
            placeholder: 'https://hooks.slack.com/services/…'
          },
          { key: 'message', label: 'Message', type: 'textarea', required: true }
        ]
      }
    ]
  },
  {
    groupKey: 'integrations',
    label: 'Integrations',
    actions: [
      {
        actionType: 'start_process',
        label: 'Trigger another process',
        description: 'Starts a different active process for the same record.',
        params: [
          {
            key: 'processId',
            label: 'Process ID',
            type: 'text',
            required: true,
            placeholder: 'MongoDB process _id'
          }
        ]
      },
      {
        actionType: 'webhook',
        label: 'Webhook',
        description: 'Sends workflow context to an external HTTPS URL.',
        params: [
          { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://…' },
          {
            key: 'method',
            label: 'Method',
            type: 'select',
            defaultValue: 'POST',
            options: [
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' }
            ]
          },
          {
            key: 'bodyMode',
            label: 'Payload',
            type: 'select',
            defaultValue: 'context',
            options: [
              { value: 'context', label: 'Process context (entity + org)' },
              { value: 'custom', label: 'Custom JSON' }
            ]
          },
          {
            key: 'customBody',
            label: 'Custom JSON body',
            type: 'textarea',
            required: false,
            placeholder: '{"key":"value"}',
            showWhen: { key: 'bodyMode', equals: 'custom' }
          }
        ]
      },
      {
        actionType: 'rest_api',
        label: 'REST API',
        description: 'Calls an external REST API and stores the response status.',
        params: [
          { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://…' },
          {
            key: 'method',
            label: 'Method',
            type: 'select',
            defaultValue: 'GET',
            options: [
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'PATCH', label: 'PATCH' }
            ]
          },
          {
            key: 'bodyMode',
            label: 'Payload',
            type: 'select',
            defaultValue: 'none',
            options: [
              { value: 'none', label: 'None' },
              { value: 'context', label: 'Process context' },
              { value: 'custom', label: 'Custom JSON' }
            ]
          },
          {
            key: 'customBody',
            label: 'Custom JSON body',
            type: 'textarea',
            required: false,
            placeholder: '{"key":"value"}',
            showWhen: { key: 'bodyMode', equals: 'custom' }
          },
          {
            key: 'headersJson',
            label: 'Headers (JSON)',
            type: 'textarea',
            required: false,
            placeholder: '{"Authorization":"Bearer …"}'
          }
        ]
      },
      {
        actionType: 'custom_function',
        label: 'Custom function',
        description: 'Runs a whitelisted server-side function (no arbitrary code).',
        params: [
          {
            key: 'functionKey',
            label: 'Function',
            type: 'select',
            required: true,
            options: [] // filled by getProcessDesignerActionGroups()
          },
          {
            key: 'argsJson',
            label: 'Arguments (JSON)',
            type: 'textarea',
            required: false,
            placeholder: '{"from":"a","to":"b"}'
          }
        ]
      }
    ]
  },
  {
    groupKey: 'data',
    label: 'Data & documents',
    actions: [
      {
        actionType: 'run_analytics_report',
        label: 'Run analytics report',
        description: 'Executes a published analytics report and optionally attaches CSV to the record.',
        params: [
          {
            key: 'reportId',
            label: 'Report ID',
            type: 'text',
            required: true,
            placeholder: 'MongoDB analytics report _id'
          },
          {
            key: 'attachToRecord',
            label: 'Attach CSV to record',
            type: 'select',
            required: false,
            defaultValue: 'true',
            options: [
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No — execute only' }
            ]
          }
        ]
      },
      {
        actionType: 'fetch_records',
        label: 'Fetch records',
        description: 'Loads records from a module into a process variable for later steps.',
        params: [
          { key: 'moduleKey', label: 'Module', type: 'module', required: true },
          {
            key: 'variableName',
            label: 'Store as variable',
            type: 'text',
            required: true,
            placeholder: 'records',
            defaultValue: 'records'
          },
          {
            key: 'limitMode',
            label: 'How many',
            type: 'select',
            required: false,
            defaultValue: 'count',
            options: [
              { value: 'all', label: 'All matching records' },
              { value: 'count', label: 'Limited number' }
            ]
          },
          {
            key: 'limit',
            label: 'Max records',
            type: 'number',
            required: false,
            defaultValue: 50,
            placeholder: '50',
            showWhen: { key: 'limitMode', equals: 'count' }
          },
          {
            key: 'filterGroup',
            label: 'Match records when',
            type: 'condition_group',
            required: false,
            hint: 'Leave empty to fetch any records in the module (still respects limit).'
          }
        ]
      },
      {
        actionType: 'fetch_related_records',
        label: 'Fetch related records',
        description: 'Loads related records for the current (or specified) record via platform relationships.',
        params: [
          {
            key: 'moduleKey',
            label: 'Source module',
            type: 'module',
            required: false,
            hint: 'Defaults to the process module / triggering record.'
          },
          {
            key: 'recordId',
            label: 'Source record ID',
            type: 'text',
            required: false,
            placeholder: 'Leave empty for current record'
          },
          {
            key: 'relationshipKey',
            label: 'Relationship key',
            type: 'text',
            required: false,
            placeholder: 'Optional — filter to one relationship'
          },
          {
            key: 'variableName',
            label: 'Store as variable',
            type: 'text',
            required: true,
            placeholder: 'related',
            defaultValue: 'related'
          }
        ]
      },
      {
        actionType: 'set_variable',
        label: 'Set variable',
        description: 'Stores a temporary value in the process data bag for later steps.',
        params: [
          { key: 'name', label: 'Variable name', type: 'text', required: true, placeholder: 'myVar' },
          { key: 'value', label: 'Value', type: 'text', required: true }
        ]
      },
      {
        actionType: 'create_audit_entry',
        label: 'Create audit entry',
        description: 'Records an audit note on the process execution for compliance.',
        params: [{ key: 'message', label: 'Message', type: 'textarea', required: true }]
      }
    ]
  },
  {
    groupKey: 'live_chat',
    label: 'Live chat',
    actions: [
      {
        actionType: 'live_chat_create_case',
        label: 'Create Helpdesk case',
        description: 'Creates a case from the live chat session (session reference only).',
        params: [
          {
            key: 'title',
            label: 'Case title',
            type: 'text',
            required: false,
            placeholder: 'Optional — defaults to visitor + session key'
          }
        ]
      },
      {
        actionType: 'live_chat_link_case',
        label: 'Link existing case',
        description: 'Links an existing Helpdesk case to the live chat session.',
        params: [
          {
            key: 'caseId',
            label: 'Case record ID',
            type: 'text',
            required: true,
            placeholder: 'MongoDB case _id'
          }
        ]
      },
      {
        actionType: 'live_chat_create_lead',
        label: 'Create Sales lead',
        description: 'Creates or associates a Sales lead from the visitor.',
        params: []
      },
      {
        actionType: 'live_chat_link_person',
        label: 'Link existing person',
        description: 'Links an existing Sales person to the live chat session.',
        params: [
          {
            key: 'personId',
            label: 'Person record ID',
            type: 'text',
            required: true,
            placeholder: 'MongoDB people _id'
          }
        ]
      }
    ]
  }
];

function cloneParams(params) {
  return (params || []).map((p) => ({
    ...p,
    options: p.options ? p.options.map((o) => ({ ...o })) : undefined,
    showWhen: p.showWhen ? { ...p.showWhen } : undefined
  }));
}

function getProcessDesignerActionGroups() {
  const customFnOptions = getCustomFunctionOptions();
  return PROCESS_ACTION_GROUPS.map((g) => ({
    groupKey: g.groupKey,
    label: g.label,
    actions: g.actions.map((a) => {
      const params = cloneParams(a.params);
      if (a.actionType === 'custom_function') {
        const fnParam = params.find((p) => p.key === 'functionKey');
        if (fnParam) {
          fnParam.type = 'select';
          fnParam.options = customFnOptions;
          if (customFnOptions[0] && fnParam.defaultValue === undefined) {
            fnParam.defaultValue = customFnOptions[0].value;
          }
        }
      }
      return {
        ...a,
        available: a.available !== false,
        params
      };
    })
  }));
}

/** Flat list (backward compatible for clients that ignore groups). */
function getProcessDesignerActions() {
  return getProcessDesignerActionGroups().flatMap((g) =>
    g.actions.map((a) => ({
      ...a,
      groupKey: g.groupKey,
      groupLabel: g.label
    }))
  );
}

module.exports = {
  PROCESS_ACTION_GROUPS,
  getProcessDesignerActionGroups,
  getProcessDesignerActions
};

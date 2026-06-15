const DEFAULT_TASK_TYPE = 'general_task';

const DEFAULT_TASK_TYPE_OPTIONS = [
  { value: 'general_task', label: 'General Task', enabled: true, color: '#6B7280' },
  { value: 'follow_up', label: 'Follow-up', enabled: true, color: '#F59E0B' },
  { value: 'call', label: 'Call', enabled: true, color: '#2563EB' },
  { value: 'email', label: 'Email', enabled: true, color: '#6366F1' },
  { value: 'meeting', label: 'Meeting', enabled: true, color: '#8B5CF6' },
  { value: 'support', label: 'Support', enabled: true, color: '#0EA5E9' },
  { value: 'research', label: 'Research', enabled: true, color: '#06B6D4' },
  { value: 'documentation', label: 'Documentation', enabled: true, color: '#14B8A6' },
  { value: 'internal', label: 'Internal', enabled: true, color: '#64748B' },
  { value: 'bug', label: 'Bug', enabled: true, color: '#DC2626' },
  { value: 'enhancement', label: 'Enhancement', enabled: true, color: '#22C55E' },
  { value: 'feature_request', label: 'Feature Request', enabled: true, color: '#A855F7' },
  { value: 'usability', label: 'Usability Issue', enabled: true, color: '#EC4899' },
];

const TASK_TYPE_LABELS = Object.freeze(
  Object.fromEntries(DEFAULT_TASK_TYPE_OPTIONS.map((opt) => [opt.value, opt.label]))
);

module.exports = {
  DEFAULT_TASK_TYPE,
  DEFAULT_TASK_TYPE_OPTIONS,
  TASK_TYPE_LABELS,
};

/**
 * Unit tests for event status lifecycle domain.
 */
const {
  mergeStatusValues,
  resolveStatusCategory,
  validateConfigurableValues,
  isStatusConfigurableType,
  findDefaultForCategory,
  getActiveValues,
  SYSTEM_STATUS_VALUES,
} = require('../eventStatus');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function run() {
  assert(isStatusConfigurableType('Meeting'), 'Meeting configurable');
  assert(isStatusConfigurableType('MEETING'), 'MEETING configurable');
  assert(isStatusConfigurableType('Field Sales Beat'), 'FSB configurable');
  assert(!isStatusConfigurableType('Internal Audit'), 'Audit not configurable');

  assert(resolveStatusCategory('Planned') === 'OPEN');
  assert(resolveStatusCategory('Scheduled') === 'OPEN');
  assert(resolveStatusCategory('Completed') === 'DONE');
  assert(resolveStatusCategory('Cancelled') === 'CANCELLED');
  assert(resolveStatusCategory('No Show') === 'CANCELLED');

  // Meeting seeds
  const meeting = mergeStatusValues([], 'MEETING');
  const meetingActive = getActiveValues(meeting);
  assert(
    meetingActive.map((v) => v.label).join(',') === 'Scheduled,Completed,Cancelled,No Show',
    `Meeting active labels: ${meetingActive.map((v) => v.label).join(',')}`
  );
  const defOpen = findDefaultForCategory(meeting, 'OPEN');
  assert(defOpen?.label === 'Scheduled', 'default open is Scheduled for Meeting');
  const defCancel = findDefaultForCategory(meeting, 'CANCELLED');
  assert(defCancel?.label === 'Cancelled', 'default cancelled is Cancelled not No Show');

  // Field Sales / generic still Planned
  const generic = mergeStatusValues([], 'FIELD_SALES_BEAT');
  assert(findDefaultForCategory(generic, 'OPEN')?.label === 'Planned', 'FSB default Planned');

  const withCustom = mergeStatusValues(
    [
      {
        key: 'follow_up',
        label: 'Follow-up needed',
        category: 'OPEN',
        color: '#f59e0b',
        order: 50,
        isDefault: false,
        isSystem: false,
      },
    ],
    'MEETING'
  );
  assert(withCustom.some((v) => v.label === 'Follow-up needed'), 'custom merged');
  assert(resolveStatusCategory('No Show', withCustom) === 'CANCELLED');

  const okVals = validateConfigurableValues([], 'MEETING');
  assert(okVals.ok === true, 'empty input still gets meeting system seeds');

  const invalidDup = validateConfigurableValues(
    [
      ...SYSTEM_STATUS_VALUES,
      { key: 'x1', label: 'Planned', category: 'OPEN' },
    ],
    'FIELD_SALES_BEAT'
  );
  assert(invalidDup.ok === false, 'duplicate labels rejected');

  console.log('eventStatus.domain.test.js: all passed');
}

run();

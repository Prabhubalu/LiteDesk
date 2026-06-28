const { DateTime } = require('luxon');
const Event = require('../models/Event');
const User = require('../models/User');
const { generateBookingSlots } = require('./businessHoursEngine');
const { resolveScheduleForBookingConfig, getDisplayTimezone } = require('./appointmentBusinessHoursService');
const { getMemberExternalBusy, slotOverlapsBusyIntervals } = require('./appointmentExternalCalendarService');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Per-request cache: memberId -> busy intervals for the day */
const memberExternalBusyCache = new Map();

async function getMemberExternalBusyForRange(
  organizationId,
  memberId,
  rangeStart,
  rangeEnd,
  teamMeetingType
) {
  const key = `${organizationId}:${memberId}:${rangeStart.toISOString()}:${teamMeetingType || ''}`;
  if (memberExternalBusyCache.has(key)) return memberExternalBusyCache.get(key);

  const intervals = await getMemberExternalBusy(
    organizationId,
    memberId,
    rangeStart,
    rangeEnd,
    teamMeetingType
  );
  memberExternalBusyCache.set(key, intervals);
  return intervals;
}

async function memberHasConflict(
  organizationId,
  memberId,
  start,
  end,
  externalBusyForDay,
  teamMeetingType,
  excludeEventId = null
) {
  const conflictQuery = {
    organizationId,
    assignedTo: memberId,
    deletedAt: null,
    status: { $ne: 'Cancelled' },
    startDateTime: { $lt: end },
    endDateTime: { $gt: start }
  };
  if (excludeEventId) conflictQuery._id = { $ne: excludeEventId };
  const conflict = await Event.findOne(conflictQuery).select('_id').lean();
  if (conflict) return true;

  const busy =
    externalBusyForDay ??
    (await getMemberExternalBusyForRange(
      organizationId,
      memberId,
      new Date(start.getTime() - DAY_MS),
      new Date(end.getTime() + DAY_MS),
      teamMeetingType
    ));
  return slotOverlapsBusyIntervals(start, end, busy);
}

/**
 * Members free for a given slot window.
 */
async function getAvailableMembersForSlot(teamConfig, start, end, dayExternalBusyByMember) {
  const members = (teamConfig.memberUserIds || []).map((id) => String(id));
  if (!members.length) return [];

  const available = [];
  for (const memberId of members) {
    const externalBusy = dayExternalBusyByMember?.get(memberId);
    const busy = await memberHasConflict(
      teamConfig.organizationId,
      memberId,
      start,
      end,
      externalBusy,
      teamConfig.meetingType
    );
    if (!busy) available.push(memberId);
  }
  return available;
}

/**
 * Union of slots where at least one team member is available.
 */
async function getTeamSlotsForDate(teamConfig, dateStr) {
  const members = (teamConfig.memberUserIds || []).map((id) => String(id));
  if (!members.length) return [];

  const resolved = await resolveScheduleForBookingConfig(
    teamConfig,
    teamConfig.organizationId,
    teamConfig.assignedTo
  );
  const timezone = getDisplayTimezone(teamConfig, resolved);
  const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf('day');
  if (!dayStart.isValid) {
    throw new Error('Invalid date');
  }

  const now = new Date();
  const rangeStart = dayStart.toJSDate();
  const rangeEnd = dayStart.plus({ days: 1 }).toJSDate();
  const rawSlots = generateBookingSlots(resolved.schedule, {
    rangeStart,
    rangeEnd,
    slotDurationMinutes: teamConfig.slotDurationMinutes || 30,
    bufferMinutes: teamConfig.bufferMinutes || 0
  });
  const results = [];
  const dayEnd = rangeEnd;

  memberExternalBusyCache.clear();
  const dayExternalBusyByMember = new Map();
  await Promise.all(
    members.map(async (memberId) => {
      const busy = await getMemberExternalBusyForRange(
        teamConfig.organizationId,
        memberId,
        rangeStart,
        dayEnd,
        teamConfig.meetingType
      );
      dayExternalBusyByMember.set(memberId, busy);
    })
  );

  for (const slot of rawSlots) {
    if (slot.start < now) continue;
    const freeMembers = await getAvailableMembersForSlot(
      teamConfig,
      slot.start,
      slot.end,
      dayExternalBusyByMember
    );
    if (freeMembers.length > 0) {
      results.push({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        timezone,
        availableMemberCount: freeMembers.length
      });
    }
  }

  return results;
}

/**
 * Pick assignee for a team booking (mutates roundRobinIndex on config doc when strategy is round_robin).
 */
async function pickTeamAssignee(teamConfig, startISO) {
  const members = (teamConfig.memberUserIds || []).map((id) => String(id));
  if (!members.length) {
    const err = new Error('Team has no members configured.');
    err.statusCode = 400;
    throw err;
  }

  const start = new Date(startISO);
  const end = new Date(
    start.getTime() + (teamConfig.slotDurationMinutes || 30) * 60 * 1000
  );

  const available = await getAvailableMembersForSlot(teamConfig, start, end);
  if (!available.length) {
    const err = new Error('This time slot is no longer available.');
    err.code = 'SLOT_UNAVAILABLE';
    err.statusCode = 409;
    throw err;
  }

  if (teamConfig.assignmentStrategy === 'first_available') {
    return available[0];
  }

  const startIdx = teamConfig.roundRobinIndex || 0;
  for (let i = 0; i < members.length; i++) {
    const candidate = members[(startIdx + i) % members.length];
    if (available.includes(candidate)) {
      teamConfig.roundRobinIndex = (startIdx + i + 1) % members.length;
      await teamConfig.save();
      return candidate;
    }
  }

  return available[0];
}

async function loadTeamMembersPublic(memberUserIds) {
  if (!memberUserIds?.length) return [];
  const users = await User.find({ _id: { $in: memberUserIds } })
    .select('firstName lastName username avatar')
    .lean();
  return users.map((u) => ({
    id: u._id,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || 'Team member',
    avatar: u.avatar || null
  }));
}

module.exports = {
  getTeamSlotsForDate,
  getAvailableMembersForSlot,
  pickTeamAssignee,
  loadTeamMembersPublic,
  memberHasConflict
};

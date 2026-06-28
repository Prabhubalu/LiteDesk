'use strict';

const {
  getGoogleFreeBusyIntervals,
  slotOverlapsBusyIntervals
} = require('./appointmentCalendarService');
const { getMicrosoftFreeBusyIntervals } = require('./appointmentMicrosoftCalendarService');

/**
 * External busy intervals for a booking config based on meeting type / connected calendars.
 */
async function getExternalBusyIntervals(bookingConfig, rangeStart, rangeEnd) {
  const meetingType = bookingConfig?.meetingType || 'offline';
  const intervals = [];

  if (meetingType === 'google_meet' && bookingConfig?.googleCalendar?.encryptedRefreshToken) {
    intervals.push(...(await getGoogleFreeBusyIntervals(bookingConfig, rangeStart, rangeEnd)));
  }
  if (meetingType === 'ms_teams' && bookingConfig?.microsoftCalendar?.encryptedRefreshToken) {
    intervals.push(...(await getMicrosoftFreeBusyIntervals(bookingConfig, rangeStart, rangeEnd)));
  }

  return intervals;
}

/**
 * Busy for a team member's personal booking page (uses their config + team meeting type).
 */
async function getMemberExternalBusy(organizationId, memberId, rangeStart, rangeEnd, teamMeetingType) {
  const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
  const userConfig = await AppointmentBookingConfig.findOne({
    organizationId,
    ownerType: 'user',
    assignedTo: memberId
  }).lean();

  if (!userConfig) return [];

  const config = { ...userConfig, meetingType: teamMeetingType || userConfig.meetingType };
  return getExternalBusyIntervals(config, rangeStart, rangeEnd);
}

module.exports = {
  getExternalBusyIntervals,
  getMemberExternalBusy,
  slotOverlapsBusyIntervals
};

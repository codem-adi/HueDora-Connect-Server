import {
  REACTION_THRESHOLD_WORKING_HOURS,
  WORKING_HOURS,
} from '../config/constants.js';

const WORK_START_MINUTES = WORKING_HOURS.START * 60;
const WORK_END_MINUTES = WORKING_HOURS.END * 60;
const REACTION_THRESHOLD_MINUTES = REACTION_THRESHOLD_WORKING_HOURS * 60;

function cloneDate(date) {
  return new Date(date.getTime());
}

function getMinutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function isWithinWorkingHours(date) {
  const day = date.getDay();
  const minutes = getMinutesOfDay(date);
  if (day === 0) return false;
  if (minutes < WORK_START_MINUTES || minutes >= WORK_END_MINUTES) return false;
  return true;
}

export function isOffHoursSubmission(date) {
  return !isWithinWorkingHours(date);
}

export function isWeekendAttentionSubmission(date) {
  const day = date.getDay();
  const minutes = getMinutesOfDay(date);
  if (day === 0) return true;
  if (day === 6 && (minutes >= WORK_END_MINUTES || minutes < WORK_START_MINUTES)) {
    return true;
  }
  return false;
}

export function captureSubmissionTracking(submittedAt = new Date()) {
  const at = new Date(submittedAt);
  return {
    submittedAt: at,
    submittedOffHours: isOffHoursSubmission(at),
    submittedWeekendAttention: isWeekendAttentionSubmission(at),
  };
}

export function getCampSubmittedAt(camp) {
  const submittedAt = camp.submittedAt || camp.createdAt;
  return submittedAt ? new Date(submittedAt) : new Date();
}

export function getWorkingMinutesBetween(startDate, endDate) {
  if (!startDate || !endDate || endDate <= startDate) return 0;

  let total = 0;
  let cursor = cloneDate(startDate);
  const end = cloneDate(endDate);

  while (cursor < end) {
    const day = cursor.getDay();
    if (day !== 0) {
      const dayStart = cloneDate(cursor);
      dayStart.setHours(WORKING_HOURS.START, 0, 0, 0);
      const dayEnd = cloneDate(cursor);
      dayEnd.setHours(WORKING_HOURS.END, 0, 0, 0);

      const windowStart = cursor > dayStart ? cursor : dayStart;
      const windowEnd = end < dayEnd ? end : dayEnd;

      if (windowStart < windowEnd) {
        total += Math.floor((windowEnd - windowStart) / 60000);
      }
    }

    const nextDay = cloneDate(cursor);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    cursor = nextDay;
  }

  return total;
}

export function requiresReaction(camp) {
  if (camp.status !== 'pending_review') return false;
  const submittedAt = getCampSubmittedAt(camp);
  const workingMinutes = getWorkingMinutesBetween(submittedAt, new Date());
  return workingMinutes >= REACTION_THRESHOLD_MINUTES;
}

export function getReactionAlert(camp) {
  const submittedAt = getCampSubmittedAt(camp);
  const isPending = camp.status === 'pending_review';
  const offHoursSubmission = camp.submittedOffHours ?? isOffHoursSubmission(submittedAt);
  const weekendAttention = camp.submittedWeekendAttention ?? isWeekendAttentionSubmission(submittedAt);
  const workingMinutesWaiting = isPending
    ? getWorkingMinutesBetween(submittedAt, new Date())
    : 0;
  const reactionRequired = isPending && workingMinutesWaiting >= REACTION_THRESHOLD_MINUTES;

  let alertLevel = 'none';
  let alertReason = '';

  if (reactionRequired) {
    alertLevel = 'reaction_required';
    const hours = Math.floor(workingMinutesWaiting / 60);
    const minutes = workingMinutesWaiting % 60;
    alertReason = `Awaiting approval for ${hours}h ${minutes}m of working time (8 AM – 8 PM)`;
  } else if (isPending && weekendAttention) {
    alertLevel = 'weekend_attention';
    alertReason = 'Submitted on Sunday or outside Saturday working hours — needs extra follow-up';
  } else if (isPending && offHoursSubmission) {
    alertLevel = 'off_hours';
    alertReason = 'Submitted outside working hours (8 AM – 8 PM)';
  }

  return {
    submittedAt,
    offHoursSubmission,
    weekendAttention,
    workingMinutesWaiting,
    workingHoursWaiting: Math.round((workingMinutesWaiting / 60) * 10) / 10,
    reactionRequired,
    alertLevel,
    alertReason,
  };
}

export function matchesAlertFilter(camp, query = {}) {
  const alert = getReactionAlert(camp);
  if (query.reactionRequired === '1' || query.reactionRequired === 'true') {
    return alert.reactionRequired;
  }
  if (query.offHours === '1' || query.offHours === 'true') {
    return camp.status === 'pending_review' && alert.offHoursSubmission;
  }
  if (query.weekendAttention === '1' || query.weekendAttention === 'true') {
    return camp.status === 'pending_review' && alert.weekendAttention;
  }
  return true;
}

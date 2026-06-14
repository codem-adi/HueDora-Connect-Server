import Camp from '../models/Camp.js';
import { STATUS_TRANSITIONS } from '../config/constants.js';
import { getReactionAlert } from './reactionHelpers.js';
import { escapeRegex, trimValue } from './trimInput.js';

export function resolveClinicHospitalName(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatMinutes(totalMinutes) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function computeEndTime(startTime, durationHours) {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes == null || !durationHours) return '';
  return formatMinutes(startMinutes + durationHours * 60);
}

export function getCampEndDateTime(camp) {
  const end = new Date(camp.campDate);
  const endTime = camp.endTime || computeEndTime(camp.startTime, camp.durationHours);
  const endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes == null) {
    end.setHours(23, 59, 59, 999);
    return end;
  }

  end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  return end;
}

export function getCampTimeFrameLabel(camp) {
  const hours = camp.durationHours || 0;
  const start = camp.startTime || '--:--';
  const end = camp.endTime || computeEndTime(camp.startTime, camp.durationHours) || '--:--';
  return hours ? `${hours} hr camp (${start} - ${end})` : `${start} - ${end}`;
}

export function canTransition(currentStatus, nextStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export const EDITABLE_CAMP_STATUSES = ['pending_review', 'approved', 'rejected'];

export function isCampEditable(status) {
  return EDITABLE_CAMP_STATUSES.includes(status);
}

export async function generateCampId(campDate = new Date()) {
  const date = new Date(campDate);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `${yy}-${mm}-`;
  const regex = new RegExp(`^${escapeRegex(prefix)}\\d{4}$`);

  const latest = await Camp.find({ campId: regex })
    .sort({ campId: -1 })
    .limit(1)
    .select('campId');

  const nextSequence = latest.length
    ? Number(latest[0].campId.split('-')[2]) + 1
    : 1;

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

export function parseLocalDateInput(value) {
  const text = trimValue(value);
  if (!text) return null;

  let year;
  let month;
  let day;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function buildDateRangeFilter(query) {
  const dateFrom = trimValue(query.dateFrom);
  const dateTo = trimValue(query.dateTo);

  if (!dateFrom && !dateTo) return {};

  const range = {};
  if (dateFrom) {
    const from = parseLocalDateInput(dateFrom);
    if (from) {
      from.setHours(0, 0, 0, 0);
      range.$gte = from;
    }
  }
  if (dateTo) {
    const to = parseLocalDateInput(dateTo);
    if (to) {
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
  }

  return Object.keys(range).length ? { campDate: range } : {};
}

export function buildCampFilter(query) {
  const filter = { deletedAt: null, ...buildDateRangeFilter(query) };

  const status = trimValue(query.status);
  const client = trimValue(query.client);
  const state = trimValue(query.state);
  const campaignType = trimValue(query.campaignType);
  const campaign = trimValue(query.campaign);
  const search = trimValue(query.search);

  if (status) filter.status = status;
  if (client) filter.client = client;
  if (state) filter.state = state;
  if (campaignType) filter.campaignType = campaignType;
  if (campaign) filter.campaign = campaign;
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { campId: regex },
      { doctorName: regex },
      { hospitalName: regex },
      { clinicName: regex },
      { city: regex },
      { clientName: regex },
    ];
  }

  return filter;
}

export function withCampSchedule(camp) {
  const obj = camp.toObject ? camp.toObject() : { ...camp };
  if (!obj.endTime && obj.startTime && obj.durationHours) {
    obj.endTime = computeEndTime(obj.startTime, obj.durationHours);
  }
  obj.timeFrame = getCampTimeFrameLabel(obj);
  obj.endsAt = getCampEndDateTime(obj);
  obj.isOverdue = obj.status === 'approved' && obj.endsAt && new Date(obj.endsAt) <= new Date();
  return { ...obj, ...getReactionAlert(obj) };
}

export function isCampOverdue(camp) {
  return withCampSchedule(camp).isOverdue;
}

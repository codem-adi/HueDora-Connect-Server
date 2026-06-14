import { normalizeCampName } from '../config/campNames.js';
import { parseLocalDateInput, resolveClinicHospitalName } from './campHelpers.js';

export const CAMP_IMPORT_FIELDS = [
  { key: 'clientName', label: 'Client Name', required: true },
  { key: 'campaignName', label: 'Camp Name', required: false },
  { key: 'campaignType', label: 'Division / BU', required: false },
  { key: 'doctorName', label: 'Doctor Name', required: false },
  { key: 'doctorCode', label: 'Doctor Code', required: false },
  { key: 'scCode', label: 'SC Code', required: false },
  { key: 'mslNo', label: 'MSL No', required: false },
  { key: 'speciality', label: 'Speciality', required: false },
  { key: 'hospitalName', label: 'Clinic / Hospital', required: false },
  { key: 'campAddress', label: 'Camp Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'pincode', label: 'Pincode', required: false },
  { key: 'campDate', label: 'Camp Date', required: true },
  { key: 'startTime', label: 'Start Time', required: false },
  { key: 'durationHours', label: 'Duration (Hours)', required: false },
  { key: 'endTime', label: 'End Time', required: false },
  { key: 'expectedPatients', label: 'Expected Patients', required: false },
  { key: 'actualPatients', label: 'Actual Patients', required: false },
  { key: 'fieldPersonName', label: 'Field Person', required: false },
  { key: 'fieldPersonPhone', label: 'Field Phone', required: false },
  { key: 'technicianName', label: 'Technician', required: false },
  { key: 'remarks', label: 'Remarks', required: false },
];

const HEADER_ALIASES = {
  clientName: ['client name', 'client', 'company', 'pharma', 'pharma client'],
  campaignName: ['campaign name', 'campaign', 'program name'],
  campaignType: ['campaign type', 'type', 'screening type', 'test type'],
  doctorName: ['doctor name', 'dr name', 'doctor', 'physician', 'hcp name'],
  doctorCode: ['doctor code', 'dr code', 'hcp code'],
  scCode: ['sc code', 'sales code'],
  mslNo: ['msl no', 'msl number', 'msl'],
  speciality: ['speciality', 'specialty', 'specialization'],
  hospitalName: ['hospital name', 'hospital', 'institution', 'clinic name', 'clinic', 'clinic/hospital', 'hospital/clinic'],
  campAddress: ['camp address', 'address', 'venue address', 'location'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  pincode: ['pincode', 'pin code', 'zip', 'postal code'],
  campDate: ['camp date', 'date', 'event date', 'schedule date'],
  startTime: ['start time', 'from time', 'time from'],
  durationHours: ['duration', 'duration hours', 'camp duration', 'hours', 'time frame'],
  endTime: ['end time', 'to time', 'time to'],
  expectedPatients: ['expected patients', 'expected patient', 'patient count', 'footfall'],
  actualPatients: ['actual patients', 'actual patient', 'patients screened'],
  fieldPersonName: ['field person', 'field rep', 'mr name', 'representative'],
  fieldPersonPhone: ['field phone', 'field person phone', 'field person contact', 'mobile no', 'mr mobile'],
  technicianName: ['technician', 'technician name', 'tech name'],
  remarks: ['remarks', 'notes', 'comments'],
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function suggestMappings(headers) {
  const suggestions = {};

  CAMP_IMPORT_FIELDS.forEach((field) => {
    const aliases = [field.label, field.key, ...(HEADER_ALIASES[field.key] || [])].map(normalizeHeader);
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return aliases.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized));
    });
    if (match) suggestions[field.key] = match;
  });

  return suggestions;
}

export function mapRows(rows, mapping, defaultClientName = '') {
  return rows.map((row, index) => {
    const mapped = { rowNumber: index + 2 };

    CAMP_IMPORT_FIELDS.forEach((field) => {
      const sourceHeader = mapping[field.key];
      mapped[field.key] = sourceHeader
        ? String(row[sourceHeader] ?? '').trim()
        : '';
    });

    if (!mapped.clientName && defaultClientName) {
      mapped.clientName = defaultClientName;
    }

    return mapped;
  });
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 86400000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'string') {
    const local = parseLocalDateInput(value);
    if (local) return local;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateMappedRows(rows) {
  const validRows = [];
  const invalidRows = [];

  rows.forEach((row) => {
    const errors = [];

    if (!String(row.clientName || '').trim()) errors.push('Client name is required');
    if (!String(row.campDate || '').trim()) errors.push('Camp date is required');

    const campDate = parseDate(row.campDate);
    if (String(row.campDate || '').trim() && !campDate) errors.push('Camp date is invalid');

    const expectedPatients = row.expectedPatients === '' || row.expectedPatients == null
      ? null
      : Number(row.expectedPatients);
    if (expectedPatients != null && Number.isNaN(expectedPatients)) {
      errors.push('Expected patients must be a number');
    }

    const actualPatients = row.actualPatients === '' || row.actualPatients == null
      ? null
      : Number(row.actualPatients);
    if (actualPatients != null && Number.isNaN(actualPatients)) {
      errors.push('Actual patients must be a number');
    }

    const normalized = {
      ...row,
      clientName: String(row.clientName || '').trim(),
      campaignName: normalizeCampName(row.campaignName),
      campaignType: String(row.campaignType || 'Screening').trim(),
      doctorName: String(row.doctorName || '').trim(),
      doctorCode: String(row.doctorCode || '').trim(),
      scCode: String(row.scCode || '').trim(),
      mslNo: String(row.mslNo || '').trim(),
      speciality: String(row.speciality || '').trim(),
      hospitalName: resolveClinicHospitalName(row.hospitalName, row.clinicName),
      clinicName: '',
      campAddress: String(row.campAddress || '').trim(),
      city: String(row.city || '').trim(),
      state: String(row.state || '').trim(),
      pincode: String(row.pincode || '').trim(),
      campDate,
      startTime: String(row.startTime || '').trim(),
      endTime: String(row.endTime || '').trim(),
      durationHours: Number(row.durationHours) || 3,
      expectedPatients: expectedPatients ?? 0,
      actualPatients: actualPatients ?? 0,
      fieldPersonName: String(row.fieldPersonName || '').trim(),
      fieldPersonPhone: String(row.fieldPersonPhone || '').trim(),
      technicianName: String(row.technicianName || '').trim(),
      remarks: String(row.remarks || '').trim(),
    };

    if (errors.length) {
      invalidRows.push({ rowNumber: row.rowNumber, data: normalized, errors });
    } else {
      validRows.push(normalized);
    }
  });

  return { validRows, invalidRows };
}

import XLSX from 'xlsx';
import { CAMP_IMPORT_FIELDS } from './importMapper.js';

const SAMPLE_ROW = {
  'Client Name': 'Sun Pharma',
  'Campaign Name': 'Classic',
  'Campaign Type': 'BMD',
  'Doctor Name': 'Dr. Sample',
  'Doctor Code': 'DOC101',
  'SC Code': 'SC001',
  'MSL No': 'MSL001',
  'Speciality': 'Cardiology',
  'Clinic / Hospital': 'City General Hospital',
  'Camp Address': '123 Main Road',
  'City': 'Mumbai',
  'State': 'Maharashtra',
  'Pincode': '400001',
  'Camp Date': '20/06/2026',
  'Start Time': '09:00',
  'Duration (Hours)': 3,
  'End Time': '12:00',
  'Expected Patients': 50,
  'Actual Patients': 0,
  'Field Person': 'Field Rep 1',
  'Technician': 'Tech 1',
  'Remarks': 'Sample row — replace with your camp details',
};

export function getStandardMapping() {
  return Object.fromEntries(CAMP_IMPORT_FIELDS.map((field) => [field.key, field.label]));
}

export function getMissingStandardHeaders(headers = []) {
  const headerSet = new Set(headers.map((header) => String(header).trim()));
  return CAMP_IMPORT_FIELDS
    .filter((field) => field.required)
    .filter((field) => !headerSet.has(field.label))
    .map((field) => field.label);
}

export function buildSampleWorkbookBuffer() {
  const headers = CAMP_IMPORT_FIELDS.map((field) => field.label);
  const worksheet = XLSX.utils.json_to_sheet([SAMPLE_ROW], { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Camp Import');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

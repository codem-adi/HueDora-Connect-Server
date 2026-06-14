export const CAMP_NAME_OPTIONS = [
  'BMD',
  'Dieitician',
  'Others',
  'Physio & Nuero',
  'Uroflow',
];

export function isValidCampName(value) {
  return CAMP_NAME_OPTIONS.includes(String(value || '').trim());
}

export function normalizeCampName(value) {
  const trimmed = String(value || '').trim();
  if (isValidCampName(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.includes('bmd') || lower.includes('classic')) return 'BMD';
  if (lower.includes('diet') || lower.includes('dieit')) return 'Dieitician';
  if (lower.includes('physio') || lower.includes('nuero') || lower.includes('neuro')) return 'Physio & Nuero';
  if (lower.includes('uro')) return 'Uroflow';
  return 'Others';
}

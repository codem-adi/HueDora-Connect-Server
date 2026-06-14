import ClientMaster from '../models/ClientMaster.js';

const NO_DIVISION_MESSAGE = 'Create business unit / division first in Client Master before creating a camp.';

export async function getClientDivisions(clientId) {
  const records = await ClientMaster.find({
    deletedAt: null,
    client: clientId,
    programName: { $ne: '' },
  }).select('programName');

  return [...new Set(
    records
      .map((record) => String(record.programName || '').trim())
      .filter(Boolean),
  )];
}

export async function assertClientHasDivision(clientId, division) {
  const divisions = await getClientDivisions(clientId);

  if (!divisions.length) {
    const error = new Error(NO_DIVISION_MESSAGE);
    error.status = 400;
    throw error;
  }

  const normalizedDivision = String(division || '').trim();
  if (!normalizedDivision) {
    const error = new Error('Division / business unit is required');
    error.status = 400;
    throw error;
  }

  const hasDivision = divisions.some((item) => item === normalizedDivision);
  if (!hasDivision) {
    const error = new Error(`Division "${normalizedDivision}" is not configured for this client. ${NO_DIVISION_MESSAGE}`);
    error.status = 400;
    throw error;
  }

  return divisions;
}

export { NO_DIVISION_MESSAGE };

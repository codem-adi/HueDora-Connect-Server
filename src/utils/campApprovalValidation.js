import Client from '../models/Client.js';
import ClientMaster from '../models/ClientMaster.js';
import { isValidCampName } from '../config/campNames.js';
import { PENDING_EMAIL_CLIENT_CODE } from '../services/ensureServiceUsers.js';
import { PENDING_IMPORT_CLIENT_NAME } from './campMessageParser.js';
import { escapeRegex } from './trimInput.js';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function divisionMatches(campDivision, masterProgramName) {
  const division = normalizeText(campDivision);
  const program = normalizeText(masterProgramName);
  if (!division || !program) return false;
  return division === program || division.includes(program) || program.includes(division);
}

function campNameMatches(campCampName, masterCampName) {
  const campName = normalizeText(campCampName);
  const masterName = normalizeText(masterCampName);
  if (!campName || !masterName) return false;
  return campName === masterName;
}

function masterMatchesCamp(master, campCampName, campDivision) {
  return divisionMatches(campDivision, master.programName)
    && campNameMatches(campCampName, master.campName);
}

export function isPendingImportClient(client) {
  if (!client) return true;
  return client.code === PENDING_EMAIL_CLIENT_CODE
    || normalizeText(client.name) === normalizeText(PENDING_IMPORT_CLIENT_NAME);
}

function evaluateProgramApproval(client, masters, campCampName, campDivision) {
  const errors = [];

  if (!campDivision) {
    errors.push('Camp must have a division / business unit before approval');
    return errors;
  }

  if (!campCampName || !isValidCampName(campCampName)) {
    errors.push('Camp must have a valid camp name before approval');
    return errors;
  }

  if (!masters.length) {
    errors.push(`No program configuration found in Client Master for "${client.name}"`);
    return errors;
  }

  const matchingMasters = masters.filter((master) => masterMatchesCamp(master, campCampName, campDivision));

  if (!matchingMasters.length) {
    errors.push(
      `No matching program in Client Master for client "${client.name}" with division "${campDivision}" / camp name "${campCampName}"`,
    );
    return errors;
  }

  const hasActiveMatch = matchingMasters.some((master) => master.isActive);
  if (!hasActiveMatch) {
    errors.push('Matching program configuration is inactive. Camp cannot be approved.');
  }

  return errors;
}

export async function validateCampReadyForApproval(camp) {
  const errors = [];
  const client = camp.client?._id
    ? camp.client
    : await Client.findOne({ _id: camp.client, deletedAt: null });

  if (!client || client.deletedAt) {
    errors.push('Camp must have a valid client assigned before approval');
    return { ok: false, errors, canApprove: false };
  }

  if (isPendingImportClient(client)) {
    errors.push('Client was not matched from the request. Assign a real client in Client Master before approval');
    return { ok: false, errors, canApprove: false };
  }

  if (!client.isActive) {
    errors.push('Assigned client is inactive. Activate the client or choose another');
  }

  const campCampName = String(camp.campaignName || '').trim();
  const campDivision = String(camp.campaignType || '').trim();

  const masters = await ClientMaster.find({
    deletedAt: null,
    $or: [
      { client: client._id || client.id },
      { clientName: new RegExp(`^${escapeRegex(client.name)}$`, 'i') },
    ],
  });

  errors.push(...evaluateProgramApproval(client, masters, campCampName, campDivision));

  return {
    ok: errors.length === 0,
    errors,
    canApprove: errors.length === 0,
  };
}

export async function enrichCampsWithApprovalStatus(camps) {
  if (!camps.length) return [];

  const clientIds = [...new Set(camps.map((camp) => String(camp.client?._id || camp.client)).filter(Boolean))];
  const [clients, masters] = await Promise.all([
    Client.find({ _id: { $in: clientIds }, deletedAt: null }),
    ClientMaster.find({ deletedAt: null, client: { $in: clientIds } }),
  ]);

  const clientMap = Object.fromEntries(clients.map((client) => [String(client._id), client]));
  const mastersByClient = masters.reduce((acc, master) => {
    const key = String(master.client);
    if (!acc[key]) acc[key] = [];
    acc[key].push(master);
    return acc;
  }, {});

  return camps.map((camp) => {
    const obj = camp.toObject ? camp.toObject() : { ...camp };
    const client = clientMap[String(obj.client?._id || obj.client)];
    const errors = [];

    if (!client) {
      errors.push('Camp must have a valid client assigned before approval');
    } else if (isPendingImportClient(client)) {
      errors.push('Client was not matched from the request. Assign a real client before approval');
    } else if (!client.isActive) {
      errors.push('Assigned client is inactive');
    } else {
      const campCampName = String(obj.campaignName || '').trim();
      const campDivision = String(obj.campaignType || '').trim();
      const clientMasters = mastersByClient[String(client._id)] || [];
      errors.push(...evaluateProgramApproval(client, clientMasters, campCampName, campDivision));
    }

    return {
      ...obj,
      canApprove: errors.length === 0,
      approvalBlockers: errors,
    };
  });
}

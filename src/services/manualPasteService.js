import { randomUUID } from 'crypto';
import Client from '../models/Client.js';
import { parseEmailCamps } from '../utils/emailParser.js';
import { buildDuplicatePreviewFlag, findExistingDuplicateCamp } from '../utils/campDuplicateHelpers.js';
import { createCampFromEmailRow, resolveClientForEmail } from './emailIngestService.js';

async function buildBodyPreview(text) {
  const clients = await Client.find({ deletedAt: null, isActive: true });
  const parsedCamps = parseEmailCamps({
    subject: '',
    bodyText: text,
    from: 'manual-paste@connectors',
    knownClients: clients,
  });

  return Promise.all(parsedCamps.map(async (camp) => {
    const entry = {
      rowNumber: camp.rowNumber,
      valid: camp.valid,
      partial: camp.partial,
      partialFields: camp.partialFields || [],
      errors: camp.errors || [],
      row: camp.row ? { ...camp.row, remarks: '' } : null,
      block: camp.block || '',
      duplicateOf: null,
    };

    if (!camp.valid || !camp.row) {
      return entry;
    }

    const client = await resolveClientForEmail(camp.row, text);
    const duplicate = await findExistingDuplicateCamp({ client, row: camp.row });
    entry.duplicateOf = buildDuplicatePreviewFlag(duplicate);
    if (duplicate) {
      entry.errors = [
        ...(entry.errors || []),
        `Duplicate of existing camp ${duplicate.campId} for same client, division, date, and doctor`,
      ];
    }

    return entry;
  }));
}

export async function extractManualPastePreview({ text = '' } = {}) {
  const bodyText = String(text || '').trim();
  if (!bodyText) {
    throw new Error('Paste some camp details before extracting');
  }

  const bodyPreview = await buildBodyPreview(bodyText);

  return {
    extractedAt: new Date(),
    excelPreview: [],
    bodyPreview,
    summary: {
      excelFiles: 0,
      validBodyRows: bodyPreview.filter((row) => row.valid).length,
      invalidBodyRows: bodyPreview.filter((row) => !row.valid).length,
      duplicateBodyRows: bodyPreview.filter((row) => row.duplicateOf).length,
    },
  };
}

export async function processManualPaste({ previewData, text = '' }, user) {
  const preview = previewData || await extractManualPastePreview({ text });
  const bodyPreview = preview?.bodyPreview || [];

  if (!bodyPreview.length) {
    throw new Error('No extractable camp data found. Run extract preview first.');
  }

  const messageId = `manual-paste-${randomUUID()}`;
  const submittedAt = new Date();
  const emailMeta = {
    from: 'manual-paste@connectors',
    subject: 'Manual paste',
    messageId,
    rawBody: String(text || '').trim(),
  };

  const results = [];

  for (const camp of bodyPreview) {
    if (!camp.valid || !camp.row) {
      results.push({
        status: 'invalid',
        rowNumber: camp.rowNumber,
        errors: camp.errors,
      });
      continue;
    }

    try {
      const result = await createCampFromEmailRow({
        row: { ...camp.row, partial: camp.partial, remarks: '' },
        rowNumber: camp.rowNumber,
        messageId,
        emailMeta,
        createdBy: user,
        submittedAt,
        skipReviewRemarks: true,
      });
      results.push(result);
    } catch (error) {
      results.push({
        status: 'invalid',
        rowNumber: camp.rowNumber,
        errors: [error.message],
      });
    }
  }

  const createdCampIds = results
    .filter((item) => item.status === 'created')
    .map((item) => item.campId);

  const duplicateResults = results.filter((item) => item.status === 'duplicate');

  if (!createdCampIds.length) {
    if (duplicateResults.length) {
      throw new Error(
        `No new camps created. ${duplicateResults.length} row(s) matched existing camps for the same client, division, date, and doctor.`,
      );
    }
    throw new Error('No camps could be created from the pasted content');
  }

  return {
    created: createdCampIds.length,
    campIds: createdCampIds,
    duplicates: duplicateResults.length,
    duplicateCampIds: duplicateResults.map((item) => item.campId),
    results,
  };
}

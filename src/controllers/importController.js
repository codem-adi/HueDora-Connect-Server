import ImportTemplate from '../models/ImportTemplate.js';
import Client from '../models/Client.js';
import { ROLES } from '../config/constants.js';
import { CAMP_IMPORT_FIELDS } from '../utils/importMapper.js';
import { parseExcelBuffer } from '../utils/excelParser.js';
import { suggestMappings, mapRows, validateMappedRows } from '../utils/importMapper.js';
import { createCampFromRow } from '../services/campCreationService.js';
import { CampDuplicateError } from '../utils/campDuplicateHelpers.js';
import { buildSampleWorkbookBuffer, getMissingStandardHeaders, getStandardMapping } from '../utils/sampleExcel.js';
import { logAudit } from '../services/auditService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const downloadSampleExcel = asyncHandler(async (req, res) => {
  const buffer = buildSampleWorkbookBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="camp-import-sample.xlsx"');
  res.send(buffer);
});

export const getImportFields = asyncHandler(async (req, res) => {
  res.json({
    fields: CAMP_IMPORT_FIELDS,
    standardMapping: getStandardMapping(),
    isSuperAdmin: req.user.role === ROLES.SUPER_ADMIN,
  });
});

export const parseUpload = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Excel file is required' });
  }

  const parsed = parseExcelBuffer(req.file.buffer);
  const suggestions = suggestMappings(parsed.headers);
  const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
  const standardMapping = getStandardMapping();
  const missingStandardHeaders = isSuperAdmin ? [] : getMissingStandardHeaders(parsed.headers);

  res.json({
    fileName: req.file.originalname,
    sheetName: parsed.sheetName,
    headers: parsed.headers,
    sampleRows: parsed.sampleRows,
    totalRows: parsed.rows.length,
    suggestions,
    rows: parsed.rows,
    standardMapping,
    missingStandardHeaders,
    isSuperAdmin,
  });
});

export const previewImport = asyncHandler(async (req, res) => {
  const { rows, mapping, defaultClientName = '' } = req.body;

  if (!Array.isArray(rows) || !mapping) {
    return res.status(400).json({ message: 'Rows and mapping are required' });
  }

  const mappedRows = mapRows(rows, mapping, defaultClientName);
  const { validRows, invalidRows } = validateMappedRows(mappedRows);

  res.json({
    summary: {
      total: mappedRows.length,
      valid: validRows.length,
      invalid: invalidRows.length,
    },
    validRows,
    invalidRows,
    mapping,
  });
});

export const confirmImport = asyncHandler(async (req, res) => {
  const { rows, mapping, defaultClientName = '', templateName = '' } = req.body;

  if (!Array.isArray(rows) || !mapping) {
    return res.status(400).json({ message: 'Rows and mapping are required' });
  }

  const mappedRows = mapRows(rows, mapping, defaultClientName);
  const { validRows, invalidRows } = validateMappedRows(mappedRows);

  if (!validRows.length) {
    return res.status(400).json({
      message: 'No valid rows to import',
      invalidRows,
    });
  }

  const clients = await Client.find({ deletedAt: null });
  const clientMap = new Map(clients.map((client) => [client.name.toLowerCase(), client]));

  const created = [];
  const skipped = [];

  for (const row of validRows) {
    const client = clientMap.get(row.clientName.toLowerCase());
    if (!client) {
      skipped.push({ rowNumber: row.rowNumber, reason: `Client "${row.clientName}" not found` });
      continue;
    }

    try {
      const camp = await createCampFromRow({
        row,
        client,
        createdBy: req.user,
        source: 'excel',
      });

      created.push(camp);
    } catch (error) {
      if (error instanceof CampDuplicateError) {
        skipped.push({
          rowNumber: row.rowNumber,
          reason: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  if (templateName?.trim() && req.user.role === ROLES.SUPER_ADMIN) {
    const mappingObject = new Map(Object.entries(mapping));
    await ImportTemplate.create({
      name: templateName.trim(),
      mapping: mappingObject,
      createdBy: req.user._id,
    });
  }

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'import',
    entityId: 'excel',
    action: 'import_camps',
    afterValue: {
      created: created.length,
      skipped: skipped.length,
      invalid: invalidRows.length,
    },
  });

  res.status(201).json({
    message: 'Import completed',
    summary: {
      created: created.length,
      skipped: skipped.length,
      invalid: invalidRows.length,
    },
    skipped,
    invalidRows,
  });
});

export const listTemplates = asyncHandler(async (req, res) => {
  const templates = await ImportTemplate.find({ deletedAt: null })
    .populate('createdBy', 'name')
    .sort({ updatedAt: -1 });

  res.json({
    data: templates.map((template) => ({
      id: template._id,
      name: template.name,
      mapping: Object.fromEntries(template.mapping || []),
      createdBy: template.createdBy?.name || 'Unknown',
      updatedAt: template.updatedAt,
    })),
  });
});

export const saveTemplate = asyncHandler(async (req, res) => {
  const { name, mapping } = req.body;

  if (!name?.trim() || !mapping) {
    return res.status(400).json({ message: 'Template name and mapping are required' });
  }

  const template = await ImportTemplate.create({
    name: name.trim(),
    mapping: new Map(Object.entries(mapping)),
    createdBy: req.user._id,
  });

  res.status(201).json({
    data: {
      id: template._id,
      name: template.name,
      mapping: Object.fromEntries(template.mapping),
    },
  });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await ImportTemplate.findOne({ _id: req.params.id, deletedAt: null });
  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  template.deletedAt = new Date();
  await template.save();
  res.json({ message: 'Template deleted' });
});

import multer from 'multer';
import {
  buildStoredFileName,
  ensureProgramDocumentsDir,
  getProgramDocumentsDir,
  PROGRAM_DOCUMENT_MAX_BYTES,
  PROGRAM_DOCUMENT_MIME,
} from '../utils/programDocumentStorage.js';

const storage = multer.diskStorage({
  destination(req, file, cb) {
    ensureProgramDocumentsDir()
      .then(() => cb(null, getProgramDocumentsDir()))
      .catch((err) => cb(err));
  },
  filename(req, file, cb) {
    cb(null, buildStoredFileName(req.params.id, file.originalname));
  },
});

export const uploadProgramPdf = multer({
  storage,
  limits: { fileSize: PROGRAM_DOCUMENT_MAX_BYTES },
  fileFilter(req, file, cb) {
    const isPdf = file.mimetype === PROGRAM_DOCUMENT_MIME
      || file.mimetype === 'application/x-pdf'
      || /\.pdf$/i.test(file.originalname);
    cb(isPdf ? null : new Error('Only PDF files are allowed'), isPdf);
  },
}).single('document');

export function programDocumentFromUploadedFile(file) {
  return {
    fileName: file.originalname,
    storedName: file.filename,
    mimeType: PROGRAM_DOCUMENT_MIME,
    fileSize: file.size,
  };
}

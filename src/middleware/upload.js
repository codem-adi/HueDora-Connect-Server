import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadExcel = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    const isExcel = allowed.includes(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(isExcel ? null : new Error('Only Excel or CSV files are allowed'), isExcel);
  },
}).single('file');

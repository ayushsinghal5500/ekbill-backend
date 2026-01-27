import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base uploads directory
const baseUploadDir = path.join(__dirname, "../uploads");

// Create base uploads directory if it doesn't exist
if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
}

// Helper function to create storage for different file types
const createStorage = (fileType = "product") => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Get business_unique_code from authenticated user
      const business_unique_code = req.user?.business_unique_code;
      
      if (!business_unique_code) {
        return cb(new Error("Business unique code not found. Please authenticate first."), null);
      }

      // Create folder structure: uploads/business_unique_code/fileType/
      const uploadDir = path.join(baseUploadDir, business_unique_code, fileType);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const filename = `${fileType}-${uniqueSuffix}${ext}`;
      cb(null, filename);
    },
  });
};

// File filter for images only
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."), false);
  }
};

// File filter for documents (can be extended)
const documentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    "application/pdf", "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images and PDF documents are allowed."), false);
  }
};

// Middleware to add file URL to req.file after upload
export const addFileUrl = (fileType = "product") => {
  return (req, res, next) => {
    if (req.file) {
      const business_unique_code = req.user?.business_unique_code;
      
      if (!business_unique_code) {
        return next(new Error("Business unique code not found"));
      }
      
      const filename = req.file.filename;
      
      // Generate file URL for database storage
      // Format: uploads/business_unique_code/fileType/filename
      req.file.url = `uploads/${business_unique_code}/${fileType}/${filename}`;
      
      // Also add relative path (for serving files) - use forward slashes for URLs
      req.file.relativePath = `uploads/${business_unique_code}/${fileType}/${filename}`;
    }
    next();
  };
};

// Configure multer for product image uploads
export const uploadProductImage = multer({
  storage: createStorage("product"),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Configure multer for profile image uploads
export const uploadProfileImage = multer({
  storage: createStorage("profile"),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Configure multer for document uploads (for business documents, etc.)
export const uploadDocument = multer({
  storage: createStorage("documents"),
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
});

// Generic upload function - can be used for any file type
export const createUploader = (fileType = "files", options = {}) => {
  const {
    fileFilter = imageFileFilter,
    fileSize = 5 * 1024 * 1024, // 5MB default
    allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
  } = options;

  const customFileFilter = (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(", ")}`), false);
    }
  };

  return multer({
    storage: createStorage(fileType),
    fileFilter: fileFilter || customFileFilter,
    limits: {
      fileSize: fileSize,
    },
  });
};

// Error handler middleware for multer errors
export const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size exceeded.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded.",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }
  next();
};

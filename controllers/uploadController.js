const path = require("path");
const multer = require("multer");
const fs = require("fs");

// ✅ MUST MATCH SERVER + NGINX
const uploadsDir = process.env.UPLOADS_DIR || "/var/www/uploads";

// ✅ Subfolders
const profilePicsDir = path.join(uploadsDir, "profilePics");
const resumesDir = path.join(uploadsDir, "resumes");
const offerLettersDir = path.join(uploadsDir, "offerLetters");

// ✅ Ensure directories exist
[uploadsDir, profilePicsDir, resumesDir, offerLettersDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ✅ Multer storage
const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.fieldname === "profilePic") return cb(null, profilePicsDir);
    if (file.fieldname === "resume") return cb(null, resumesDir);
    if (file.fieldname === "offerLetter") return cb(null, offerLettersDir);
    cb(new Error("Invalid file field"));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  }
});

// ✅ Multer config
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.fieldname === "profilePic") {
      return file.mimetype.startsWith("image/")
        ? cb(null, true)
        : cb(new Error("Only images allowed"));
    }

    if (file.fieldname === "resume") {
      return file.mimetype === "application/pdf"
        ? cb(null, true)
        : cb(new Error("Only PDF allowed"));
    }

    // ✅ Offer letter → allow ANY file
    if (file.fieldname === "offerLetter") {
      return cb(null, true);
    }

    cb(new Error("Invalid file field"));
  }
});

// 🔹 Helper: DB path → disk path
const getDiskPathFromDbPath = (dbPath) =>
  path.join(uploadsDir, dbPath.replace("/uploads/", ""));

// ✅ SINGLE CONTROLLER FOR ALL FILES
const uploadFile = async (req, res) => {
  try {
    const { studentId } = req.body;
    const file = req.file;

    if (!studentId || !file) {
      return res.status(400).json({
        success: false,
        message: "studentId and file are required"
      });
    }

    const Student = require("../models/studenReg");

    const student = await Student.findOne({ where: { studentId } });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // ✅ Decide column + path
    let column = "";
    let newDbPath = "";

    if (file.fieldname === "profilePic") {
      column = "profilePicPath";
      newDbPath = `/uploads/profilePics/${file.filename}`;
    }

    if (file.fieldname === "resume") {
      column = "resumePath";
      newDbPath = `/uploads/resumes/${file.filename}`;
    }

    if (file.fieldname === "offerLetter") {
      column = "offerLetterPath";
      newDbPath = `/uploads/offerLetters/${file.filename}`;
    }

    if (!column) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type"
      });
    }

    const oldDbPath = student[column];

    // ✅ Update DB first
    await Student.update(
      { [column]: newDbPath },
      { where: { studentId } }
    );

    // ✅ Delete old file after DB success
    if (oldDbPath) {
      const oldDiskPath = getDiskPathFromDbPath(oldDbPath);
      if (fs.existsSync(oldDiskPath)) {
        fs.unlinkSync(oldDiskPath);
      }
    }

    return res.json({
      success: true,
      message: "File uploaded successfully",
      filePath: newDbPath
    });

  } catch (error) {
    console.error("Upload error:", error);

    // rollback uploaded file
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "File upload failed"
    });
  }
};

module.exports = {
  upload,
  uploadFile,
  uploadsDir
};

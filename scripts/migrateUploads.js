// scripts/migrateUploads.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");

// ✅ Old location (inside backend)
const oldDir = path.join(__dirname, "..", "uploads");

// ✅ New location (from .env OR fallback)
const newDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "external_uploads");

console.log("🚀 Starting migration...");
console.log("📤 From:", oldDir);
console.log("📥 To:", newDir);

// ✅ Check if old directory exists
if (!fs.existsSync(oldDir)) {
  console.log("❌ No old uploads directory found at:", oldDir);
  console.log("✅ No migration needed. You can start fresh.");
  process.exit(0);
}

// ✅ Create new uploads directory if it doesn't exist
if (!fs.existsSync(newDir)) {
  fs.mkdirSync(newDir, { recursive: true });
  console.log("✅ Created new uploads directory");
}

// ✅ Copy profilePics
const oldProfilePics = path.join(oldDir, "profilePics");
const newProfilePics = path.join(newDir, "profilePics");

if (fs.existsSync(oldProfilePics)) {
  if (!fs.existsSync(newProfilePics)) {
    fs.mkdirSync(newProfilePics, { recursive: true });
  }

  fs.cpSync(oldProfilePics, newProfilePics, { recursive: true });
  console.log("✅ Migrated profilePics");
} else {
  console.log("⚠️ No profilePics folder found");
}

// ✅ Copy resumes
const oldResumes = path.join(oldDir, "resumes");
const newResumes = path.join(newDir, "resumes");

if (fs.existsSync(oldResumes)) {
  if (!fs.existsSync(newResumes)) {
    fs.mkdirSync(newResumes, { recursive: true });
  }

  fs.cpSync(oldResumes, newResumes, { recursive: true });
  console.log("✅ Migrated resumes");
} else {
  console.log("⚠️ No resumes folder found");
}

console.log("\n🎉 Migration complete!");
console.log("🗂 Old folder:", oldDir);
console.log("🗂 New folder:", newDir);
console.log("\n⚠️ After verifying files, you can safely delete:");
console.log(oldDir);

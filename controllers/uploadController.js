const path = require('path');
const multer = require('multer');

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = file.fieldname === 'profilePic' ? 'profilePics' : 'resumes';
    cb(null, path.join(__dirname, '..', 'uploads', folder));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// Route handler
const uploadFile = (req, res) => {
  const file = req.file;
  const { studentId } = req.body;

  if (!file || !studentId) {
    return res.status(400).json({ success: false, message: 'Missing file or studentId' });
  }

  const filePath = `/uploads/${file.fieldname === 'profilePic' ? 'profilePics' : 'resumes'}/${file.filename}`;

  // Save the filePath to DB (mock below — replace with real DB logic)
  const Student = require('../models/studenReg');
  Student.update({ [file.fieldname === 'profilePic' ? 'profilePicPath' : 'resumePath']: filePath }, {
    where: { studentId }
  })
    .then(() => {
      res.json({ success: true, message: 'File uploaded', filePath });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ success: false, message: 'DB update failed' });
    });
};

module.exports = {
  upload,
  uploadFile,
};

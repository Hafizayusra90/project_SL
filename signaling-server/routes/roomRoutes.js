const express = require('express');
const router = express.Router();
const { createRoom, getRooms } = require('../controllers/roomController');
const { protect } = require('../middleware/auth');

const Room = require('../models/Room');

// Public room registration / pre-announcement from instructor
router.post('/register', async (req, res) => {
  try {
    const { roomId, title, instructorName, instructorEmail } = req.body;
    if (!roomId) {
      return res.status(400).json({ message: 'roomId is required' });
    }
    const cleanId = String(roomId).trim();
    const updated = await Room.findOneAndUpdate(
      { roomId: cleanId },
      {
        $set: {
          roomId: cleanId,
          title: title || 'Live Classroom',
          instructorName: instructorName || 'Instructor',
          ...(instructorEmail ? { instructorEmail } : {}),
          ...(req.body.passcode ? { passcode: String(req.body.passcode).trim() } : {}),
          isActive: true
        }
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, room: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public room info query by roomId or 9-digit code
router.get('/:roomId/info', async (req, res) => {
  try {
    const rawId = req.params.roomId;
    if (!rawId) return res.status(400).json({ message: 'roomId required' });
    const cleanId = String(rawId).trim();
    const altId = cleanId.replace(/-/g, '');
    
    let room = await Room.findOne({
      $or: [
        { roomId: cleanId },
        { roomId: altId },
        { roomId: new RegExp(`^${cleanId}$`, 'i') }
      ]
    }).lean();

    if (room && room.instructorName) {
      return res.json({
        success: true,
        roomId: room.roomId,
        title: room.title || 'Live Classroom',
        instructorName: room.instructorName,
        isActive: room.isActive
      });
    }

    res.json({
      success: false,
      message: 'Room not found in database',
      instructorName: 'Instructor'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-memory fallback store for lectures if DB is offline
const memoryLectures = new Map(); // roomId -> array of materials

// Multer storage setup for lecture files (docs, pdf, video, zip)
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads', 'lectures');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeName}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB max file size
});

// Upload lecture file (Docs, PDF, Video, Zip, etc.)
router.post('/:roomId/upload-lecture', upload.single('lectureFile'), async (req, res) => {
  try {
    const rawId = req.params.roomId;
    if (!rawId) return res.status(400).json({ success: false, message: 'roomId is required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const cleanId = String(rawId).trim();
    const altId = cleanId.replace(/-/g, '');
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = req.file.size < 1024 * 1024 
      ? `${(req.file.size / 1024).toFixed(0)} KB` 
      : `${fileSizeMb} MB`;

    const materialDoc = {
      fileName: req.file.originalname,
      fileUrl: `/uploads/lectures/${req.file.filename}`,
      fileType: ext || 'file',
      fileSize: sizeStr,
      uploadedBy: req.body.uploadedBy || 'Instructor',
      uploadedAt: new Date()
    };

    // Store in-memory
    if (!memoryLectures.has(cleanId)) memoryLectures.set(cleanId, []);
    memoryLectures.get(cleanId).push(materialDoc);
    if (altId !== cleanId) {
      if (!memoryLectures.has(altId)) memoryLectures.set(altId, []);
      memoryLectures.get(altId).push(materialDoc);
    }

    // Persist in MongoDB
    try {
      await Room.findOneAndUpdate(
        { $or: [{ roomId: cleanId }, { roomId: altId }] },
        { 
          $push: { lectureMaterials: materialDoc },
          $setOnInsert: { roomId: cleanId, title: 'Live Classroom', isActive: true }
        },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      console.warn('MongoDB lecture persist error:', dbErr.message);
    }

    console.log(`📤 Uploaded lecture file "${req.file.originalname}" (${sizeStr}) for room ${cleanId}`);

    return res.json({
      success: true,
      message: 'Lecture file uploaded successfully',
      material: materialDoc
    });
  } catch (err) {
    console.error('Lecture upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all uploaded lecture materials for a room
router.get('/:roomId/lectures', async (req, res) => {
  try {
    const rawId = req.params.roomId;
    if (!rawId) return res.status(400).json({ success: false, message: 'roomId is required' });
    const cleanId = String(rawId).trim();
    const altId = cleanId.replace(/-/g, '');

    let materials = [];
    try {
      const room = await Room.findOne({
        $or: [{ roomId: cleanId }, { roomId: altId }]
      }).lean();
      if (room && Array.isArray(room.lectureMaterials) && room.lectureMaterials.length > 0) {
        materials = room.lectureMaterials;
      }
    } catch (e) {}

    if (materials.length === 0) {
      materials = memoryLectures.get(cleanId) || memoryLectures.get(altId) || [];
    }

    res.json({
      success: true,
      roomId: cleanId,
      lectures: materials
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.route('/').post(protect, createRoom).get(protect, getRooms);

module.exports = router;

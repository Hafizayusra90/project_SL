const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  socketId: { type: String },
  userName: { type: String, default: 'Student' },
  userRole: { type: String, default: 'student' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date }
}, { _id: false });

const lectureMaterialSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, default: 'document' },
  fileSize: { type: String, default: '' },
  uploadedBy: { type: String, default: 'Instructor' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const generateRandomPasscode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: 'Live Classroom' },
  passcode: { type: String, default: generateRandomPasscode },
  instructorName: { type: String, default: 'Instructor' },
  instructorEmail: { type: String },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  studentsCount: { type: Number, default: 0 },
  participants: [participantSchema],
  lectureMaterials: [lectureMaterialSchema],
  endedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);


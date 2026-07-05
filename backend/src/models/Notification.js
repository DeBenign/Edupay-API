// src/models/Notififcation.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  _id: ObjectId,
  userId: ObjectId,              // recipient
  schoolId: ObjectId,
  type: { 
    type: String, 
    enum: ['payment_received', 'underpayment', 'overpayment', 'due_reminder'] 
  },
  message: String,
  read: { type: Boolean, default: false },
  metadata: Object,              // e.g. { studentId, amount, reference }
  createdAt: Date
},{ timestamps: true });

module.exports = mongoose.models.School || mongoose.model('Notificataion', notificationSchema);

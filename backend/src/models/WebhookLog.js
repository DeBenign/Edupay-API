// src/models/WebhookLog.js
const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      // e.g. "transfer.credit", "virtualaccount.credit"
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    signature: {
      type: String,
      default: null,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    processed: {
      type: Boolean,
      default: false,
    },
    processingError: {
      type: String,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// TTL index: auto-delete webhook logs after 90 days
webhookLogSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 7776000 });

const WebhookLog = mongoose.model('WebhookLog', webhookLogSchema);


// ─── Notification Model ───────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    type: {
      type: String,
      enum: ['payment_received', 'underpayment', 'overpayment', 'due_reminder'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // e.g. { studentId, amount, reference, balance }
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { WebhookLog, Notification };

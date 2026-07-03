// src/services/notification.service.js
// Creates in-app notifications for bursar and parent after every payment event.
// Called by reconciliation.service.js after a successful write.
// Non-blocking — failures here must never affect payment processing.

const { Notification } = require('../models/WebhookLog');
const User = require('../models/User');

// ─── Format currency ──────────────────────────────────────────────────────────
const fmt = (amount) =>
  `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

// ─── Build notification content per reconciliation status ─────────────────────
const buildNotificationContent = (result) => {
  const { studentName, studentCode, amountPaid, balanceAfter, overpayment,
          reconciliationStatus, feeName, term, academicSession } = result;

  const termLabel = `${term ? term.charAt(0).toUpperCase() + term.slice(1) + ' Term' : ''} ${academicSession || ''}`.trim();
  const feeLabel  = feeName || termLabel || 'school fees';

  const contents = {
    exact: {
      bursar: {
        type:    'payment_received',
        title:   `Payment complete — ${studentName}`,
        message: `${studentName} (${studentCode}) has fully paid ${feeLabel}. Amount: ${fmt(amountPaid)}.`,
      },
      parent: {
        type:    'payment_received',
        title:   'Payment confirmed ✓',
        message: `Your payment of ${fmt(amountPaid)} for ${studentName}'s ${feeLabel} has been received and confirmed. No outstanding balance.`,
      },
    },
    underpayment: {
      bursar: {
        type:    'underpayment',
        title:   `Partial payment — ${studentName}`,
        message: `${studentName} (${studentCode}) paid ${fmt(amountPaid)} for ${feeLabel}. Outstanding balance: ${fmt(balanceAfter)}.`,
      },
      parent: {
        type:    'underpayment',
        title:   'Partial payment received',
        message: `Your payment of ${fmt(amountPaid)} for ${studentName}'s ${feeLabel} has been received. Remaining balance: ${fmt(balanceAfter)}. Please complete the payment before the due date.`,
      },
    },
    overpayment: {
      bursar: {
        type:    'overpayment',
        title:   `Overpayment — ${studentName}`,
        message: `${studentName} (${studentCode}) overpaid ${feeLabel} by ${fmt(overpayment)}. Please review and initiate a refund or apply as credit.`,
      },
      parent: {
        type:    'overpayment',
        title:   'Overpayment detected',
        message: `Your payment for ${studentName}'s ${feeLabel} exceeded the required amount by ${fmt(overpayment)}. The school will contact you regarding the excess payment.`,
      },
    },
  };

  return contents[reconciliationStatus] || contents.exact;
};

// ─── Main: create notifications for bursar(s) and parent ─────────────────────
/**
 * createPaymentNotifications()
 * Creates notifications for all bursars in the school + the student's parent.
 *
 * @param {object} result   - Result object from reconciliation engine
 * @param {object} student  - Mongoose Student document
 */
const createPaymentNotifications = async (result, student) => {
  const { schoolId, studentId, feeAssignmentId, reference } = result;

  const content   = buildNotificationContent(result);
  const metadata  = {
    studentId,
    feeAssignmentId,
    reference,
    amountPaid:           result.amountPaid,
    reconciliationStatus: result.reconciliationStatus,
    balanceAfter:         result.balanceAfter,
    overpayment:          result.overpayment,
  };

  const notificationsToCreate = [];

  // 1. Notify all bursars in the school
  const bursars = await User.find({ schoolId, role: 'bursar', isActive: true }).select('_id');
  for (const bursar of bursars) {
    notificationsToCreate.push({
      userId:   bursar._id,
      schoolId,
      type:     content.bursar.type,
      title:    content.bursar.title,
      message:  content.bursar.message,
      metadata,
    });
  }

  // 2. Notify admin(s) only for overpayments (they need to approve refunds)
  if (result.reconciliationStatus === 'overpayment') {
    const admins = await User.find({ schoolId, role: 'admin', isActive: true }).select('_id');
    for (const admin of admins) {
      notificationsToCreate.push({
        userId:   admin._id,
        schoolId,
        type:     'overpayment',
        title:    content.bursar.title,
        message:  content.bursar.message,
        metadata,
      });
    }
  }

  // 3. Notify the student's parent (if linked)
  if (student.parentId) {
    notificationsToCreate.push({
      userId:   student.parentId,
      schoolId,
      type:     content.parent.type,
      title:    content.parent.title,
      message:  content.parent.message,
      metadata,
    });
  }

  if (notificationsToCreate.length > 0) {
    await Notification.insertMany(notificationsToCreate);
    console.log(`🔔 ${notificationsToCreate.length} notification(s) created for ref: ${reference}`);
  }
};

// ─── Due-date reminder notifications ─────────────────────────────────────────
/**
 * createDueDateReminders()
 * Called by the feeReminder.job.js cron.
 * Sends reminders to parents of students with outstanding fees near due date.
 *
 * @param {Array} dueSoonAssignments  - FeeAssignment documents populated with student + fee
 */
const createDueDateReminders = async (dueSoonAssignments) => {
  const notifications = [];

  for (const assignment of dueSoonAssignments) {
    const student   = assignment.studentId;
    const fee       = assignment.feeStructureId;

    if (!student?.parentId) continue;

    const daysLeft  = Math.ceil(
      (new Date(fee.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    notifications.push({
      userId:   student.parentId,
      schoolId: assignment.schoolId,
      type:     'due_reminder',
      title:    `Fee due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      message:  `${student.fullName}'s ${fee.name} payment of ₦${Number(assignment.balance).toLocaleString()} is due on ${new Date(fee.dueDate).toLocaleDateString('en-NG', { dateStyle: 'medium' })}. Please make payment to avoid any disruption.`,
      metadata: {
        studentId:       student._id,
        feeAssignmentId: assignment._id,
        balance:         assignment.balance,
        dueDate:         fee.dueDate,
        daysLeft,
      },
    });
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    console.log(`🔔 ${notifications.length} due-date reminder(s) sent`);
  }

  return notifications.length;
};

// ─── Mark notifications as read ──────────────────────────────────────────────
const markAllAsRead = async (userId) => {
  await Notification.updateMany({ userId, read: false }, { read: true });
};

module.exports = {
  createPaymentNotifications,
  createDueDateReminders,
  markAllAsRead,
};

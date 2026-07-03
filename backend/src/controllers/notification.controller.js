// src/controllers/notification.controller.js
const { Notification } = require('../models/WebhookLog');
const { markAllAsRead } = require('../services/notification.service');
const { success, error } = require('../utils/apiResponse');
const { paginate } = require('../utils/paginate');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const { skip, limit, buildPagination } = paginate(req.query);
    const filter = { userId: req.user._id };
    if (req.query.unread === 'true') filter.read = false;
    if (req.query.type)             filter.type  = req.query.type;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: { notifications, unreadCount },
      pagination: buildPagination(totalCount),
    });
  } catch (err) {
    console.error('getNotifications error:', err.message);
    return error(res);
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await markAllAsRead(req.user._id);
    return success(res, null, 'All notifications marked as read');
  } catch (err) {
    return error(res);
  }
};

// PATCH /api/notifications/:id/read
const markOneRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true }
    );
    return success(res, null, 'Notification marked as read');
  } catch (err) {
    return error(res);
  }
};

module.exports = { getNotifications, markAllRead, markOneRead };

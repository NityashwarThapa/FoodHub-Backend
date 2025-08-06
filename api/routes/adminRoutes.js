const express = require('express');
const router = express.Router();
const { verifyUser, verifyAuthorization, verifySuperAdmin } = require("../middlewares/authMiddlerware");
const { AuditService } = require('../utils/auditLogger');
const SecurityMiddleware = require('../middlewares/securityMiddleware');
const httpStatus = require('http-status');

// Admin dashboard - view audit logs
router.get('/audit-logs',
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser,
  verifyAuthorization(['admin', 'super-admin']),
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        userId, 
        eventType, 
        startDate, 
        endDate 
      } = req.query;

      const filters = {};
      if (userId) filters.userId = userId;
      if (eventType) filters.eventType = eventType;
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }

      const result = await AuditService.getAuditLogs(
        filters, 
        parseInt(page), 
        parseInt(limit)
      );

      return res.status(httpStatus.OK).json({
        success: true,
        message: 'Audit logs retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve audit logs'
      });
    }
  }
);

// Security dashboard - get security statistics
router.get('/security-stats',
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser,
  verifyAuthorization(['admin', 'super-admin']),
  async (req, res) => {
    try {
      const mongoose = require('mongoose');
      const User = require('../models/User');
      
      // Get security statistics
      const totalUsers = await User.countDocuments();
      const verifiedUsers = await User.countDocuments({ emailVerified: true });
      const lockedAccounts = await User.countDocuments({ accountLocked: true });
      const expiredPasswords = await User.countDocuments({
        passwordExpiry: { $lte: new Date() }
      });

      // Get recent security events from audit logs
      const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }), 'audit_logs');
      const recentSecurityEvents = await AuditLog.find({
        eventType: 'SECURITY'
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

      const securityStats = {
        totalUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        lockedAccounts,
        expiredPasswords,
        recentSecurityEvents,
        verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0
      };

      return res.status(httpStatus.OK).json({
        success: true,
        message: 'Security statistics retrieved successfully',
        data: securityStats
      });
    } catch (error) {
      console.error('Get security stats error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve security statistics'
      });
    }
  }
);

// Unlock user account (admin only)
router.post('/unlock-account/:userId',
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser,
  verifyAuthorization(['admin', 'super-admin']),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const User = require('../models/User');

      const user = await User.findByIdAndUpdate(userId, {
        accountLocked: false,
        failedLoginAttempts: 0,
        $unset: { lockUntil: 1 }
      }, { new: true });

      if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      // Log the admin action
      AuditService.logUserActivity(
        'ACCOUNT_UNLOCKED_BY_ADMIN',
        req.user._id,
        req.user.email,
        {
          targetUserId: userId,
          targetUserEmail: user.email,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      );

      return res.status(httpStatus.OK).json({
        success: true,
        message: 'User account unlocked successfully'
      });
    } catch (error) {
      console.error('Unlock account error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to unlock user account'
      });
    }
  }
);

// Force password reset (admin only)
router.post('/force-password-reset/:userId',
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser,
  verifyAuthorization(['admin', 'super-admin']),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const User = require('../models/User');
      const PasswordService = require('../utils/passwordService');
      const bcrypt = require('bcryptjs');

      const user = await User.findById(userId);
      if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate temporary password
      const tempPassword = PasswordService.generateTemporaryPassword();
      const salt = await bcrypt.genSalt(10);
      const hashedTempPassword = await bcrypt.hash(tempPassword, salt);

      // Update user with temporary password
      await User.findByIdAndUpdate(userId, {
        password: hashedTempPassword,
        passwordExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire in 24 hours
        passwordChangedAt: new Date(),
        $push: {
          passwordHistory: {
            password: hashedTempPassword,
            createdAt: new Date()
          }
        }
      });

      // Log the admin action
      AuditService.logUserActivity(
        'PASSWORD_RESET_BY_ADMIN',
        req.user._id,
        req.user.email,
        {
          targetUserId: userId,
          targetUserEmail: user.email,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      );

      // In production, you would send this via email instead of returning it
      return res.status(httpStatus.OK).json({
        success: true,
        message: 'Temporary password generated successfully',
        tempPassword: tempPassword // Remove this in production
      });
    } catch (error) {
      console.error('Force password reset error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to reset user password'
      });
    }
  }
);

// Change user role (super admin only)
router.put('/change-role/:userId',
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser,
  verifySuperAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { newRole } = req.body;
      const User = require('../models/User');

      if (!['user', 'admin', 'super-admin'].includes(newRole)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid role specified'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      const oldRole = user.role;
      
      // Prevent changing own role
      if (userId === req.user._id.toString()) {
        return res.status(httpStatus.FORBIDDEN).json({
          success: false,
          message: 'Cannot change your own role'
        });
      }

      await User.findByIdAndUpdate(userId, { role: newRole });

      // Log the role change
      AuditService.logRoleChange(
        req.user._id,
        userId,
        oldRole,
        newRole,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(httpStatus.OK).json({
        success: true,
        message: 'User role updated successfully'
      });
    } catch (error) {
      console.error('Change role error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to change user role'
      });
    }
  }
);

module.exports = router;
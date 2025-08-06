const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const userModel = require('../models/User');
const EncryptionService = require('../utils/encryption');
const { AuditService } = require('../utils/auditLogger');

const decodeToken = (authorization) => {
  try {
    const token = authorization.split(' ')[1];
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const getUser = async (userId) => {
  try {
    const user = await userModel.findById(userId).lean();
    if (user) {
      // Decrypt sensitive fields when retrieving user data
      return EncryptionService.decryptSensitiveFields(user);
    }
    return null;
  } catch (error) {
    return null;
  }
};

const handleUnauthorizedAccess = (res, message = 'Unauthorized access') => {
  return res
    .status(httpStatus.UNAUTHORIZED)
    .json({ success: false, message });
};

const extractRequestInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown'
  };
};

const verifyUser = async (req, res, next) => {
  try {
    // Check for JWT token in Authorization header
    let token = null;
    let decodedResult = null;

    if (req.headers.authorization) {
      decodedResult = decodeToken(req.headers.authorization);
      token = req.headers.authorization.split(' ')[1];
    }

    // Fallback to session-based authentication
    if (!decodedResult && req.session && req.session.userId) {
      decodedResult = { userId: req.session.userId };
    }

    if (!decodedResult) {
      return handleUnauthorizedAccess(res, 'No valid authentication found');
    }

    const userData = await getUser(decodedResult.userId);
    if (!userData) {
      return handleUnauthorizedAccess(res, 'User not found');
    }

    // Check if account is locked
    if (userData.accountLocked && userData.lockUntil && new Date() < userData.lockUntil) {
      const lockTimeRemaining = Math.ceil((userData.lockUntil - new Date()) / (1000 * 60));
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: `Account is locked. Try again in ${lockTimeRemaining} minutes.`,
        accountLocked: true
      });
    }

    // Check password expiry
    const passwordExpiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS) || 60;
    if (userData.passwordChangedAt) {
      const daysSinceChange = Math.floor((new Date() - new Date(userData.passwordChangedAt)) / (1000 * 60 * 60 * 24));
      if (daysSinceChange >= passwordExpiryDays) {
        return res.status(httpStatus.FORBIDDEN).json({
          success: false,
          message: 'Password has expired. Please change your password.',
          passwordExpired: true
        });
      }
    }

    // Check email verification for new security features
    if (!userData.emailVerified && req.path !== '/verify-email' && req.path !== '/resend-otp') {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: 'Please verify your email address to continue.',
        emailVerificationRequired: true
      });
    }

    // Update session activity
    if (token) {
      await updateSessionActivity(userData._id, token, req);
    }

    req.user = userData;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return handleUnauthorizedAccess(res, 'Authentication failed');
  }
};

const updateSessionActivity = async (userId, token, req) => {
  try {
    const requestInfo = extractRequestInfo(req);
    const sessionId = token.substring(0, 10); // Use first 10 chars as session identifier
    
    await userModel.findByIdAndUpdate(userId, {
      $addToSet: {
        activeSessions: {
          sessionId,
          createdAt: new Date(),
          userAgent: requestInfo.userAgent,
          ipAddress: requestInfo.ipAddress
        }
      }
    });
  } catch (error) {
    console.error('Error updating session activity:', error);
  }
};

const verifyAuthorization = (allowedRoles = ['admin', 'super-admin']) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;
      const requestInfo = extractRequestInfo(req);
      
      if (!allowedRoles.includes(userRole)) {
        // Log unauthorized access attempt
        AuditService.logSecurityEvent(
          'UNAUTHORIZED_ACCESS_ATTEMPT',
          req.user._id,
          req.user.email,
          {
            attemptedRole: userRole,
            requiredRoles: allowedRoles,
            endpoint: req.originalUrl,
            method: req.method,
            ...requestInfo,
            severity: 'high'
          }
        );

        return res.status(httpStatus.FORBIDDEN).json({
          success: false,
          message: 'Insufficient permissions to access this resource'
        });
      }

      // Log admin access
      AuditService.logUserActivity(
        'ADMIN_ACCESS',
        req.user._id,
        req.user.email,
        {
          endpoint: req.originalUrl,
          method: req.method,
          role: userRole,
          ...requestInfo
        }
      );

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

// Enhanced admin verification with role tampering protection
const verifySuperAdmin = async (req, res, next) => {
  try {
    // Fetch user directly from database to prevent role tampering
    const user = await userModel.findById(req.user._id).lean();
    
    if (!user || user.role !== 'super-admin') {
      const requestInfo = extractRequestInfo(req);
      
      AuditService.logSecurityEvent(
        'SUPER_ADMIN_ACCESS_DENIED',
        req.user._id,
        req.user.email,
        {
          suspectedRole: req.user.role,
          actualRole: user?.role || 'unknown',
          endpoint: req.originalUrl,
          method: req.method,
          ...requestInfo,
          severity: 'critical'
        }
      );

      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: 'Super admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Super admin verification error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Admin verification failed'
    });
  }
};

// Middleware to prevent role tampering during updates
const preventRoleTampering = (req, res, next) => {
  // Remove role from update data if not super admin
  if (req.body.role && req.user.role !== 'super-admin') {
    delete req.body.role;
    
    const requestInfo = extractRequestInfo(req);
    AuditService.logSecurityEvent(
      'ROLE_TAMPERING_ATTEMPT',
      req.user._id,
      req.user.email,
      {
        attemptedRole: req.body.role,
        userRole: req.user.role,
        endpoint: req.originalUrl,
        ...requestInfo,
        severity: 'high'
      }
    );
  }
  next();
};

// Middleware for session-based authentication
const verifySession = (req, res, next) => {
  if (req.session && req.session.userId) {
    req.sessionAuth = true;
    next();
  } else {
    return handleUnauthorizedAccess(res, 'Valid session required');
  }
};

module.exports = { 
  verifyUser, 
  verifyAuthorization, 
  verifySuperAdmin,
  preventRoleTampering,
  verifySession,
  extractRequestInfo
};

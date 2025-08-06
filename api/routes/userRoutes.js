const express = require('express');
const router = express.Router();
const userController = require('../controllers/userControllers');
const { verifyUser, verifyAuthorization, preventRoleTampering } = require("../middlewares/authMiddlerware");
const SecurityMiddleware = require('../middlewares/securityMiddleware');

// Public routes with rate limiting
router.post('/login', 
  SecurityMiddleware.createAuthRateLimit(),
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  userController.login
);

router.post('/register', 
  SecurityMiddleware.createAuthRateLimit(),
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  userController.register
);

// Email verification routes
router.post('/verify-email',
  SecurityMiddleware.createRateLimit(15 * 60 * 1000, 10), // 10 attempts per 15 minutes
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  userController.verifyEmail
);

router.post('/resend-otp',
  SecurityMiddleware.createRateLimit(15 * 60 * 1000, 3), // 3 attempts per 15 minutes
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  userController.resendOTP
);

// Password strength check (public for registration form)
router.post('/check-password-strength',
  SecurityMiddleware.createRateLimit(),
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  userController.checkPasswordStrength
);

// Protected routes requiring authentication
router.get('/all', 
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser, 
  verifyAuthorization(['admin', 'super-admin']), 
  userController.allUser
);

router.get('/my-profile', 
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser, 
  userController.myProfile
);

router.put('/update-profile/:id', 
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser, 
  preventRoleTampering,
  userController.updateProfile
);

router.put('/upload-pp', 
  verifyUser,
  SecurityMiddleware.validateFileUpload(),
  userController.uploadPP
);

router.put('/change-password', 
  SecurityMiddleware.createRateLimit(15 * 60 * 1000, 5), // 5 attempts per 15 minutes
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser, 
  userController.changePassword
);

router.delete('/delete-user/:id', 
  SecurityMiddleware.xssProtection(),
  SecurityMiddleware.mongoSanitization(),
  verifyUser, 
  verifyAuthorization(['admin', 'super-admin']), 
  userController.deleteUser
);

router.post('/logout',
  verifyUser,
  userController.logout
);

module.exports = router;

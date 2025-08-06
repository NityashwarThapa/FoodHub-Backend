const Joi = require("joi");
const User = require("../models/User");
const httpStatus = require("http-status");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const upload = require("../middlewares/uploads");
const Cart = require("../models/Carts");
const PasswordService = require("../utils/passwordService");
const EncryptionService = require("../utils/encryption");
const { AuditService } = require("../utils/auditLogger");
const OTPService = require("../utils/otpService");
const { extractRequestInfo } = require("../middlewares/authMiddlerware");

// Enhanced validation schemas with security requirements
const userValidationSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  mobile_no: Joi.string().pattern(/^\d{10}$/).required().messages({
    'string.pattern.base': 'Mobile number must be 10 digits'
  })
});

const loginValidationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  oldpassword: Joi.string().required(),
  newpassword: Joi.string().required()
});

const createCart = async (user) => {
  try {
    //check if active cart exists
    const activeCart = await Cart.findOne({
      user_id: user._id,
      status: "CART"
    });
    if (activeCart) return;

    //get cart_no 
    const result = await Cart.findOne({}).sort({ _id: -1 });
    const cart_no = result ? result.cart_no + 1 : 1000;

    const cart = await Cart.create({ cart_no, user_id: user._id });
  } catch (error) {
    throw error;
  }
};

// Helper function to handle account lockout
const handleFailedLogin = async (user, email, requestInfo) => {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;
  const lockoutDuration = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION) || 30; // minutes

  if (!user) {
    // Log failed login for non-existent user
    AuditService.logFailedLogin(email, requestInfo.ipAddress, requestInfo.userAgent, 'User not found');
    return;
  }

  const failedAttempts = (user.failedLoginAttempts || 0) + 1;
  const updateData = { failedLoginAttempts: failedAttempts };

  if (failedAttempts >= maxAttempts) {
    updateData.accountLocked = true;
    updateData.lockUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
    
    AuditService.logAccountLocked(user._id, user.email, requestInfo.ipAddress, requestInfo.userAgent);
  }

  await User.findByIdAndUpdate(user._id, updateData);
  
  AuditService.logFailedLogin(user.email, requestInfo.ipAddress, requestInfo.userAgent, 'Invalid password');
};

// Helper function to handle successful login
const handleSuccessfulLogin = async (user, requestInfo) => {
  // Reset failed login attempts
  await User.findByIdAndUpdate(user._id, {
    failedLoginAttempts: 0,
    accountLocked: false,
    $unset: { lockUntil: 1 }
  });

  AuditService.logSuccessfulLogin(user._id, user.email, requestInfo.ipAddress, requestInfo.userAgent);
};

const login = async (req, res, next) => {
  try {
    const { error } = loginValidationSchema.validate(req.body);
    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: error.message
      });
    }

    const requestInfo = extractRequestInfo(req);
    const user = await User.findOne({ email: req.body.email }).lean();

    if (!user) {
      await handleFailedLogin(null, req.body.email, requestInfo);
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        msg: "Invalid credentials"
      });
    }

    // Check if account is locked
    if (user.accountLocked && user.lockUntil && new Date() < user.lockUntil) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - new Date()) / (1000 * 60));
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        msg: `Account is locked due to multiple failed login attempts. Try again in ${lockTimeRemaining} minutes.`,
        accountLocked: true
      });
    }

    // Check if password is valid
    const checkPassword = await bcrypt.compare(req.body.password, user.password);
    if (!checkPassword) {
      await handleFailedLogin(user, req.body.email, requestInfo);
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        msg: "Invalid credentials"
      });
    }

    // Check email verification
    if (!user.emailVerified) {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        msg: "Please verify your email address before logging in.",
        emailVerificationRequired: true
      });
    }

    // Check password expiry
    const passwordExpiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS) || 60;
    const daysSinceChange = Math.floor((new Date() - new Date(user.passwordChangedAt)) / (1000 * 60 * 60 * 24));
    
    let passwordWarning = null;
    if (daysSinceChange >= passwordExpiryDays) {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        msg: "Your password has expired. Please change your password.",
        passwordExpired: true
      });
    } else if (daysSinceChange >= passwordExpiryDays - 7) {
      passwordWarning = `Your password will expire in ${passwordExpiryDays - daysSinceChange} days.`;
    }

    await handleSuccessfulLogin(user, requestInfo);

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Create session
    req.session.userId = user._id;
    req.session.userEmail = user.email;

    const { password, passwordHistory, encryptedEmail, encryptedPhone, __v, ...userData } = user;
    
    // Decrypt sensitive fields for response
    const decryptedUser = EncryptionService.decryptSensitiveFields(userData);

    //create cart for the user
    await createCart(user);

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Login successful",
      passwordWarning,
      data: {
        ...decryptedUser,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Login failed"
    });
  }
};

const register = async (req, res, next) => {
  try {
    const { error } = userValidationSchema.validate(req.body);
    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: error.message
      });
    }

    const requestInfo = extractRequestInfo(req);

    // Validate password complexity
    const passwordValidation = PasswordService.validatePassword(req.body.password);
    if (!passwordValidation.isValid) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: passwordValidation.message,
        passwordStrength: passwordValidation.strength
      });
    }

    const checkUserExist = await User.findOne({
      email: req.body.email
    });
    
    if (checkUserExist) {
      return res.status(httpStatus.CONFLICT).json({
        success: false,
        msg: "User already exists"
      });
    }

    // Generate OTP for email verification
    const emailOTP = OTPService.generateOTP();
    const emailOTPExpiry = OTPService.getOTPExpiry();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Encrypt sensitive data
    const encryptedData = EncryptionService.encryptSensitiveFields(req.body);

    const userData = {
      ...req.body,
      password: hashedPassword,
      encryptedEmail: encryptedData.encryptedEmail,
      encryptedPhone: encryptedData.encryptedPhone,
      passwordHistory: [{
        password: hashedPassword,
        createdAt: new Date()
      }],
      passwordChangedAt: new Date(),
      passwordExpiry: PasswordService.generatePasswordExpiry(),
      emailOTP,
      emailOTPExpiry,
      emailVerified: false
    };

    const user = await User.create(userData);
    
    if (user) {
      // Send OTP email
      await OTPService.sendOTPEmail(req.body.email, emailOTP, 'registration');
      
      await createCart(user);
      
      AuditService.logUserActivity(
        'USER_REGISTERED',
        user._id,
        req.body.email,
        { ...requestInfo }
      );

      return res.status(httpStatus.OK).json({
        success: true,
        msg: 'Registration completed. Please check your email for verification code.',
        emailVerificationRequired: true
      });
    } else {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        msg: "Registration failed"
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Registration failed"
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: "Email and OTP are required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        msg: "User not found"
      });
    }

    const otpValidation = OTPService.verifyOTP(otp, user.emailOTP, user.emailOTPExpiry);
    if (!otpValidation.valid) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: otpValidation.reason
      });
    }

    await User.findByIdAndUpdate(user._id, {
      emailVerified: true,
      $unset: { emailOTP: 1, emailOTPExpiry: 1 }
    });

    const requestInfo = extractRequestInfo(req);
    AuditService.logUserActivity(
      'EMAIL_VERIFIED',
      user._id,
      email,
      { ...requestInfo }
    );

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Email verified successfully"
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Email verification failed"
    });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        msg: "User not found"
      });
    }

    if (user.emailVerified) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: "Email is already verified"
      });
    }

    const emailOTP = OTPService.generateOTP();
    const emailOTPExpiry = OTPService.getOTPExpiry();

    await User.findByIdAndUpdate(user._id, {
      emailOTP,
      emailOTPExpiry
    });

    await OTPService.sendOTPEmail(email, emailOTP, 'verification');

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "OTP sent successfully"
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Failed to send OTP"
    });
  }
};

const checkPasswordStrength = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: "Password is required"
      });
    }

    const strength = PasswordService.calculatePasswordStrength(password);
    const validation = PasswordService.validatePassword(password);

    return res.status(httpStatus.OK).json({
      success: true,
      data: {
        strength,
        isValid: validation.isValid,
        message: validation.message
      }
    });
  } catch (error) {
    console.error('Password strength check error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Password strength check failed"
    });
  }
};

const allUser = async (req, res, next) => {
  try {
    const { page = 1, size = 10, sort = { _id: -1 } } = req.query;

    let searchQuery = {};

    if (req.query.search) {
      searchQuery = {
        ...searchQuery,
        name: { $regex: req.query.search, $options: 'i' }
      };
    }

    const users = await User.find(searchQuery)
      .select("name email mobile_no image role emailVerified accountLocked createdAt")
      .skip((page - 1) * size)
      .limit(size)
      .sort(sort);

    // Decrypt sensitive fields for display
    const decryptedUsers = users.map(user => {
      const userObj = user.toObject();
      return EncryptionService.decryptSensitiveFields(userObj);
    });

    const totalCount = await User.countDocuments(searchQuery);
    
    const requestInfo = extractRequestInfo(req);
    AuditService.logUserActivity(
      'USERS_VIEWED',
      req.user._id,
      req.user.email,
      { ...requestInfo, page, size, search: req.query.search }
    );

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Users retrieved successfully",
      data: decryptedUsers,
      page,
      size,
      totalCount
    });

  } catch (error) {
    console.error('Get users error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Failed to retrieve users"
    });
  }
};

const myProfile = async (req, res, next) => {
  try {
    const { password, passwordHistory, encryptedEmail, encryptedPhone, __v, ...data } = req.user;
    
    // Decrypt sensitive fields
    const decryptedData = EncryptionService.decryptSensitiveFields(data);
    
    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Profile retrieved successfully",
      data: decryptedData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Failed to retrieve profile"
    });
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        msg: "User not found"
      });
    }

    // Encrypt sensitive data if being updated
    const updateData = EncryptionService.encryptSensitiveFields(req.body);

    await User.findByIdAndUpdate(id, updateData, { new: true });

    const requestInfo = extractRequestInfo(req);
    AuditService.logUserActivity(
      'PROFILE_UPDATED',
      req.user._id,
      req.user.email,
      { ...requestInfo, updatedUserId: id, updatedFields: Object.keys(req.body) }
    );

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Profile updated successfully"
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Profile update failed"
    });
  }
};

const uploadPP = async (req, res) => {
  upload.single('image')(req, res, async error => {
    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: error.message
      });
    }
    try {
      await User.findByIdAndUpdate(req.user._id, {
        image: req.file ? req.file.path : ''
      });

      const requestInfo = extractRequestInfo(req);
      AuditService.logUserActivity(
        'PROFILE_IMAGE_UPDATED',
        req.user._id,
        req.user.email,
        { ...requestInfo }
      );

      return res.status(httpStatus.OK).json({
        success: true,
        msg: "Profile image updated successfully",
        data: {
          image: req.file ? req.file.path : ''
        }
      });
    } catch (error) {
      console.error('Upload profile image error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        msg: "Profile image update failed"
      });
    }
  });
};

const changePassword = async (req, res) => {
  try {
    const { error } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: error.message
      });
    }

    const { oldpassword, newpassword } = req.body;

    // Validate new password complexity
    const passwordValidation = PasswordService.validatePassword(newpassword);
    if (!passwordValidation.isValid) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: passwordValidation.message,
        passwordStrength: passwordValidation.strength
      });
    }

    // Check if old password matches
    const checkPassword = await bcrypt.compare(oldpassword, req.user.password);
    if (!checkPassword) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        msg: "Current password is incorrect"
      });
    }

    // Check for password reuse
    const passwordReuse = PasswordService.checkPasswordReuse(
      newpassword, 
      req.user.passwordHistory, 
      bcrypt
    );
    
    if (passwordReuse.isReused) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: passwordReuse.message
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newpassword, salt);

    // Update password history
    const updatedPasswordHistory = PasswordService.updatePasswordHistory(
      req.user.passwordHistory,
      hashedPassword
    );

    await User.findByIdAndUpdate(req.user._id, {
      password: hashedPassword,
      passwordHistory: updatedPasswordHistory,
      passwordChangedAt: new Date(),
      passwordExpiry: PasswordService.generatePasswordExpiry()
    });

    const requestInfo = extractRequestInfo(req);
    AuditService.logPasswordChange(
      req.user._id,
      req.user.email,
      requestInfo.ipAddress,
      requestInfo.userAgent
    );

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Password changed successfully"
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Password change failed"
    });
  }
};

// delete user
const deleteUser = async (req, res) => {
  const userId = req.params.id;
  try {
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(httpStatus.NOT_FOUND).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const requestInfo = extractRequestInfo(req);
    AuditService.logUserActivity(
      'USER_DELETED',
      req.user._id,
      req.user.email,
      { ...requestInfo, deletedUserId: userId, deletedUserEmail: deletedUser.email }
    );

    return res.status(httpStatus.OK).json({ 
      success: true, 
      message: "User deleted successfully" 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: "User deletion failed" 
    });
  }
};

const logout = async (req, res) => {
  try {
    const requestInfo = extractRequestInfo(req);
    
    // Clear session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
    });

    // Clear session from user's active sessions (if using token)
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      const sessionId = token.substring(0, 10);
      
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { activeSessions: { sessionId } }
      });
    }

    AuditService.logUserActivity(
      'USER_LOGOUT',
      req.user._id,
      req.user.email,
      { ...requestInfo }
    );

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Logged out successfully"
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Logout failed"
    });
  }
};

module.exports = {
  login,
  register,
  verifyEmail,
  resendOTP,
  checkPasswordStrength,
  allUser,
  myProfile,
  updateProfile,
  uploadPP,
  changePassword,
  deleteUser,
  logout,
  createCart
};

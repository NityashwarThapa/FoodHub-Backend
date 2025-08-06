const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const User = require("./api/models/User");
const SecurityMiddleware = require('./api/middlewares/securityMiddleware');
const { auditLogger } = require('./api/utils/auditLogger');
require("dotenv").config();

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Security middleware - apply early in the pipeline
app.use(SecurityMiddleware.enforceHTTPS());
app.use(SecurityMiddleware.configureHelmet());
app.use(SecurityMiddleware.requestLogger());

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Global rate limiting
app.use(SecurityMiddleware.createRateLimit());

// CORS configuration with security enhancements
app.use(
  cors({
    origin: function (origin, callback) {
      console.log("url", process.env.URL);
      const allowedOrigins = process.env.URL;

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200 // Support legacy browsers
  })
);

// Session configuration with security
app.use(session({
  ...SecurityMiddleware.getSessionConfig(),
  store: MongoStore.create({
    mongoUrl: process.env.NODE_ENV === "test" ? process.env.MONGO_DB_REMOTE_TEST : process.env.MONGO_DB_REMOTE,
    touchAfter: 24 * 3600 // lazy session update
  })
}));

// Body parsing with security
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security sanitization middleware
app.use(SecurityMiddleware.mongoSanitization());
app.use(SecurityMiddleware.xssProtection());

async function connectionDB(app) {
  try {
    await mongoose.connect(
      process.env.NODE_ENV === "test" ? process.env.MONGO_DB_REMOTE_TEST : process.env.MONGO_DB_REMOTE
    );

    console.log("MongoDB connected successfully!", process.env.NODE_ENV === "test" ? process.env.MONGO_DB_REMOTE_TEST : process.env.MONGO_DB_REMOTE);

    // Check if there are no superAdmins in the database
    const superAdminExists = await User.exists({ role: 'super-admin' });
    if (!superAdminExists) {
      // Create a superAdmin user with enhanced security
      const bcrypt = require('bcryptjs');
      const PasswordService = require('./api/utils/passwordService');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password', salt);
      
      const superAdminData = {
        name: "Super Admin",
        email: "superadmin@gmail.com",
        password: hashedPassword,
        role: "super-admin",
        emailVerified: true, // Auto-verify super admin
        passwordHistory: [{
          password: hashedPassword,
          createdAt: new Date()
        }],
        passwordChangedAt: new Date(),
        passwordExpiry: PasswordService.generatePasswordExpiry(90) // 90 days for super admin
      };

      await User.create(superAdminData);
      console.log("SuperAdmin created successfully!");
      
      // Log super admin creation
      auditLogger.info('Super Admin Created', {
        action: 'SUPER_ADMIN_CREATED',
        email: 'superadmin@gmail.com',
        timestamp: new Date(),
        metadata: {
          createdBy: 'system',
          severity: 'high'
        }
      });
    }
  } catch (error) {
    console.log("Error connecting to MongoDB: " + error);
    auditLogger.error('Database Connection Failed', {
      error: error.message,
      timestamp: new Date()
    });
  }
}

module.exports.initializeApp = async () => {
  await connectionDB();
  
  // Serve static files securely
  app.use(express.static(path.join(__dirname, '/'), {
    dotfiles: 'deny',
    index: false,
    redirect: false
  }));

  // Routes
  app.use('/', require('./api/routes/index'));
  
  // Global error handler
  app.use((error, req, res, next) => {
    auditLogger.error('Unhandled Error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  });

  // 404 handler
  app.use((req, res) => {
    auditLogger.warn('404 Not Found', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });

    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });

  return app;
};



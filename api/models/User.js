const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: { type: String, required: true },
    email: {
        type: String,
        trim: true,
        required: true,
        unique: true
    },
    mobile_no: { type: String, required: true },
    password: { type: String, required: true },
    image: { type: String },
    role: {
        type: String,
        enum: ['user', 'admin', 'super-admin'],
        default: 'user',
    },
    // Password Security Features
    passwordHistory: [{
        password: String,
        createdAt: { type: Date, default: Date.now }
    }],
    passwordExpiry: { type: Date },
    passwordChangedAt: { type: Date, default: Date.now },
    
    // Account Security Features
    failedLoginAttempts: { type: Number, default: 0 },
    accountLocked: { type: Boolean, default: false },
    lockUntil: { type: Date },
    
    // OTP Verification
    emailVerified: { type: Boolean, default: false },
    emailOTP: { type: String },
    emailOTPExpiry: { type: Date },
    
    // Session Management
    activeSessions: [{
        sessionId: String,
        createdAt: { type: Date, default: Date.now },
        userAgent: String,
        ipAddress: String
    }],
    
    // Encrypted Fields (stored encrypted)
    encryptedEmail: { type: String },
    encryptedPhone: { type: String },
    address: { type: String }
}, {
    timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ accountLocked: 1 });
userSchema.index({ passwordExpiry: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

class OTPService {
    // Generate a 6-digit OTP
    static generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    // OTP expires in 10 minutes
    static getOTPExpiry() {
        return new Date(Date.now() + 10 * 60 * 1000);
    }

    // Email transporter configuration
    static createTransporter() {
        return nodemailer.createTransporter({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    // Send OTP via email
    static async sendOTPEmail(email, otp, purpose = 'verification') {
        try {
            const transporter = this.createTransporter();
            
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email,
                subject: `FoodHub - Email ${purpose.charAt(0).toUpperCase() + purpose.slice(1)} OTP`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c3e50;">FoodHub Email Verification</h2>
                        <p>Your ${purpose} OTP is:</p>
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
                            <h1 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
                        </div>
                        <p><strong>This OTP will expire in 10 minutes.</strong></p>
                        <p>If you didn't request this OTP, please ignore this email.</p>
                        <hr style="margin: 30px 0;">
                        <p style="color: #6c757d; font-size: 14px;">
                            This is an automated message from FoodHub. Please do not reply to this email.
                        </p>
                    </div>
                `
            };

            const result = await transporter.sendMail(mailOptions);
            console.log('OTP email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Error sending OTP email:', error);
            return { success: false, error: error.message };
        }
    }

    // Verify OTP
    static verifyOTP(providedOTP, storedOTP, expiry) {
        if (!providedOTP || !storedOTP || !expiry) {
            return { valid: false, reason: 'Missing OTP data' };
        }

        if (new Date() > expiry) {
            return { valid: false, reason: 'OTP has expired' };
        }

        if (providedOTP !== storedOTP) {
            return { valid: false, reason: 'Invalid OTP' };
        }

        return { valid: true };
    }

    // Generate password reset token
    static generatePasswordResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Send password reset email
    static async sendPasswordResetEmail(email, resetToken) {
        try {
            const transporter = this.createTransporter();
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email,
                subject: 'FoodHub - Password Reset Request',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c3e50;">Password Reset Request</h2>
                        <p>You have requested to reset your password for your FoodHub account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 3px;">
                            ${resetUrl}
                        </p>
                        <p><strong>This link will expire in 1 hour.</strong></p>
                        <p>If you didn't request this password reset, please ignore this email.</p>
                        <hr style="margin: 30px 0;">
                        <p style="color: #6c757d; font-size: 14px;">
                            This is an automated message from FoodHub. Please do not reply to this email.
                        </p>
                    </div>
                `
            };

            const result = await transporter.sendMail(mailOptions);
            console.log('Password reset email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Error sending password reset email:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = OTPService;
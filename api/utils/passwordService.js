const Joi = require('joi');

// Password complexity validation schema
const passwordComplexitySchema = Joi.object({
    password: Joi.string()
        .min(8)
        .max(16)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,16}$'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password must not exceed 16 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
            'any.required': 'Password is required'
        })
});

class PasswordService {
    // Validate password complexity
    static validatePassword(password) {
        const { error, value } = passwordComplexitySchema.validate({ password });
        
        if (error) {
            return {
                isValid: false,
                message: error.details[0].message,
                strength: this.calculatePasswordStrength(password)
            };
        }

        return {
            isValid: true,
            message: 'Password meets all requirements',
            strength: this.calculatePasswordStrength(password)
        };
    }

    // Calculate password strength meter
    static calculatePasswordStrength(password) {
        if (!password) return { score: 0, level: 'Very Weak' };

        let score = 0;
        const feedback = [];

        // Length check
        if (password.length >= 8) {
            score += 20;
        } else {
            feedback.push('Use at least 8 characters');
        }

        if (password.length >= 12) {
            score += 10;
        }

        // Character variety checks
        if (/[a-z]/.test(password)) {
            score += 15;
        } else {
            feedback.push('Add lowercase letters');
        }

        if (/[A-Z]/.test(password)) {
            score += 15;
        } else {
            feedback.push('Add uppercase letters');
        }

        if (/\d/.test(password)) {
            score += 15;
        } else {
            feedback.push('Add numbers');
        }

        if (/[@$!%*?&]/.test(password)) {
            score += 15;
        } else {
            feedback.push('Add special characters (@$!%*?&)');
        }

        // Additional complexity
        if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
            score += 10;
        }

        // Determine strength level
        let level;
        let color;
        
        if (score < 30) {
            level = 'Very Weak';
            color = '#dc3545';
        } else if (score < 50) {
            level = 'Weak';
            color = '#fd7e14';
        } else if (score < 70) {
            level = 'Fair';
            color = '#ffc107';
        } else if (score < 85) {
            level = 'Good';
            color = '#20c997';
        } else {
            level = 'Strong';
            color = '#28a745';
        }

        return {
            score: Math.min(score, 100),
            level,
            color,
            feedback,
            percentage: Math.min(score, 100)
        };
    }

    // Check if password was previously used
    static checkPasswordReuse(newPassword, passwordHistory, bcrypt) {
        if (!passwordHistory || passwordHistory.length === 0) {
            return { isReused: false };
        }

        for (const oldPasswordData of passwordHistory) {
            if (bcrypt.compareSync(newPassword, oldPasswordData.password)) {
                return {
                    isReused: true,
                    message: 'This password was previously used. Please choose a different password.'
                };
            }
        }

        return { isReused: false };
    }

    // Check if password needs to be changed (expiry check)
    static checkPasswordExpiry(passwordChangedAt, expiryDays = 60) {
        if (!passwordChangedAt) return { expired: true, daysUntilExpiry: 0 };

        const now = new Date();
        const passwordAge = Math.floor((now - new Date(passwordChangedAt)) / (1000 * 60 * 60 * 24));
        const daysUntilExpiry = expiryDays - passwordAge;

        return {
            expired: passwordAge >= expiryDays,
            daysUntilExpiry: Math.max(0, daysUntilExpiry),
            needsWarning: daysUntilExpiry <= 7 && daysUntilExpiry > 0
        };
    }

    // Generate password expiry date
    static generatePasswordExpiry(days = 60) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        return expiryDate;
    }

    // Maintain password history (keep last 5 passwords)
    static updatePasswordHistory(currentPasswordHistory, newHashedPassword, maxHistory = 5) {
        const updatedHistory = [
            {
                password: newHashedPassword,
                createdAt: new Date()
            },
            ...(currentPasswordHistory || [])
        ];

        // Keep only the most recent passwords
        return updatedHistory.slice(0, maxHistory);
    }

    // Generate temporary password
    static generateTemporaryPassword() {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '@$!%*?&';
        
        let password = '';
        
        // Ensure at least one character from each required group
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];
        
        // Fill the rest randomly
        const allChars = uppercase + lowercase + numbers + special;
        for (let i = 4; i < 12; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
}

module.exports = PasswordService;
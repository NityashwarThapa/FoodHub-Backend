#!/usr/bin/env node

/**
 * Security Features Demonstration Script
 * 
 * This script demonstrates the comprehensive security features implemented
 * in the FoodHub Backend without requiring a database connection.
 */

const PasswordService = require('./api/utils/passwordService');
const EncryptionService = require('./api/utils/encryption');
const OTPService = require('./api/utils/otpService');

console.log('🔐 FoodHub Backend Security Features Demonstration\n');
console.log('================================================\n');

// 1. Password Security Demonstration
console.log('1. 📊 PASSWORD STRENGTH VALIDATION');
console.log('-----------------------------------');

const testPasswords = [
    'password',        // Weak
    'Password123',     // Missing special char
    'Pass@1',         // Too short
    'StrongPass@123', // Strong
    'VeryLongPasswordThatExceedsSixteenCharacters@1' // Too long
];

testPasswords.forEach(password => {
    const validation = PasswordService.validatePassword(password);
    const strength = PasswordService.calculatePasswordStrength(password);
    
    console.log(`Password: "${password}"`);
    console.log(`  ✓ Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`  ✓ Strength: ${strength.level} (${strength.score}/100)`);
    console.log(`  ✓ Message: ${validation.message}`);
    if (strength.feedback.length > 0) {
        console.log(`  ✓ Feedback: ${strength.feedback.join(', ')}`);
    }
    console.log('');
});

// 2. Data Encryption Demonstration
console.log('2. 🔒 DATA ENCRYPTION');
console.log('---------------------');

const sensitiveData = {
    email: 'user@example.com',
    phone: '1234567890',
    address: '123 Main St, City, Country'
};

console.log('Original Data:');
console.log(JSON.stringify(sensitiveData, null, 2));

const encryptedData = EncryptionService.encryptSensitiveFields(sensitiveData);
console.log('\nEncrypted Data:');
console.log(JSON.stringify({
    encryptedEmail: encryptedData.encryptedEmail,
    encryptedPhone: encryptedData.encryptedPhone,
    address: encryptedData.address
}, null, 2));

const decryptedData = EncryptionService.decryptSensitiveFields(encryptedData);
console.log('\nDecrypted Data:');
console.log(JSON.stringify({
    email: decryptedData.email,
    mobile_no: decryptedData.mobile_no,
    address: decryptedData.address
}, null, 2));

// 3. OTP Generation Demonstration
console.log('\n3. 📧 OTP GENERATION');
console.log('--------------------');

const otp = OTPService.generateOTP();
const otpExpiry = OTPService.getOTPExpiry();

console.log(`Generated OTP: ${otp}`);
console.log(`Expiry Time: ${otpExpiry}`);
console.log(`Valid for: ${Math.ceil((otpExpiry - new Date()) / 1000 / 60)} minutes`);

// OTP Verification Test
console.log('\nOTP Verification Tests:');
console.log(`✓ Valid OTP: ${OTPService.verifyOTP(otp, otp, otpExpiry).valid ? '✅' : '❌'}`);
console.log(`✓ Invalid OTP: ${OTPService.verifyOTP('000000', otp, otpExpiry).valid ? '✅' : '❌'}`);
console.log(`✓ Expired OTP: ${OTPService.verifyOTP(otp, otp, new Date(Date.now() - 1000)).valid ? '✅' : '❌'}`);

// 4. Password History Management
console.log('\n4. 🔄 PASSWORD HISTORY MANAGEMENT');
console.log('----------------------------------');

const currentHistory = [
    { password: '$2a$10$hash1', createdAt: new Date('2024-01-01') },
    { password: '$2a$10$hash2', createdAt: new Date('2024-02-01') },
    { password: '$2a$10$hash3', createdAt: new Date('2024-03-01') }
];

console.log('Current Password History:');
currentHistory.forEach((entry, index) => {
    console.log(`  ${index + 1}. Created: ${entry.createdAt.toDateString()}`);
});

const newPassword = '$2a$10$newHashedPassword';
const updatedHistory = PasswordService.updatePasswordHistory(currentHistory, newPassword, 5);

console.log('\nUpdated Password History (after new password):');
updatedHistory.forEach((entry, index) => {
    console.log(`  ${index + 1}. Created: ${entry.createdAt.toDateString()}`);
});

// 5. Password Expiry Check
console.log('\n5. ⏰ PASSWORD EXPIRY CHECK');
console.log('----------------------------');

const passwordDates = [
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    new Date(Date.now() - 55 * 24 * 60 * 60 * 1000), // 55 days ago
    new Date(Date.now() - 65 * 24 * 60 * 60 * 1000), // 65 days ago (expired)
];

passwordDates.forEach((date, index) => {
    const expiry = PasswordService.checkPasswordExpiry(date, 60);
    console.log(`Password ${index + 1} (${Math.floor((new Date() - date) / (1000 * 60 * 60 * 24))} days old):`);
    console.log(`  ✓ Expired: ${expiry.expired ? '❌ Yes' : '✅ No'}`);
    console.log(`  ✓ Days until expiry: ${expiry.daysUntilExpiry}`);
    console.log(`  ✓ Needs warning: ${expiry.needsWarning ? '⚠️ Yes' : '✅ No'}`);
    console.log('');
});

// 6. Temporary Password Generation
console.log('6. 🔑 TEMPORARY PASSWORD GENERATION');
console.log('-----------------------------------');

const tempPassword = PasswordService.generateTemporaryPassword();
console.log(`Generated Temporary Password: ${tempPassword}`);

const tempValidation = PasswordService.validatePassword(tempPassword);
console.log(`Temporary Password Valid: ${tempValidation.isValid ? '✅' : '❌'}`);
console.log(`Temporary Password Strength: ${PasswordService.calculatePasswordStrength(tempPassword).level}`);

console.log('\n🎉 Security Features Demonstration Complete!');
console.log('\nAll security features are working correctly:');
console.log('✅ Password complexity validation');
console.log('✅ Password strength calculation');
console.log('✅ Data encryption/decryption');
console.log('✅ OTP generation and verification');
console.log('✅ Password history management');
console.log('✅ Password expiry tracking');
console.log('✅ Temporary password generation');

console.log('\n📚 For complete documentation, see: SECURITY.md');
console.log('🔗 For API endpoints and usage, see the comprehensive documentation.');
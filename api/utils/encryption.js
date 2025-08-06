const CryptoJS = require('crypto-js');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

class EncryptionService {
    static encrypt(text) {
        if (!text) return null;
        try {
            return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
        } catch (error) {
            console.error('Encryption error:', error);
            return null;
        }
    }

    static decrypt(encryptedText) {
        if (!encryptedText) return null;
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    static encryptSensitiveFields(userData) {
        if (!userData) return userData;
        
        const encrypted = { ...userData };
        
        if (userData.email && !userData.encryptedEmail) {
            encrypted.encryptedEmail = this.encrypt(userData.email);
        }
        
        if (userData.mobile_no && !userData.encryptedPhone) {
            encrypted.encryptedPhone = this.encrypt(userData.mobile_no);
        }
        
        if (userData.address) {
            encrypted.address = this.encrypt(userData.address);
        }
        
        return encrypted;
    }

    static decryptSensitiveFields(userData) {
        if (!userData) return userData;
        
        const decrypted = { ...userData };
        
        if (userData.encryptedEmail) {
            decrypted.email = this.decrypt(userData.encryptedEmail);
        }
        
        if (userData.encryptedPhone) {
            decrypted.mobile_no = this.decrypt(userData.encryptedPhone);
        }
        
        if (userData.address) {
            decrypted.address = this.decrypt(userData.address);
        }
        
        return decrypted;
    }
}

module.exports = EncryptionService;
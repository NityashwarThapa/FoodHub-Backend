# FoodHub Backend - Comprehensive Security Implementation

This document outlines the comprehensive security features implemented in the FoodHub Backend according to the Mider CW2 Security Report requirements.

## 🔐 Security Features Overview

### ✅ Password Security Features

#### Password Complexity Requirements
- **Uppercase letters**: At least one (A-Z)
- **Lowercase letters**: At least one (a-z)
- **Numbers**: At least one (0-9)
- **Special characters**: At least one (@$!%*?&)
- **Length**: Between 8-16 characters

#### Password Strength Meter
- Real-time password strength calculation
- Visual feedback with strength levels: Very Weak, Weak, Fair, Good, Strong
- Detailed feedback on what requirements are missing
- Endpoint: `POST /users/check-password-strength`

#### Password Reuse Prevention
- Stores last 5 passwords in encrypted format
- Prevents reusing any of the previous passwords
- Automatic password history management

#### Password Expiry
- Passwords expire after 60-90 days (configurable)
- Warning notifications 7 days before expiry
- Forced password change after expiration

#### Account Lockout
- Locks account after 3 failed login attempts
- Lockout duration: 30 minutes (configurable)
- Progressive lockout tracking

### 🧾 Audit Trail Implementation

#### Winston + MongoDB Logging
```javascript
// Example audit log entry
{
  "action": "USER_LOGIN",
  "userId": "user_id",
  "userEmail": "user@example.com",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "severity": "info"
  }
}
```

#### Logged Events
- User registration, login, logout
- Password changes and failed attempts
- Role changes and permission escalations
- Profile updates and data access
- Security events and violations
- Admin actions and system access

#### Admin Dashboard Endpoints
- `GET /admin/audit-logs` - View paginated audit logs
- `GET /admin/security-stats` - Security statistics dashboard

### 👤 Enhanced Authentication & RBAC

#### Dual Authentication System
- **Primary**: JWT tokens with 7-day expiration
- **Fallback**: Express sessions with secure cookies
- Automatic fallback when JWT fails

#### Role-Based Access Control
- **Roles**: user, admin, super-admin
- **Role Tampering Prevention**: Direct database verification
- **Separate Admin Routes**: `/admin/*` endpoints
- **Permission Escalation Logging**: All role changes audited

#### Session Security
```javascript
// Session configuration
{
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,        // HTTPS only in production
    httpOnly: true,      // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'   // CSRF protection
  }
}
```

### 🔒 Data Encryption

#### AES Encryption Implementation
- **Algorithm**: AES encryption via crypto-js
- **Encrypted Fields**: email, phone, address
- **Automatic**: Encrypt on save, decrypt on retrieve
- **Key Management**: Environment variable storage

```javascript
// Example usage
const encryptedData = EncryptionService.encrypt("sensitive@email.com");
const decryptedData = EncryptionService.decrypt(encryptedData);
```

### 🛡 Security Middleware Stack

#### Helmet.js Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options protection
- X-Content-Type-Options nosniff

#### Rate Limiting
- **Global**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Password Reset**: 3 attempts per 15 minutes
- **OTP Requests**: 10 attempts per 15 minutes

#### Input Sanitization
- **XSS Protection**: HTML tag stripping and encoding
- **MongoDB Injection Prevention**: Query sanitization
- **SQL Injection Prevention**: Parameterized queries

#### HTTPS Enforcement
```javascript
// Automatic HTTPS redirect in production
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});
```

### 📧 Email OTP Verification

#### OTP System
- **6-digit numeric codes**
- **10-minute expiration**
- **Email delivery** via Nodemailer
- **Rate limiting** on OTP requests

#### Verification Flow
1. User registers → OTP sent to email
2. User must verify email before login
3. OTP verification endpoint: `POST /users/verify-email`
4. Resend OTP endpoint: `POST /users/resend-otp`

### 🔧 File Upload Security

#### MIME Type Validation
```javascript
const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp'
];
```

#### File Size Limits
- **Maximum file size**: 5MB
- **Automatic rejection** of oversized files
- **Secure file handling** with Multer

## 🚀 API Endpoints

### Authentication Endpoints
```
POST /users/register              - User registration with OTP
POST /users/login                 - User login with security checks
POST /users/logout                - Secure logout
POST /users/verify-email          - Email verification
POST /users/resend-otp            - Resend verification OTP
POST /users/check-password-strength - Password strength validation
```

### User Management
```
GET  /users/my-profile           - Get user profile
PUT  /users/update-profile/:id   - Update profile (role-protected)
PUT  /users/change-password      - Change password with validation
PUT  /users/upload-pp            - Upload profile picture (secure)
```

### Admin Endpoints
```
GET  /admin/audit-logs           - View audit logs
GET  /admin/security-stats       - Security dashboard
POST /admin/unlock-account/:id   - Unlock user account
POST /admin/force-password-reset/:id - Force password reset
PUT  /admin/change-role/:id      - Change user role (super-admin only)
```

## 📊 Security Monitoring

### Real-time Security Events
- Failed login attempts tracking
- Suspicious activity detection
- Role escalation attempts
- Brute force attack prevention

### Admin Security Dashboard
- Total users and verification status
- Locked accounts monitoring
- Password expiry tracking
- Recent security events

### Audit Log Analysis
- Searchable and filterable logs
- Event type categorization
- Time-based queries
- User activity tracking

## 🔧 Configuration

### Environment Variables
```bash
# Security Configuration
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
ENCRYPTION_KEY=your-32-char-encryption-key

# Password Security
PASSWORD_EXPIRY_DAYS=60
MAX_LOGIN_ATTEMPTS=3
ACCOUNT_LOCKOUT_DURATION=30

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=FoodHub <your-email@gmail.com>

# Frontend Integration
FRONTEND_URL=http://localhost:3000
```

### Security Best Practices Implemented

1. **Defense in Depth**: Multiple security layers
2. **Principle of Least Privilege**: Role-based access
3. **Fail Secure**: Secure defaults and error handling
4. **Complete Mediation**: All requests validated
5. **Security by Design**: Built-in security features

## 🧪 Testing

### Security Test Suite
Comprehensive test coverage for:
- Password complexity validation
- Account lockout mechanisms
- Rate limiting effectiveness
- Input sanitization
- Authentication flows
- Authorization controls
- Data encryption/decryption
- Audit logging

### Test Files
- `test/security.test.js` - Complete security feature tests
- `test/user.test.js` - Enhanced user management tests

## 📝 Security Compliance

### OWASP Top 10 Protection
1. ✅ **Injection**: Input sanitization and parameterized queries
2. ✅ **Broken Authentication**: Multi-factor auth and session management
3. ✅ **Sensitive Data Exposure**: Data encryption and secure transmission
4. ✅ **XML External Entities**: Not applicable (JSON API)
5. ✅ **Broken Access Control**: RBAC and permission validation
6. ✅ **Security Misconfiguration**: Secure defaults and headers
7. ✅ **Cross-Site Scripting**: XSS protection middleware
8. ✅ **Insecure Deserialization**: Input validation and sanitization
9. ✅ **Known Vulnerabilities**: Regular dependency updates
10. ✅ **Insufficient Logging**: Comprehensive audit trail

### Data Protection Compliance
- **Data Minimization**: Only required data stored
- **Encryption at Rest**: Sensitive data encrypted in database
- **Encryption in Transit**: HTTPS enforcement
- **Access Controls**: Role-based data access
- **Audit Trail**: Complete activity logging

## 🔄 Migration Notes

### Existing User Migration
- Existing users will be prompted to verify email on next login
- Password expiry will be set based on last login date
- Account lockout counters initialized to zero

### Database Schema Updates
- New fields added to User model for security features
- Audit log collection created automatically
- Indexes added for performance optimization

## 📞 Support

For security-related questions or issues:
1. Check the audit logs for detailed event information
2. Review the admin security dashboard for system status
3. Consult this documentation for feature explanations
4. Contact the development team for additional support

---

**Security Implementation Completed**: All Mider CW2 Security Report requirements have been successfully implemented with comprehensive testing and documentation.
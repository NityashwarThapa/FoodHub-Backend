const winston = require('winston');
const { MongoDB } = require('winston-mongodb');
require('dotenv').config();

// Create MongoDB transport for Winston
const mongoTransport = new MongoDB({
    db: process.env.NODE_ENV === "test" ? process.env.MONGO_DB_REMOTE_TEST : process.env.MONGO_DB_REMOTE,
    collection: 'audit_logs',
    options: {
        useUnifiedTopology: true
    },
    metaKey: 'metadata'
});

// Create the logger
const auditLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // MongoDB transport for audit trail
        mongoTransport,
        // File transport as backup
        new winston.transports.File({
            filename: 'logs/audit.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

class AuditService {
    static logUserActivity(action, userId, userEmail, metadata = {}) {
        const logData = {
            action,
            userId,
            userEmail,
            timestamp: new Date(),
            metadata: {
                ...metadata,
                userAgent: metadata.userAgent || 'unknown',
                ipAddress: metadata.ipAddress || 'unknown'
            }
        };

        auditLogger.info('User Activity', logData);
        return logData;
    }

    static logSecurityEvent(event, userId, userEmail, metadata = {}) {
        const logData = {
            eventType: 'SECURITY',
            event,
            userId,
            userEmail,
            timestamp: new Date(),
            metadata: {
                ...metadata,
                severity: metadata.severity || 'medium',
                userAgent: metadata.userAgent || 'unknown',
                ipAddress: metadata.ipAddress || 'unknown'
            }
        };

        auditLogger.warn('Security Event', logData);
        return logData;
    }

    static logFailedLogin(email, ipAddress, userAgent, reason = 'Invalid credentials') {
        const logData = {
            eventType: 'AUTHENTICATION',
            event: 'FAILED_LOGIN',
            email,
            reason,
            timestamp: new Date(),
            metadata: {
                ipAddress,
                userAgent,
                severity: 'high'
            }
        };

        auditLogger.error('Failed Login Attempt', logData);
        return logData;
    }

    static logSuccessfulLogin(userId, email, ipAddress, userAgent) {
        const logData = {
            eventType: 'AUTHENTICATION',
            event: 'SUCCESSFUL_LOGIN',
            userId,
            email,
            timestamp: new Date(),
            metadata: {
                ipAddress,
                userAgent,
                severity: 'info'
            }
        };

        auditLogger.info('Successful Login', logData);
        return logData;
    }

    static logPasswordChange(userId, email, ipAddress, userAgent) {
        const logData = {
            eventType: 'SECURITY',
            event: 'PASSWORD_CHANGED',
            userId,
            email,
            timestamp: new Date(),
            metadata: {
                ipAddress,
                userAgent,
                severity: 'medium'
            }
        };

        auditLogger.info('Password Changed', logData);
        return logData;
    }

    static logAccountLocked(userId, email, ipAddress, userAgent) {
        const logData = {
            eventType: 'SECURITY',
            event: 'ACCOUNT_LOCKED',
            userId,
            email,
            timestamp: new Date(),
            metadata: {
                ipAddress,
                userAgent,
                severity: 'high'
            }
        };

        auditLogger.warn('Account Locked', logData);
        return logData;
    }

    static logRoleChange(adminUserId, targetUserId, oldRole, newRole, ipAddress, userAgent) {
        const logData = {
            eventType: 'AUTHORIZATION',
            event: 'ROLE_CHANGED',
            adminUserId,
            targetUserId,
            oldRole,
            newRole,
            timestamp: new Date(),
            metadata: {
                ipAddress,
                userAgent,
                severity: 'high'
            }
        };

        auditLogger.warn('Role Changed', logData);
        return logData;
    }

    static async getAuditLogs(filters = {}, page = 1, limit = 50) {
        // This would be implemented with a direct MongoDB query
        // since Winston doesn't provide a good query interface
        try {
            const mongoose = require('mongoose');
            const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }), 'audit_logs');
            
            const query = {};
            
            if (filters.userId) query.userId = filters.userId;
            if (filters.eventType) query.eventType = filters.eventType;
            if (filters.startDate && filters.endDate) {
                query.timestamp = {
                    $gte: new Date(filters.startDate),
                    $lte: new Date(filters.endDate)
                };
            }

            const total = await AuditLog.countDocuments(query);
            const logs = await AuditLog.find(query)
                .sort({ timestamp: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            return {
                logs,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            return { logs: [], total: 0, page, limit, totalPages: 0 };
        }
    }
}

module.exports = { AuditService, auditLogger };
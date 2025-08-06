const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const { body, validationResult } = require('express-validator');

class SecurityMiddleware {
    // Helmet configuration for security headers
    static configureHelmet() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });
    }

    // Rate limiting middleware
    static createRateLimit(windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') {
        return rateLimit({
            windowMs,
            max,
            message: {
                success: false,
                message,
                retryAfter: Math.ceil(windowMs / 1000)
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
    }

    // Strict rate limiting for authentication endpoints
    static createAuthRateLimit() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            message: {
                success: false,
                message: 'Too many authentication attempts. Please try again later.',
                retryAfter: 900 // 15 minutes in seconds
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true,
        });
    }

    // MongoDB injection protection
    static mongoSanitization() {
        return mongoSanitize({
            replaceWith: '_',
            onSanitize: ({ req, key }) => {
                console.warn(`Sanitized key: ${key} in request from IP: ${req.ip}`);
            },
        });
    }

    // XSS protection middleware
    static xssProtection() {
        return (req, res, next) => {
            // Sanitize request body
            if (req.body && typeof req.body === 'object') {
                for (const key in req.body) {
                    if (typeof req.body[key] === 'string') {
                        req.body[key] = xss(req.body[key]);
                    }
                }
            }

            // Sanitize query parameters
            if (req.query && typeof req.query === 'object') {
                for (const key in req.query) {
                    if (typeof req.query[key] === 'string') {
                        req.query[key] = xss(req.query[key]);
                    }
                }
            }

            next();
        };
    }

    // HTTPS enforcement middleware
    static enforceHTTPS() {
        return (req, res, next) => {
            // Skip in development
            if (process.env.NODE_ENV === 'development') {
                return next();
            }

            if (req.header('x-forwarded-proto') !== 'https') {
                return res.redirect(`https://${req.header('host')}${req.url}`);
            }
            next();
        };
    }

    // File upload security middleware
    static validateFileUpload() {
        return (req, res, next) => {
            if (req.file) {
                const allowedMimeTypes = [
                    'image/jpeg',
                    'image/jpg',
                    'image/png',
                    'image/gif',
                    'image/webp'
                ];

                if (!allowedMimeTypes.includes(req.file.mimetype)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid file type. Only image files are allowed.'
                    });
                }

                // Check file size (5MB limit)
                if (req.file.size > 5 * 1024 * 1024) {
                    return res.status(400).json({
                        success: false,
                        message: 'File size too large. Maximum size is 5MB.'
                    });
                }
            }
            next();
        };
    }

    // Input validation error handler
    static handleValidationErrors() {
        return (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            next();
        };
    }

    // Session security configuration
    static getSessionConfig() {
        return {
            secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production', // HTTPS only in production
                httpOnly: true, // Prevent XSS
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                sameSite: 'strict' // CSRF protection
            },
            name: 'foodhub.sid' // Change default session name
        };
    }

    // IP whitelist middleware (for admin operations)
    static ipWhitelist(allowedIPs = []) {
        return (req, res, next) => {
            if (allowedIPs.length === 0) {
                return next(); // No IP restriction if list is empty
            }

            const clientIP = req.ip || req.connection.remoteAddress;
            const isAllowed = allowedIPs.some(ip => {
                if (ip.includes('/')) {
                    // CIDR notation support would go here
                    return false;
                }
                return ip === clientIP;
            });

            if (!isAllowed) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied from this IP address'
                });
            }

            next();
        };
    }

    // Request logging middleware
    static requestLogger() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
            });

            next();
        };
    }
}

module.exports = SecurityMiddleware;
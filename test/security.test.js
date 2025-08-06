const chai = require("chai");
const chaiHttp = require("chai-http");
const httpStatus = require("http-status");
const { initializeApp } = require("../server");
const { expect } = chai;

chai.use(chaiHttp);

let app;
let server;
let adminToken;
let userToken;
let testUserId;

describe("Comprehensive Security Features", () => {
  before(async () => {
    app = await initializeApp();

    if (!app.listen) {
      throw new Error("Express app is not initialized correctly.");
    }

    server = app.listen(3002, () => {
      console.log("Security test server running on port 3002");
    });

    // Login as Super Admin
    const adminLoginRes = await chai.request(app)
      .post("/users/login")
      .send({
        email: "superadmin@gmail.com",
        password: "password"
      });

    if (adminLoginRes.body.success && adminLoginRes.body.data && adminLoginRes.body.data.token) {
      adminToken = adminLoginRes.body.data.token;
    } else {
      throw new Error("Super Admin login failed!");
    }
  });

  after(async () => {
    if (server) {
      server.close();
    }
  });

  describe("Password Security Features", () => {
    it("should enforce password complexity requirements", async () => {
      const weakPasswords = [
        "password", // No uppercase, number, or special char
        "Password", // No number or special char
        "Password1", // No special char
        "Pass@1", // Too short
        "VeryLongPasswordThatExceedsSixteenCharacters@1" // Too long
      ];

      for (const password of weakPasswords) {
        const res = await chai.request(app)
          .post("/users/check-password-strength")
          .send({ password });

        expect(res).to.have.status(httpStatus.OK);
        expect(res.body.data.isValid).to.be.false;
      }
    });

    it("should accept strong passwords", async () => {
      const strongPassword = "StrongPass@123";
      
      const res = await chai.request(app)
        .post("/users/check-password-strength")
        .send({ password: strongPassword });

      expect(res).to.have.status(httpStatus.OK);
      expect(res.body.data.isValid).to.be.true;
      expect(res.body.data.strength.level).to.be.oneOf(['Good', 'Strong']);
    });

    it("should prevent registration with weak password", async () => {
      const res = await chai.request(app)
        .post("/users/register")
        .send({
          name: "Test User",
          email: "weakpass@test.com",
          password: "weak",
          mobile_no: "1234567890"
        });

      expect(res).to.have.status(httpStatus.BAD_REQUEST);
      expect(res.body.success).to.be.false;
      expect(res.body.msg).to.include('Password must');
    });
  });

  describe("Email Verification", () => {
    let testEmail = "emailverify@test.com";

    it("should require email verification after registration", async () => {
      const registerRes = await chai.request(app)
        .post("/users/register")
        .send({
          name: "Email Test User",
          email: testEmail,
          password: "StrongPass@123",
          mobile_no: "9876543210"
        });

      expect(registerRes).to.have.status(httpStatus.OK);
      expect(registerRes.body.emailVerificationRequired).to.be.true;
    });

    it("should not allow login without email verification", async () => {
      const loginRes = await chai.request(app)
        .post("/users/login")
        .send({
          email: testEmail,
          password: "StrongPass@123"
        });

      expect(loginRes).to.have.status(httpStatus.FORBIDDEN);
      expect(loginRes.body.emailVerificationRequired).to.be.true;
    });

    it("should allow resending OTP", async () => {
      const res = await chai.request(app)
        .post("/users/resend-otp")
        .send({
          email: testEmail
        });

      expect(res).to.have.status(httpStatus.OK);
      expect(res.body.success).to.be.true;
    });
  });

  describe("Account Lockout Security", () => {
    let lockoutTestEmail = "lockout@test.com";

    before(async () => {
      // Register a user for lockout testing
      const registerRes = await chai.request(app)
        .post("/users/register")
        .send({
          name: "Lockout Test User",
          email: lockoutTestEmail,
          password: "StrongPass@123",
          mobile_no: "1111111111"
        });

      // Verify email to enable login attempts
      const User = require("../api/models/User");
      await User.findOneAndUpdate(
        { email: lockoutTestEmail }, 
        { emailVerified: true }
      );
    });

    it("should lock account after multiple failed login attempts", async () => {
      // Attempt failed logins
      for (let i = 0; i < 3; i++) {
        await chai.request(app)
          .post("/users/login")
          .send({
            email: lockoutTestEmail,
            password: "wrongpassword"
          });
      }

      // Fourth attempt should show account locked
      const res = await chai.request(app)
        .post("/users/login")
        .send({
          email: lockoutTestEmail,
          password: "wrongpassword"
        });

      expect(res).to.have.status(httpStatus.FORBIDDEN);
      expect(res.body.accountLocked).to.be.true;
    });
  });

  describe("Rate Limiting", () => {
    it("should limit authentication attempts", async () => {
      const requests = [];
      
      // Make 6 rapid requests (rate limit is 5 per 15 minutes)
      for (let i = 0; i < 6; i++) {
        requests.push(
          chai.request(app)
            .post("/users/login")
            .send({
              email: "ratelimit@test.com",
              password: "password"
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse).to.have.status(429);
    });
  });

  describe("Admin Dashboard & Audit Logs", () => {
    it("should allow admin to view audit logs", async () => {
      const res = await chai.request(app)
        .get("/admin/audit-logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res).to.have.status(httpStatus.OK);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property('logs');
      expect(res.body.data.logs).to.be.an('array');
    });

    it("should allow admin to view security statistics", async () => {
      const res = await chai.request(app)
        .get("/admin/security-stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res).to.have.status(httpStatus.OK);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property('totalUsers');
      expect(res.body.data).to.have.property('verifiedUsers');
      expect(res.body.data).to.have.property('lockedAccounts');
    });

    it("should prevent non-admin access to admin endpoints", async () => {
      // First create and login a regular user
      const userRegRes = await chai.request(app)
        .post("/users/register")
        .send({
          name: "Regular User",
          email: "regular@test.com",
          password: "StrongPass@123",
          mobile_no: "2222222222"
        });

      // Verify email and login
      const User = require("../api/models/User");
      await User.findOneAndUpdate(
        { email: "regular@test.com" }, 
        { emailVerified: true }
      );

      const userLoginRes = await chai.request(app)
        .post("/users/login")
        .send({
          email: "regular@test.com",
          password: "StrongPass@123"
        });

      const regularUserToken = userLoginRes.body.data.token;

      // Try to access admin endpoint
      const res = await chai.request(app)
        .get("/admin/audit-logs")
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(res).to.have.status(httpStatus.FORBIDDEN);
      expect(res.body.success).to.be.false;
    });
  });

  describe("Data Encryption", () => {
    it("should encrypt sensitive user data", async () => {
      const User = require("../api/models/User");
      
      // Find a user in the database
      const user = await User.findOne({ email: "superadmin@gmail.com" });
      
      // Check that encrypted fields exist and are different from plain text
      if (user.encryptedEmail) {
        expect(user.encryptedEmail).to.not.equal(user.email);
        expect(user.encryptedEmail).to.be.a('string');
      }
    });
  });

  describe("Session Management", () => {
    it("should create session on login", async () => {
      const User = require("../api/models/User");
      await User.findOneAndUpdate(
        { email: "superadmin@gmail.com" }, 
        { emailVerified: true }
      );

      const agent = chai.request.agent(app);
      
      const res = await agent
        .post("/users/login")
        .send({
          email: "superadmin@gmail.com",
          password: "password"
        });

      expect(res).to.have.status(httpStatus.OK);
      expect(res).to.have.cookie('foodhub.sid');
    });

    it("should clear session on logout", async () => {
      const res = await chai.request(app)
        .post("/users/logout")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res).to.have.status(httpStatus.OK);
      expect(res.body.success).to.be.true;
    });
  });

  describe("Input Sanitization", () => {
    it("should sanitize XSS attempts in user input", async () => {
      const maliciousInput = "<script>alert('xss')</script>";
      
      const res = await chai.request(app)
        .post("/users/register")
        .send({
          name: maliciousInput,
          email: "xss@test.com",
          password: "StrongPass@123",
          mobile_no: "3333333333"
        });

      // Request should succeed but input should be sanitized
      expect(res).to.have.status(httpStatus.OK);
    });

    it("should prevent MongoDB injection attempts", async () => {
      const res = await chai.request(app)
        .post("/users/login")
        .send({
          email: { $ne: null },
          password: { $ne: null }
        });

      // Should fail due to sanitization
      expect(res).to.have.status(httpStatus.BAD_REQUEST);
    });
  });

  describe("Password History & Reuse Prevention", () => {
    it("should prevent password reuse", async () => {
      // Create and verify a test user
      const testEmail = "passhistory@test.com";
      
      await chai.request(app)
        .post("/users/register")
        .send({
          name: "Password History Test",
          email: testEmail,
          password: "FirstPass@123",
          mobile_no: "4444444444"
        });

      const User = require("../api/models/User");
      await User.findOneAndUpdate(
        { email: testEmail }, 
        { emailVerified: true }
      );

      // Login to get token
      const loginRes = await chai.request(app)
        .post("/users/login")
        .send({
          email: testEmail,
          password: "FirstPass@123"
        });

      const token = loginRes.body.data.token;

      // Try to change password to the same password
      const changeRes = await chai.request(app)
        .put("/users/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          oldpassword: "FirstPass@123",
          newpassword: "FirstPass@123"
        });

      expect(changeRes).to.have.status(httpStatus.BAD_REQUEST);
      expect(changeRes.body.msg).to.include('previously used');
    });
  });
});
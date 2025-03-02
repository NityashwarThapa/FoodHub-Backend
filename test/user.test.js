const chai = require("chai");
const chaiHttp = require("chai-http");
const httpStatus = require("http-status");
const { initializeApp } = require("../server");
const { expect } = chai;

chai.use(chaiHttp);

let app;
let token;
let adminToken;
let userId;
let server;

describe("User Authentication and Management", () => {
  before(async () => {
    app = await initializeApp();

    if (!app.listen) {
      throw new Error("Express app is not initialized correctly.");
    }

    server = app.listen(3001, () => {
      console.log("Test server running on port 3001");
    });

    // ✅ 1. Login as Super Admin to perform admin actions
    const adminLoginRes = await chai.request(app)
      .post("/users/login")
      .send({
        email: "superadmin@gmail.com",
        password: "password"
      });

    console.log("Admin Login Response:", adminLoginRes.body);

    if (adminLoginRes.body.success && adminLoginRes.body.data && adminLoginRes.body.data.token) {
      adminToken = adminLoginRes.body.data.token;
    } else {
      throw new Error("Super Admin login failed! Cannot retrieve token.");
    }

    // ✅ 2. Ensure test user is deleted before registration
    console.log("Deleting existing test user (if exists)...");

    const deleteRes = await chai.request(app)
      .delete(`/users/delete-user/67c32d4c263d5912bf89fa4c`) // Replace with actual user ID if known
      .set("Authorization", `Bearer ${adminToken}`)
      .catch(() => console.log("Test user not found, skipping deletion."));

    console.log("User Deletion Response:", deleteRes.body);

    // ✅ 3. Register new test user
    const registerRes = await chai.request(app)
      .post("/users/register")
      .send({
        name: "Test User",
        email: "testuser@gmail.com",
        password: "Test@123",
        mobile_no: "9800000000"
      });

    console.log("User Registration Response:", registerRes.body);

    if (!registerRes.body.success && registerRes.body.msg !== "User Already Exists!!") {
      throw new Error("User registration failed!");
    }

    // ✅ 4. Login user
    const loginRes = await chai.request(app)
      .post("/users/login")
      .send({
        email: "testuser@gmail.com",
        password: "Test@123"
      });

    console.log("Login Response:", loginRes.body);

    if (loginRes.body.success && loginRes.body.data && loginRes.body.data.token) {
      token = loginRes.body.data.token;
      userId = loginRes.body.data._id;
    } else {
      throw new Error("Login failed! Cannot retrieve token.");
    }
  });

  after(async () => {
    if (server) {
      server.close();
    }
  });

  it("should retrieve all users (Admin Access)", async () => {
    const res = await chai.request(app)
      .get("/users/all")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res).to.have.status(httpStatus.OK);
    expect(res.body).to.have.property("success", true);
    expect(res.body.data).to.be.an("array");
  });

  it("should retrieve my profile", async () => {
    const res = await chai.request(app)
      .get("/users/my-profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res).to.have.status(httpStatus.OK);
    expect(res.body).to.have.property("success", true);
    expect(res.body.data).to.have.property("email", "testuser@gmail.com");
  });

  it("should update user profile", async () => {
    const res = await chai.request(app)
      .put(`/users/update-profile/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Test User" });

    expect(res).to.have.status(httpStatus.OK);
    expect(res.body).to.have.property("success", true);
  });

  it("should change user password", async () => {
    const res = await chai.request(app)
      .put("/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldpassword: "Test@123", newpassword: "NewPass@123" });

    expect(res).to.have.status(httpStatus.OK);
    expect(res.body).to.have.property("success", true);
  });

  it("should delete the user successfully (Admin Access)", async () => {
    const res = await chai.request(app)
      .delete(`/users/delete-user/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res).to.have.status(httpStatus.OK);
    expect(res.body).to.have.property("success", true);
  });
});

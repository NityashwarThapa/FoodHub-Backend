const chai = require("chai");
const chaiHttp = require("chai-http");
const httpStatus = require("http-status");
const { initializeApp } = require("../server");
const { expect } = chai;

chai.use(chaiHttp);

let app;
let token;
let productId;
let server;
const validCategoryId = "67ac5e532dd46fc4692c9ee7"; // ✅ Use  category from  database

describe("Product Management", () => {
  before(async () => {
    app = await initializeApp();

    if (!app.listen) {
      throw new Error("Express app is not initialized correctly.");
    }

    server = app.listen(3001, () => {
      console.log("Test server running on port 3001");
    });

    // ✅ Login as Super Admin
    const loginRes = await chai.request(app)
      .post("/users/login")
      .send({
        email: "superadmin@gmail.com",
        password: "password" // ✅ Corrected to match database
      });

    console.log("Admin Login Response:", loginRes.body);

    if (loginRes.body.success && loginRes.body.data && loginRes.body.data.token) {
      token = loginRes.body.data.token;
    } else {
      throw new Error("❌ Super Admin login failed! Cannot retrieve token.");
    }

    // ✅ Check if a product exists before creating a new one
    const productRes = await chai.request(app).get("/products");
    
    if (productRes.body.success && productRes.body.data.length > 0) {
      productId = productRes.body.data[0]._id; // ✅ Use existing product
    } else {
      // ✅ Create a product if none exist
      const newProduct = await chai.request(app)
        .post("/products")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Chowmein",
          sku: "chowmein_9076",
          category: validCategoryId, // ✅ Use valid category
          description: "Butwal local Meat special",
          price: 150,
          calorie_count: 20,
          images: ["public/uploads/1739350762963images.jpeg"]
        });

      if (newProduct.body.success) {
        productId = newProduct.body.data._id;
      } else {
        throw new Error("❌ Failed to create a test product.");
      }
    }
  });

  after(async () => {
    if (server) {
      server.close();
    }
  });

  it("should get all products", async () => {
    const res = await chai.request(app)
      .get("/products");

    expect(res).to.have.status(httpStatus.OK);
    expect(res.body).to.have.property("success", true);
    expect(res.body.data).to.be.an("array");
  });

  

  it("should update the product", async () => {
    const res = await chai.request(app)
      .put(`/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated sprite", price: 180 });

    expect(res).to.have.status(httpStatus.OK);
    expect(res.body).to.have.property("success", true);
  });

});

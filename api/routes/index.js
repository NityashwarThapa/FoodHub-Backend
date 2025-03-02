const express = require('express');
const router = express.Router()

const productRoutes = require("./productRoutes");
const cartsRoutes = require("./cartRoutes");
const usersRoutes = require("./userRoutes");
const reviewsRoutes = require("./reviewRoutes");
const categoryRoutes = require("./category.route");
const wishListRoutes = require("./wishlistRoute");

router.use("/carts", cartsRoutes);
router.use("/products", productRoutes);
router.use("/users", usersRoutes);
router.use("/reviews", reviewsRoutes);
router.use("/category",categoryRoutes);
router.use("/wishlist",wishListRoutes);

module.exports = router;
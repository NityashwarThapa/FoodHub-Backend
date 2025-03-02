// const express = require('express');
// const Carts = require('../models/Carts');
// const router = express.Router();

// const cartController = require('../controllers/cartControllers');

// const verifyToken = require('../middlewares/verifyToken');
// const verifyAdmin = require('../middlewares/verifyAdmin');

// router.get('/',verifyToken, (req, res) => {
//     cartController.getCartByEmail(req, res)
// });
// // post cart item
// router.post('/', cartController.addToCarts);

// // delete cart item
// router.delete('/:id', cartController.deleteCart)

// // update cart quantity
// router.put('/:id', cartController.updateCart);

// // get single cart item
// router.get('/:id', cartController.getSingleCart);

// module.exports = router;


const cartController = require("../controllers/cartControllers");
const { verifyUser, verifyAuthorization } = require("../middlewares/authMiddlerware");

const router = require("express").Router()

router.post('/add', verifyUser, cartController.addToCart)

router.get('/my-order', verifyUser, cartController.myOrder)

router.get('/my-cart', verifyUser, cartController.getMyCart)

router.get('/checkout', cartController.checkout)
router.put('/checkout/:cart_id', cartController.checkoutMobile)

router.put('/add-remove-item', verifyUser, cartController.removeItems)

router.get('/admin/order', verifyUser, cartController.getOrders)

router.put('/change-status', verifyUser, verifyAuthorization, cartController.cartStatusChange)


module.exports = router
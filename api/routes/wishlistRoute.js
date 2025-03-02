const wishListContrller = require("../controllers/wishlistController");
const { verifyUser } = require("../middlewares/authMiddlerware");

const router = require("express").Router()

router.post('/:product', verifyUser, wishListContrller.addRemoveWishList)

router.get('/', verifyUser, wishListContrller.getWishList)


module.exports = router
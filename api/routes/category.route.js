const categoryController = require("../controllers/categoryController");
const { verifyUser, verifyAuthorization } = require("../middlewares/authMiddlerware");

const router = require("express").Router()

router.post('/', verifyUser, verifyAuthorization, categoryController.addCategory)

router.get('/',  categoryController.getCategories)

router.get('/:id', categoryController.getCategory)

router.put('/:id', verifyUser, verifyAuthorization, categoryController.updateCategory)

router.delete('/:id', verifyUser, verifyAuthorization, categoryController.deleteCategory)


module.exports = router
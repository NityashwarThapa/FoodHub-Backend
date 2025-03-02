const express = require('express');
const router = express.Router();
const userController = require('../controllers/userControllers');
const { verifyUser, verifyAuthorization } = require("../middlewares/authMiddlerware");

router.post('/login', userController.login)

router.post('/register', userController.register)

router.get('/all', verifyUser, verifyAuthorization, userController.allUser)

router.get('/my-profile', verifyUser, userController.myProfile)

router.put('/update-profile/:id', verifyUser, userController.updateProfile)

router.put('/upload-pp', verifyUser, userController.uploadPP)

router.put('/change-password', verifyUser, userController.changePassword)

router.delete('/delete-user/:id', verifyUser, verifyAuthorization, userController.deleteUser)


module.exports = router

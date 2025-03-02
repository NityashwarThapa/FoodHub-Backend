const Joi = require("joi");
const User = require("../models/User");
const httpStatus = require("http-status");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const upload = require("../middlewares/uploads");
const Cart = require("../models/Carts");

const userValidationSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  mobile_no: Joi.string().required()
});

const loginValidationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const createCart = async (user) => {
  try {
    //check if active cart exists
    const activeCart = await Cart.findOne({
      user_id: user._id,
      status: "CART"
    });
    if (activeCart) return;

    //get cart_no 
    const result = await Cart.findOne({}).sort({ _id: -1 });
    const cart_no = result ? result.cart_no + 1 : 1000;

    const cart = await Cart.create({ cart_no, user_id: user._id });
  } catch (error) {
    throw error;
  }
};

const login = async (req, res, next) => {
  try {
    const { error } = loginValidationSchema.validate(req.body);
    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: error.message
      });
    }
    const user = await User.findOne({
      email: req.body.email
    }).lean();

    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        msg: "User Not Registered!!"
      });
    }

    // check if password is valid
    const checkPassword = await bcrypt.compare(req.body.password, user.password);
    if (!checkPassword) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        msg: "Email or Password Incorrect!!"
      });
    }

    // generate and send a JWT token for the authenticated user
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const { password, __v, ...data } = user;

    //create cart for the user
    await createCart(user);

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Login Success!!",
      data: {
        ...(data),
        token
      }
    });
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: error.message
    });
  }
};

const register = async (req, res, next) => {
  try {
    const { error } = userValidationSchema.validate(req.body);
    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: error.message
      });
    }

    const checkUserExist = await User.findOne({
      email: req.body.email
    });
    if (checkUserExist) {
      return res.status(httpStatus.CONFLICT).json({
        success: false,
        msg: "User Already Exists!!"
      });
    }

    bcrypt.genSalt(10, async (error, salt) => {
      bcrypt.hash(req.body.password, salt, async (error, hash) => {
        const user = await User.create({ ...req.body, password: hash });
        if (user) {
          await createCart(user)
          return res.status(httpStatus.OK).json({
            success: true,
            msg: 'Registration Completed'
          });
        } else {
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: "Failed to Register!!"
          });
        }
      });
    });
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: error.message
    });
  }
};

const allUser = async (req, res, next) => {
  try {
    const { page = 1, size = 10, sort =
      { _id: -1 } } = req.query;

    let searchQuery = {};

    if (req.query.search) {
      searchQuery = {
        ...searchQuery,
        name: { $regex: req.query.search, $options: 'i' }
      };
    }

    const users = await User.find(searchQuery).select("name email mobile_no image").skip((page - 1) * size).limit(size).sort(sort);

    const totalCount = await User.countDocuments();
    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Users!!",
      data: users,
      page,
      size,
      totalCount
    });

  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Something Went Wrong!!"
    });
  }
};

const myProfile = async (req, res, next) => {
  try {
    const { password, role, createdAt, updatedAt, __v, ...data } = req.user;
    return res.status(httpStatus.OK).json({
      success: true,
      msg: "User!!",
      data: data
    });
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Something Went Wrong!!"
    });
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        msg: "User Not Registered!!"
      });
    }

    await User.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    return res.status(httpStatus.OK).json({
      success: true,
      msg: "User Profile Updated!!"
    });
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Something Went Wrong!!"
    });
  }
};

const uploadPP = async (req, res) => {
  upload.single('image')(req, res, async error => {
    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        msg: error.message
      });
    }
    try {
      console.log("req.file", req.file);
      await User.findByIdAndUpdate(req.user._id, {
        image: req.file ? req.file.path : ''
      });
      return res.status(httpStatus.OK).json({
        success: true,
        msg: "Profile Image Updated!!",
        data: {
          image: req.file ? req.file.path : ''
        }
      });
    } catch (error) {
      console.log("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        msg: "Something Went Wrong!!"
      });
    }
  });
};

const changePassword = async (req, res) => {
  try {
    const { oldpassword, newpassword } = req.body;

    //check if old password matches
    const checkPassword = await bcrypt.compare(oldpassword, req.user.password);
    if (!checkPassword) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        msg: "Invalid Credential!!"
      });
    }
    bcrypt.genSalt(10, async (error, salt) => {
      bcrypt.hash(newpassword, salt, async (error, hash) => {
        await User.findByIdAndUpdate(req.user._id, {
          password: hash
        }, { new: true });
      });
    });
    return res.status(httpStatus.OK).json({
      success: true,
      msg: "Password Changed!!"
    });
  } catch (error) {
    console.log("error", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: "Something Went Wrong!!"
    });
  }
};

// delete user
const deleteUser = async (req, res) => {
  const userId = req.params.id;
  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    // console.log(deletedUser);

    if (!deletedUser) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }

    return res.status(httpStatus.OK).json({ success: true, message: "User Deleted Successfully" });
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

module.exports = {
  login,
  register,
  allUser,
  myProfile,
  updateProfile,
  uploadPP,
  changePassword,
  deleteUser,
  createCart
};

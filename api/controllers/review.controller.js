const httpStatus = require("http-status");
const Joi = require("joi");
const Review = require("../models/Review");
const Product = require("../models/Product");


const reviewValidationSchema = Joi.object({
    message: Joi.string().optional(),
    rating: Joi.number().min(0).max(5).required()
});

const addUpdateReview = async (req, res) => {
    try {
        const { product, rating, message } = req.body;
        const checkProduct = await Product.findById(
            product,
        );

        if (!checkProduct) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                msg: "Product Not Found!!"
            });
        }

        let review = await Review.findOne({
            user: req.user._id,
            product: checkProduct._id
        });

        if (review) {
            review.rating = rating,
                review.message = message;
            await review.save();
        } else {
            review = await Review.create({
                product, rating, message, user: req.user._id
            });
        }

        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Rating updated!!",
            data: review
        });

    } catch (error) {
        console.log("error", error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: "Something Went Wrong!!"
        });
    }
};

const getProductReviews = async (req, res) => {
    try {
        const { page = 1, size = 10 } = req.query;

        const reviews = await Review.find({ product: req.params.product }).populate({ path: 'user', select: '-password -__v -createdAt -updatedAt' }).skip((page - 1) * size).limit(size);

        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Ratings!!",
            data: reviews
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: "Something Went Wrong!!"
        });
    }
};


module.exports = {
    addUpdateReview,
    getProductReviews
};
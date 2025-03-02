
const httpStatus = require("http-status");
const WishList = require("../models/Wishlist");
const Product = require("../models/Product");

const addRemoveWishList = async (req, res) => {
    try {
        //product
        const product = await Product.findById(req.params.product)

        if(!product){
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                msg: "Product Not Found."
            }) 
        }

        let wishlist = await WishList.findOne({
            product: req.params.product,
            user: req.user._id
        }).select("user product").populate([{
            path: "user",
            select: "name email mobile_no"
        },
        {
            path: "product",
            select: "name sku price images"
        }]);

        if (wishlist) {
            await WishList.findByIdAndDelete(wishlist._id);
        } else {
            wishlist = new WishList({
                user: req.user._id,
                product: req.params.product
            });
            await wishlist.save();

            await wishlist.populate([{
                path: "user",
                select: "name email mobile_no"
            },
            {
                path: "product",
                select: "name sku price images"
            }]);
        }
        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Wishlist updated",
            data: {
                product: wishlist.product,
                user: wishlist.user
            }
        });
    } catch (error) {
        console.log("error", error)
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

const getWishList = async (req, res) => {
    try {
        const { page = 1, size = 10, sort = { _id: -1 } } = req.query;
        let wishlist = await WishList.find({
            user: req.user._id
        }).select("product user").populate([{
            path: "user",
            select: "name email mobile_no"
        },
        {
            path: "product",
            select: "name sku price images"
        }]).sort(sort).limit(size).skip((page - 1) * size).lean();

        return res.status(httpStatus.OK).json({
            success: true,
            msg: "My Wishlist",
            data: wishlist
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

module.exports = {
    addRemoveWishList,
    getWishList
};
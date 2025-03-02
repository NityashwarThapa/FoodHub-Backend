const httpStatus = require("http-status");
const Category = require("../models/Category");
const Joi = require("joi");
const Product = require("../models/Product");

const categoryValidationSchema = Joi.object({
    name: Joi.string().required()
});

const addCategory = async (req, res) => {
    try {
        let { name } = req.body;

        const existingCategory = await Category.findOne({
            name
        });

        if (existingCategory) {
            return res.status(httpStatus.CONFLICT).json({
                success: false,
                msg: "Category name already exists!!"
            });
        }


        const category = await Category.create({ name: req.body.name });


        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Category Added",
            data: category
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

const getCategories = async (req, res) => {
    try {
        const { page = 1, size = 10, sort = { _id: -1 } } = req.query;

        let searchQuery = {};
        if (req.query.search) {
            searchQuery = {
                ...searchQuery,
                name: { $regex: req.query.search, $options: 'i' }
            };
        }

        let categories = await Category.find(searchQuery).skip((page - 1) * size).limit(size).sort(sort);

        categories = await Promise.all(
            categories.map(async value => {
                value = value.toJSON();
                value.product_count = await Product.countDocuments({
                    category: value._id
                });
                return value;
            })
        );

        const totalCount = await Category.countDocuments({});

        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Categories!!",
            data: categories,
            page,
            size,
            totalCount
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

const getCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findById(id).select("name createdAt");
        if (!category) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                msg: "Category Not Found!!"
            });
        }
        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Category!!",
            data: category
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

const updateCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findById(id);
        if (!category) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                msg: "Category Not Found!!"
            });
        }

        await Category.findByIdAndUpdate(
            id,
            req.body,
            { new: true }
        );
        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Category Updated!!"
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: err.messages
        });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findByIdAndDelete(id);

        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Category Deleted!!"
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

module.exports = {
    addCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory
};
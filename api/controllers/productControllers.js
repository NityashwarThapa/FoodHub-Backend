const Joi = require("joi");
const Product = require("../models/Product");
const httpStatus = require("http-status");
const upload = require("../middlewares/uploads");
const Review = require("../models/Review");


const productValidationSchema = Joi.object({
    name: Joi.string().required(),
    category: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().min(10),
    calorie_count: Joi.number()
});

const skuGenerator = async (productName) => {
    const formattedName = productName.replace(/\s/g, '_');

    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const sku = formattedName.toLowerCase() + '_' + randomNum;

    const checkSKU = await Product.findOne({
        sku,
    });
    if (checkSKU) await skuGenerator(productName);

    return sku;
};

const addProduct = async (req, res) => {
    upload.array('images')(req, res, async err => {
        if (err) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                msg: err.message
            });
        }
        try {
            const { name, description, calorie_count, category, price } = req.body;

            //add path image
            const images = await Promise.all(req.files.map(value => value.path));

            const { error } = productValidationSchema.validate(req.body);

            if (error) {
                return res.status(httpStatus.CONFLICT).json({
                    success: false,
                    msg: error.message
                });
            }

            // Promise.all(req.files.map(value => {
            //     const variantIndex = variant.findIndex(ele => ele.sku === value.fieldname);
            //     const image = variant[variantIndex].images || []
            //     if (variantIndex >= 0) variant[variantIndex].images = [value.path];
            // }));

            const checkProduct = await Product.findOne({
                name,
            });

            if (checkProduct) {
                return res.status(httpStatus.CONFLICT).json({
                    success: false,
                    msg: "Product Already Exits!!"
                });
            }
            const sku = await skuGenerator(name);

            const product = await Product.create({
                name, sku, description, calorie_count, category, price, images
            });

            return res.status(httpStatus.OK).json({
                success: true,
                msg: "Product Added",
                data: product
            });
        } catch (error) {
            console.log("error", error);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                msg: error.message
            });
        }

    });
};

const getProducts = async (req, res) => {
    try {

        let { page = 1, size = 10, sort = { _id: -1 } } = req.query;
        let searchQuery = {
        };

        if (req.query.category) {
            searchQuery = {
                ...searchQuery,
                category: req.query.category
            };
        }

        if (req.query.date) {
            sort = {
                ...sort,
                '_id': parseInt(req.query.date)
            };
        }

        if (req.query.price) {
            console.log("price", req.query.price);
            sort = {
                // ...sort,
                'price': parseInt(req.query.price)
            };
        }

        if (req.query.search) {
            searchQuery = {
                ...searchQuery,
                name: { $regex: req.query.search, $options: 'i' }
            };
        }
        const products = await Product.find(searchQuery).select("name description calorie_count sku category price images").populate({ path: 'category' }).skip((page - 1) * size).limit(size).sort(sort);

        const totalCount = await Product.countDocuments({});

        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Products!!",
            data: products,
            totalCount,
            size: parseInt(size),
            page: parseInt(page)
        });
    } catch (error) {
        console.log("err", error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

const getProduct = async (req, res) => {
    try {
        const sku = req.params.sku;
        let product = await Product.findOne({
            sku: sku
        }).populate({ path: 'category' }).select("name description calorie_count category sku price images");

        if (!product) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                msg: "Product Not Found!!"
            });
        }
        const rating = await Review.aggregate([
            { $match: { product: product._id } },
            {
                $group: {
                    _id: null,
                    rating: { $avg: '$rating' }
                }
            },
        ]);

        product = product.toJSON();
        product.rating = rating.length ? rating[0].rating : 0;
        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Product!!",
            data: product,
        });
    } catch (error) {
        console.log("error", error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

const updateProduct = async (req, res) => {
    upload.any()(req, res, async err => {
        if (err) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                msg: err.messages
            });
        }

        try {
            const id = req.params.id;

            const product = await Product.findById(id);
            if (!product) {
                return res.status(httpStatus.NOT_FOUND).json({
                    success: false,
                    msg: "Product Not Found!!"
                });
            }

            if (req.body.name && req.body.name !== product.name) {
                req.body.sku = await skuGenerator(req.body.name);
            }

            let images = product.images;
            const toRemove = req.body.replace_images_paths;
            if (toRemove && toRemove.length > 0) {
                images = images.filter(ele => !toRemove.includes(ele));
            }
            req.body.images = images;
            if (req.files) {
                const newImages = await Promise.all(req.files.map(value => value.path));
                req.body.images = images.concat(newImages);
            }

            const updatedProduct = await Product.findByIdAndUpdate(
                id,
                req.body,
                { new: true }
            );
            return res.status(httpStatus.OK).json({
                success: true,
                msg: "Product Updated!!",
                data: updatedProduct
            });
        } catch (error) {
            console.log("error", error);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                msg: error.message
            });
        }
    });
};

const deleteProduct = async (req, res) => {
    try {
        const id = req.params.id;
        await Product.findByIdAndDelete(id);

        return res.status(httpStatus.OK).json({
            success: true,
            msg: "Product Deleted!!"
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message
        });
    }
};

module.exports = {
    addProduct,
    getProduct,
    getProducts,
    deleteProduct,
    updateProduct
};

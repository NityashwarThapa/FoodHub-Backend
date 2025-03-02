const mongoose = require('mongoose');
const Review = require('./Review');
const { Schema } = mongoose;

const productSchema = new Schema({
    name: {
        type: String,
        trim: true,
        required: true,
        minlength: 3,
    },
    sku: { type: String, required: true, unique: true },
    calorie_count: { type: Number },
    description: { type: String },
    images: [{ type: String }],
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    price: { type: Number }
},
    {
        timestamps: true
    });

const getRating = async (product) => {
    const rating = await Review.aggregate([
        { $match: { product: product } },
        {
            $group: {
                _id: null,
                rating: { $avg: '$rating' }
            }
        },
    ]);
    return rating.length ? rating[0].rating : 0;
};

productSchema.post('find', async function (result) {
    if (this._conditions._id === undefined) {
        for (let index in result) {
            if (result[index] instanceof mongoose.Document) {
                result[index] = result[index].toJSON();
            }
            result[index].rating = await getRating(result[index]._id);
            console.log("result", result[index].rating);
        }
    }
    return result;
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
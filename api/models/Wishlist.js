const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const wishListSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId, ref: "User"
    },
    product: {
        type: Schema.Types.ObjectId, ref: "Product"
    }
}, {
    timestamps: true
});

const WishList = mongoose.model('WishList', wishListSchema);

module.exports = WishList;

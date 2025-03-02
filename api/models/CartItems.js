const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    item: {
        type: Schema.Types.ObjectId, ref: "Product", required: true
    },
    price: {
        type: Number
    },
    quantity: {
        type: Number
    },
    total: {
        type: Number
    },
    status: {
        type: String, enum: [
            "CART", "ORDER", "PROCEED", "PACKAGED", "DISPATCHED", "DELIVERED", "CANCELLED", "REMOVED" 
        ],
        default: "CART"
    },
    cart: {
        type: Schema.Types.ObjectId, ref: "Cart"
    }
}, {
    timestamps: true
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;
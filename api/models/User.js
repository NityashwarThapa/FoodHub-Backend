const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: { type: String },
    email: {
        type: String,
        trim: true,
    },
    mobile_no: {type: String},
    password: { type: String },
    image: { type: String },
    role: {
        type: String,
        enum: ['user', 'admin', 'super-admin'],
        default: 'user',
    },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
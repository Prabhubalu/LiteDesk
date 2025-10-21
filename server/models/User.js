const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    vertical: { type: String, required: true } // To link user to a business vertical
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
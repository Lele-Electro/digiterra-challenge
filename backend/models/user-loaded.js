const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator')

const userSchema = mongoose.Schema({
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    businessClient: {type: Boolean, required: true},
    companyName: {type: String, required: false},
    contactPersonName: {type: String, required: true},
    contactPersonSurname:{type: String, required: true},
    contactNumber:{type: String, required: true},

});

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model('UserLoaded', userSchema);
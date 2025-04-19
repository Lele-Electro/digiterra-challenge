const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator')

const userSchema2 = mongoose.Schema({
    email: {type: String, required: true, unique: true},
    userType:  {type:String, required: true},
    name: {type: String, required: true},
    surname:{type: String, required: true},
    contactNumber:{type: String, required: true},

});


userSchema2.plugin(uniqueValidator);

module.exports = mongoose.model('matlaEmail', userSchema2);
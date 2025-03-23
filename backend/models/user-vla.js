const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator')

const userSchema2 = mongoose.Schema({
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    userType:  {type:String, required: true},
    name: {type: String, required: true},
    surname:{type: String, required: true},
    contactNumber:{type: String, required: true},
    bankName:{type: String, required: false},
    bankAccountNumber:{type: String, required: false},
    availability:{type: [Number], required: false},

    nextOfKinEmail: {type: String, required: false, unique: true},
    nextOfKinPassword: {type: String, required: false},
    nextOfKinUserType:  {type:String, required: false},
    nextOfKinName: {type: String, required: false},
    nextOfKinSurname:{type: String, required: false},
    nextOfKinContactNumber:{type: String, required: false},
    nextOfKinBankName:{type: String, required: false},
    nextOfKinBankAccountNumber:{type: String, required: false},


});


userSchema2.plugin(uniqueValidator);

module.exports = mongoose.model('UserVLA', userSchema2);
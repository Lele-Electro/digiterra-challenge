const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator')

const userSchema = mongoose.Schema({
  destinationFrom: {
    type: String,
    required: true,
    unique: true
  },
  destinationTo: {
    type: String,
    required: true
  },
  truckType: {
    type: Boolean,
    required: true
  },
  booking: {
    type: String,
    required: false
  },
  contactPersonName: {
    type: String,
    required: true
  },
  contactPersonSurname: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },

});

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model('UserLoaded', userSchema);

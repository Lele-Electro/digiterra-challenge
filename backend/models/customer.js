const mongoose = require("mongoose");

const customerSchema = mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  cellNumber: { type: String, required: true },
  lineOne: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  code: { type: String, required: true },
  postalLineOne: { type: String, required: true },
  postalCity: { type: String, required: true },
  postalCountry: { type: String, required: true },
  postalCode: { type: String, required: true },
  customerComment: { type: String, required: true },
});
// const customerSchema = mongoose.Schema({
//         customerDetails: {
//             firstName: { type: String, required: true},
//             lastName:  { type: String, required: true},
//             cellNumber:{ type: String, required: true}
//         },
//         customerAddress: {
//             physicalAddress: {
//                 lineOne: { type: String, required: true},
//                 city: { type: String, required: true},
//                 country: { type: String, required: true},
//                 code: { type: String, required: true},
//             },
//             postalAddress: {
//                 lineOne: { type: String, required: true},
//                 city: { type: String, required: true},
//                 country: { type: String, required: true},
//                 code: { type: String, required: true},
//             },
//         },
//         customerComment: { type: String, required: true}
// });

module.exports = mongoose.model("Customer", customerSchema);

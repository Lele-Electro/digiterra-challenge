const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const cvSchema = mongoose.Schema(
  {
    personalDetails:
    {
      title: { type: String, required: false, unique: false },
      firstname: { type: String, required: false, unique: false },
      secondname: { type: String, required: false, unique: false },
      thirdname: { type: String, required: false, unique: false },
      surname: { type: String, required: false, unique: false },
      identityNumber: { type: String, required: false, unique: false },
      gender: { type: String, required: false, unique: false },
      nationality: { type: String, required: false, unique: false },
      firstLanguage: { type: String, required: false, unique: false },
      secondLanguage: { type: String, required: false, unique: false },
      thirdLanguage: { type: String, required: false, unique: false },
      fourthLanguage: { type: String, required: false, unique: false },
      health: { type: String, required: false, unique: false },
      criminalRecord: { type: String, required: false, unique: false },
      driversLicense: { type: String, required: false, unique: false },
    },
    contactDetails:
    {
      contactNumberOne: { type: String, required: false, unique: false },
      contactNumberTwo: { type: String, required: false, unique: false },
      physicalAddress: { type: String, required: false, unique: false },
      email: { type: String, required: true, unique: true },
    },
    secondaryEducation:
    {
      school: { type: String, required: false, unique: false },
      qualification: { type: String, required: false, unique: false },
      subjectOne: { type: String, required: false, unique: false },
      subjectTwo: { type: String, required: false, unique: false },
      subjectThree: { type: String, required: false, unique: false },
      subjectFour: { type: String, required: false, unique: false },
      subjectFive: { type: String, required: false, unique: false },
      subjectSix: { type: String, required: false, unique: false },
      subjectSeven: { type: String, required: false, unique: false },
      subjectEight: { type: String, required: false, unique: false },
      yearObtained: { type: String, required: false, unique: false },
    },
    tertiaryEducation: [
    {
      school: { type: String, required: false, unique: false },
      qualification: { type: String, required: false, unique: false },
      moduleOne: { type: String, required: false, unique: false },
      moduleTwo: { type: String, required: false, unique: false },
      moduleThree: { type: String, required: false, unique: false },
      moduleFour: { type: String, required: false, unique: false },
      moduleFive: { type: String, required: false, unique: false },
      moduleSix: { type: String, required: false, unique: false },
      moduleSeven: { type: String, required: false, unique: false },
      moduleEight: { type: String, required: false, unique: false },
      yearObtained: { type: String, required: false, unique: false },
    },
    {
      school: { type: String, required: false, unique: false },
      qualification: { type: String, required: false, unique: false },
      moduleOne: { type: String, required: false, unique: false },
      moduleTwo: { type: String, required: false, unique: false },
      moduleThree: { type: String, required: false, unique: false },
      moduleFour: { type: String, required: false, unique: false },
      moduleFive: { type: String, required: false, unique: false },
      moduleSix: { type: String, required: false, unique: false },
      moduleSeven: { type: String, required: false, unique: false },
      moduleEight: { type: String, required: false, unique: false },
      yearObtained: { type: String, required: false, unique: false },
    },
    {
      school: { type: String, required: false, unique: false },
      qualification: { type: String, required: false, unique: false },
      moduleOne: { type: String, required: false, unique: false },
      moduleTwo: { type: String, required: false, unique: false },
      moduleThree: { type: String, required: false, unique: false },
      moduleFour: { type: String, required: false, unique: false },
      moduleFive: { type: String, required: false, unique: false },
      moduleSix: { type: String, required: false, unique: false },
      moduleSeven: { type: String, required: false, unique: false },
      moduleEight: { type: String, required: false, unique: false },
      yearObtained: { type: String, required: false, unique: false },
    }
  ],
  workExperience: [
    {
      company: { type: String, required: false, unique: false },
      position: { type: String, required: false, unique: false },
      responsibilities: { type: String, required: false, unique: false },
      startDate: { type: String, required: false, unique: false },
      endDate: { type: String, required: false, unique: false },
      referenceName: { type: String, required: false, unique: false },
      relationship: { type: String, required: false, unique: false },
      contactNumber: { type: String, required: false, unique: false },
    },
    {
      company: { type: String, required: false, unique: false },
      position: { type: String, required: false, unique: false },
      responsibilities: { type: String, required: false, unique: false },
      startDate: { type: String, required: false, unique: false },
      endDate: { type: String, required: false, unique: false },
      referenceName: { type: String, required: false, unique: false },
      relationship: { type: String, required: false, unique: false },
      contactNumber: { type: String, required: false, unique: false },
    },
    {
      company: { type: String, required: false, unique: false },
      position: { type: String, required: false, unique: false },
      responsibilities: { type: String, required: false, unique: false },
      startDate: { type: String, required: false, unique: false },
      endDate: { type: String, required: false, unique: false },
      referenceName: { type: String, required: false, unique: false },
      relationship: { type: String, required: false, unique: false },
      contactNumber: { type: String, required: false, unique: false },
    }
  ]
  });

cvSchema.plugin(uniqueValidator);
module.exports = mongoose.model("CV", cvSchema);

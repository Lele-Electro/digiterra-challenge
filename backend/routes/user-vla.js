const express = require("express");
const mongoose3 = require("mongoose");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const userVla = require("../models/user-vla");

router.post("/signup", (req, res, next) => {
  console.log('sign up request received');
  console.log(req.body)
  bcrypt.hash(req.body.password, 10).then((hash) => {
    const user = new userVla({
      email: req.body.email,
      password: hash,
      userType: req.body.userType,   
      name: req.body.name,
      surname: req.body.surname,
      contactNumber: req.body.contactNumber,
      bankName:req.body.bankName,
      bankAccountNumber:req.body.bankAccountNumber,
      availability:req.body.availability,
      nextOfKinEmail: req.body.nextOfKinEmail,
      nextOfKinPassword:req.body.nextOfKinPassword ,
      nextOfKinUserType:req.body.nextOfKinUserType  ,
      nextOfKinName:req.body.nextOfKinName ,
      nextOfKinSurname:req.body.nextOfKinSurname,
      nextOfKinContactNumber:req.body.nextOfKinContactNumber,
      nextOfKinBankName:req.body.nextOfKinBankName,
      nextOfKinBankAccountNumber:req.body.nextOfKinBankAccountNumber

      
    });
    user
      .save()
      .then((result) => {
        res.status(201).json({
          message: "User Created",
          result: result,
        });
      })
      .catch((err) => {
        res.status(500).json({
          error: err,
        });
      });
  });
});

router.post("/signin", (req, res, next) => {
    let fetchedUser;
    userVla.findOne({ email: req.body.email })
    .then((user) => {
      // Check to see if there is a user with the requested email postalAddress
      if (!user) {
        return res
          .status(401)
          .json({ message: "Email Address Not Found in Database" });

      } else {

      //Check to see if the password is correct
        fetchedUser = user;
        return bcrypt.compare(req.body.password, fetchedUser.password);
      }
    })
    .then((result) => {

      if(fetchedUser) {
        if (!result) {
          return res.status(401).json({
            message: "Password incorrect",
          });
        } else{
          //Create JSON TOKEN
          const token = jwt.sign({email: fetchedUser.email, businessClient: fetchedUser.businessClient, userId: fetchedUser._id }, 'secret_to_enable_uncrackable_code_random_sentence_this_is', {expiresIn: '1h'} );


          //RESPOND WITH TOKEN
          res.status(200).json({
              token: token,
              expiresIn: 3600,
              userInformationOnSignIn :{
                name: fetchedUser.name,
                surname: fetchedUser.surname,
                userType: fetchedUser.userType,
                email: fetchedUser.email,
                contactNumber: fetchedUser.contactNumber ?? null,
                userId: fetchedUser._id,
                bankName: fetchedUser.bankName ?? null,
                bankAccountNumber: fetchedUser.bankAccountNumber ?? null,
                availability: fetchedUser.availability ?? null,
                nextOfKinName: fetchedUser.nextOfKinName ?? null,
                nextOfKinSurname: fetchedUser.nextOfKinSurname ?? null,
                nextOfKinEmail: fetchedUser.nextOfKinEmail ?? null,
                nextOfKinContactNumber: fetchedUser.nextOfKinContactNumber ?? null,
                nextOfKinUserType: fetchedUser.nextOfKinUserType ?? null,
                nextOfKinBankName: fetchedUser.nextOfKinBankName ?? null,
                nextOfKinBankAccountNumber: fetchedUser.nextOfKinBankAccountNumber ?? null,
            
              }


          })
          
          console.log('user ID');
          console.log(fetchedUser._id)

      };

      }

    })
    // .catch((result) => {
    //   return res.status(401).json({
    //     message: "Authentication failed for reasons unknown",
    //   });
    // });
});

router.put('/updateuser/:id', async (req, res) => {
  console.log('user body')
  console.log(req.body)
  const {id} = req.params;
try{
const user = await userVla.findByIdAndUpdate(id,req.body);

  if(!user){
    console.log('User not found')
    return res.status(404).json({message:'User Not Found'})
  } else{
    console.log('attempting to find using this ID', id)
    const updatedUser = await userVla.findById(id)
    res.status(200).json(updatedUser)
  }
}catch(error){
  res.status(500).json({message:error.message})
}
})

module.exports = router;

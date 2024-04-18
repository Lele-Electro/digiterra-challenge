const express = require("express");
const mongoose3 = require("mongoose");
const router = express.Router();
const bcrypt = require("bcrypt");
const UserLoaded = require("./models/user-loaded");
const jwt = require('jsonwebtoken')

router.post("/signup", (req, res, next) => {
  bcrypt.hash(req.body.password, 10).then((hash) => {
    const user = new UserLoaded({
      email: req.body.email,
      password: hash,
      businessClient: req.body.businessClient,
      companyName: req.body.companyName ?? null,
      contactPersonName: req.body.contactPersonName,
      contactPersonSurname: req.body.contactPersonSurname,
      contactNumber: req.body.contactNumber,
      
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
    UserLoaded.findOne({ email: req.body.email })
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
                contactPersonName: fetchedUser.contactPersonName,
                contactPersonSurname: fetchedUser.contactSurname,
                businessClient: fetchedUser.businessClient,
                email: fetchedUser.email,
                companyName: fetchedUser.companyName ?? null,

              }


          })
      };

      }

    })
    // .catch((result) => {
    //   return res.status(401).json({
    //     message: "Authentication failed for reasons unknown",
    //   });
    // });
});

module.exports = router;

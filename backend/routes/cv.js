const express = require('express');
const router = express.Router();
const CV = require('../models/cv');

router.post('/cvs', (req, res, next) => {

    console.log(req.body)

    CV.findOne({contactDetals:{email:req.body.contactDetails.email}})
    .then((user) => {
        if(!user){
            const cvProp = new CV(
            {
            personalDetails: req.body.personalDetails,
            contactDetails: req.body.contactDetails,
            secondaryEducation: req.body.secondaryEducation,
            tertiaryEducation: req.body.tertiaryEducation,
            workExperience: req.body.workExperience,
            }
        )
            cvProp.save()
            .then( response => {
                res.status(201).json({
                    message: 'CV Created Successfully'
                })
            })
            .catch((err) => {
                console.log('ERROR LOG');
                console.log(err)
                res.status(500).json({
                  error: err,
                });
              });
        }
    })


})

module.exports = router;
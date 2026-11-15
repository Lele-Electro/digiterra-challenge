
const express = require("express");
const mongoose3 = require("mongoose");
const router = express.Router();
const maltaEmail = require("../models/matla-emails");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const path = require('path');



// POST EMAIL AND OTHER INFO TO DATABASE
router.post("/emails", async (req, res, next) => {
  console.log('Interest in Matla Life Received');
  console.log(req.body)


    try {
        const email = new maltaEmail({
            email: req.body.email,
            userType: req.body.userType,   
            name: req.body.name,
            surname: req.body.surname,
            contactNumber: req.body.contactNumber,
          });
    
        // const newUser = new User({ name, email, password });
        await email.save();
    
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        const viewsPath = path.join(__dirname, '..', 'views');
        transporter.use('compile', hbs({
          viewEngine: {
            extName: '.handlebars',
            layoutsDir: viewsPath,
            defaultLayout: false,
          },
          viewPath: viewsPath,
          extName: '.handlebars',
        }));

        await transporter.sendMail({
          from: `"Virtual Learn Academy" <${process.env.SMTP_USER}>`,
          to: process.env.MATLA_EMAIL_RECIPIENT || process.env.SMTP_USER,
          subject: 'Welcome to Virtual Learn Academy',
          template: 'welcomeMessage',
        });

        res.status(201).json({ message: 'Email Submitted Successfully' });
      } catch (error) {
        res.status(400).json({ message: 'Error creating user', error: error.message });
      }
});


module.exports = router;
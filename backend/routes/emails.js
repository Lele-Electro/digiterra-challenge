
const express = require("express");
const mongoose3 = require("mongoose");
const router = express.Router();
const maltaEmail = require("../models/matla-emails");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");



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
    
        res.status(201).json({ message: 'Email Submitted Successfully' });
        

// CONFIGURE THE MAIL TRANSPOTER
const transporter = nodemailer.createTransport({
  host: "mail.techbusiness.co.za",
  port: 465, 
  secure: true, // true for port 465, false for other ports
  auth: {
    user: "matla@techbusiness.co.za",
    pass: "matla@techbusiness.co.za",
  },
});

// CONFIGURE HANDLEBARS THEN USE IT
const hbsOptions = {
  viewEngine: {
    extName: ".handlebars",
    layoutsDir: "./backend/views",
    defaultLayout: false,
  },
  viewPath: "./backend/views",
  extName: ".handlebars",
};
transporter.use('compile', hbs(hbsOptions));

// SEND THE MAIL WITH THE TEMPLATE
async function main() {
  const info = await transporter.sendMail({
    from: '"Matla Life" matla@techbusiness.co.za',  // sender address
    to: "toni101ribeiro@gmail.com, antonio@devsense.co.za", // list of receivers
    subject: `${req.body.name} `, // Subject line
    // text: "Hello world?", // plain text body
   template: 'welcomeMessage', // html body
  });

  console.log("Message sent: %s", info.messageId);
  // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
}

main().catch(console.error);



      } catch (error) {
        res.status(400).json({ message: 'Error creating user', error: error.message });
      }



});


module.exports = router;
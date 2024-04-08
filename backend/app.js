const express =  require ('express');
const bodyParser = require('body-parser');
const Customer = require('./models/customer')
const app = express();
const mongoose2 =  require('mongoose');


app.use(bodyParser.json());
// mongodb+srv://Admin:<password>@cluster0.gqxeqtf.mongodb.net/?retryWrites=true&w=majority

// mongoose2.connect('mongodb+srv://Admin:KElJ3lISFvKq2mHL@cluster0.gqxeqtf.mongodb.net/?retryWrites=true&w=majority')
mongoose2.connect('mongodb+srv://Admin:KElJ3lISFvKq2mHL@cluster0.gqxeqtf.mongodb.net/digiterraDB?retryWrites=true&w=majority')
// mongooose.connect('mongodb+srv://Admin:KElJ3lISFvKq2mHL@cluster0@cluster0.gqxeqtf.mongodb.net/?retryWrites=true&w=majority')
.then(() => {
    console.log("connected to the database");
})
.catch(( error)=> {
    console.log("connection to database failed.");
    console.log(error?.MongooseServerSelectionError)
})

app.use((req,res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Methods', '*')
    next();
})

app.get('/test', (req, res)=>{
    res.send('Hello World')
})

app.get('/api/customers', (req, res, next) => {
    Customer.find().then( documents => {

res.json({
    message: 'Customers fetched successfully - Test 08 April 2024',
    customers:documents
    })

})


});

//POST CUSTOMERS
app.post( '/api/customers', (req, res, next) => {
    const customer = new Customer({
        firstName: req.body.customerDetails.firstName,
        lastName: req.body.customerDetails.lastName,
        cellNumber: req.body.customerDetails.cellNumber,
        lineOne: req.body.customerAddress.physicalAddress.lineOne,
        city: req.body.customerAddress.physicalAddress.city,
        country: req.body.customerAddress.physicalAddress.country,
        code: req.body.customerAddress.physicalAddress.code,
        postalLineOne: req.body.customerAddress.postalAddress.lineOne,
        postalCity: req.body.customerAddress.postalAddress.city,
        postalCountry: req.body.customerAddress.postalAddress.country,
        postalCode: req.body.customerAddress.postalAddress.code,
        customerComment: req.body.customerComment.comment
    })

    customer.save();
    res.status(201).json({
        message: 'Customer added successfully'
    })
})

module.exports = app;

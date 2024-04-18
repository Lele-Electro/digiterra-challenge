const express =  require ('express');
const bodyParser = require('body-parser');
const Customer = require('./models/customer')
const app = express();
const mongoose2 =  require('mongoose');
const userRoutes = require('./user');
const userRoutesLoaded = require('./user-loaded');
const customerRoutes = require('./customers');
const cors = require('cors');

app.use(cors());
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
    // res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, PUT, OPTIONS')
    next();
})

// app.get('/test', (req, res)=>{
//     res.send('Hello World')
// })

// GET CUSTOMERS
app.get('/api/customers', (req, res, next) => {
    Customer.find().then( documents => {

res.json({
    message: 'Customers fetched successfully - Test 08 April 2024',
    customers:documents
    })

})

});


// USER ROUTES
app.use('/api/user', userRoutes);

// USER ROUTES Loaded
app.use('/api/user/loaded', userRoutesLoaded);

// CUSTOMER ROUTES
app.use('/api/customers', customerRoutes);

module.exports = app;

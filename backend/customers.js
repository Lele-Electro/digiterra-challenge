const express =  require ('express');
const router = express.Router();

//POST CUSTOMERS
router.post( '/api/customers', (req, res, next) => {
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

module.exports = router;
const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {

    try {
        const token = req.headers.authorization.split('')[1];
        jwt.verify(token, 'secret_to_enable_uncrackable_code_random_sentence_this_is');
    } catch (error){
        res.status(401).json({
            message: 'Authorization failed (Middleware report)',
            error: error
        })
    }
}
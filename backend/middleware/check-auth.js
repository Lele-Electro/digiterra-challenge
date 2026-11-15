const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {

    try {
        const authorization = req.headers.authorization;
        const token = authorization && authorization.split(' ')[1];

        if (!token) {
            throw new Error('Authorization token is missing');
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userData = { email: decodedToken.email, userId: decodedToken.userId, authVersion: decodedToken.authVersion ?? 0 };
        next();
    } catch (error){
        res.status(401).json({
            message: 'Authorization failed (Middleware report)',
            error: error.message
        })
    }
}

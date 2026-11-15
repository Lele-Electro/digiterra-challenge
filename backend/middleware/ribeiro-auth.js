const verifyToken = require('./check-auth');
const User = require('../models/user-ribeiro');

// Keep legacy applications' auth separate; Ribeiro sessions are revocable on reset.
module.exports = (req, res, next) => verifyToken(req, res, async () => {
  try {
    const user = await User.findById(req.userData.userId).select('authVersion').lean();
    if (!user || (user.authVersion ?? 0) !== req.userData.authVersion) {
      return res.status(401).json({ message: 'Please sign in again.' });
    }
    next();
  } catch (error) {
    if (error.name === 'CastError') return res.status(401).json({ message: 'Please sign in again.' });
    next(error);
  }
});

module.exports = {
  app: require('./app.cjs'),
  ...require('../backend/services/lift-confirmations'),
  ...require('../backend/services/ribeiro-mail'),
  ...require('../backend/services/lift-next-alarm'),
  ...require('../backend/services/password-recovery'),
  ...require('../backend/services/registration-mail'),
};

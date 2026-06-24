const { forbidden } = require('../utils/response');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return forbidden(res, `Akses hanya untuk: ${roles.join(', ')}.`);
    }
    next();
  };
}

module.exports = { requireRole };

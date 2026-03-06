const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  const payload = { id: user._id, role: user.role };
  const secret = process.env.JWT_SECRET || 'change_this_secret';
  // JWT token expires in exactly 1 hour as per project requirement
  const expiresIn = '1h';

  return jwt.sign(payload, secret, { expiresIn });
};

module.exports = generateToken;

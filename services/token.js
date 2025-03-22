const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

const generateVerificationToken = (email) => {
    return jwt.sign({ email }, JWT_SECRET, { expiresIn: '10m' });
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

module.exports = { generateVerificationToken, verifyToken };
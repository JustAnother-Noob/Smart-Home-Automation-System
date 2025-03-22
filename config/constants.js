require('dotenv').config();

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5500',
    API_URL: process.env.API_URL || 'http://localhost:5001',
};
require('dotenv').config();

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    EMAIL_USER: process.env.EMAIL_USERNAME,
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
    OAUTH_REFRESH_TOKEN: process.env.OAUTH_REFRESH_TOKEN,
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5500',
    API_URL: process.env.API_URL || 'http://localhost:5001',
};
// services/emailService.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { 
    EMAIL_USER,
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_REFRESH_TOKEN,
    CLIENT_URL,  // Make sure this is in your constants
    API_URL
} = require('../config/constants');

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    try {
        const oauth2Client = new OAuth2(
            OAUTH_CLIENT_ID,
            OAUTH_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground"
        );

        oauth2Client.setCredentials({
            refresh_token: OAUTH_REFRESH_TOKEN
        });

        const accessToken = await new Promise((resolve, reject) => {
            oauth2Client.getAccessToken((err, token) => {
                if (err) {
                    console.error('Access token error:', err);
                    reject(new Error("Failed to generate access token"));
                }
                resolve(token);
            });
        });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: EMAIL_USER,
                accessToken,
                clientId: OAUTH_CLIENT_ID,
                clientSecret: OAUTH_CLIENT_SECRET,
                refreshToken: OAUTH_REFRESH_TOKEN
            }
        });

        // Verify connection on creation
        await transporter.verify();
        console.log('SMTP connection verified');
        return transporter;

    } catch (error) {
        console.error('Transporter creation failed:', error);
        throw error;
    }
};
// services/emailService.js
const sendOTPEmail = async (email, otp) => {
    try {
        const transporter = await createTransporter();
        
        await transporter.sendMail({
            from: `"Smart Living Tech" <${EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email - OTP Code',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #4CAF50;">Email Verification</h2>
                    <p style="font-size: 1.2rem;">Hello,</p>
                    <p style="font-size: 1.2rem;">To complete your registration, please use the One-Time Password (OTP) below:</p>
                    <h1 style="font-size: 2.5rem; letter-spacing: 0.2rem; color: #007BFF;">
                        ${otp}
                    </h1>
                    <p style="font-size: 1.2rem;">Please note that this code will expire in <strong>10 minutes</strong>.</p>
                    <p style="font-size: 1.2rem;">If you did not request this code, please ignore this email.</p>
                    <p style="font-size: 1.2rem;">Thank you for choosing Smart Living Tech!</p>
                </div>
            `
        });
        
    } catch (error) {
        console.error('Email error:', error);
        throw new Error('Failed to send OTP');
    }
};

module.exports = { sendOTPEmail};
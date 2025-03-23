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

const sendOTPEmail = async (email, otp, type = 'verification') => {
    try {
        const transporter = await createTransporter();
        
        const { subject, html } = getEmailContent(type, otp);
        
        await transporter.sendMail({
            from: `"Smart Living Tech" <${EMAIL_USER}>`,
            to: email,
            subject: subject,
            html: html
        });
        
    } catch (error) {
        console.error('Email error:', error);
        throw new Error('Failed to send OTP');
    }
};

const getEmailContent = (type, otp) => {
    const baseStyles = `
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.6;
    `;
    
    const commonTemplate = `
        <div style="${baseStyles}">
            <h2 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; 
                padding-bottom: 0.5rem; margin-bottom: 1.5rem;">
                Smart Living Tech ${type === 'verification' ? 'Email Verification' : 'Password Reset'}
            </h2>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">
                Hello,
            </p>
            <p style="font-size: 1.1rem; margin-bottom: 1.5rem;">
                ${type === 'verification' 
                    ? 'To complete your registration, please use the One-Time Password (OTP) below:' 
                    : 'To reset your password, please use the following One-Time Password (OTP):'}
            </p>
            <div style="text-align: center; margin: 2rem 0;">
                <h1 style="
                    font-size: 2.5rem;
                    letter-spacing: 0.5rem;
                    color: #007BFF;
                    background: #f8f9fa;
                    padding: 1rem;
                    border-radius: 8px;
                    display: inline-block;
                    margin: 0;">
                    ${otp}
                </h1>
            </div>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">
                This code will expire in <strong>10 minutes</strong>.
            </p>
            <p style="font-size: 1.1rem; margin-bottom: 1.5rem;">
                ${type === 'verification' 
                    ? 'If you did not request this code, please ignore this email.' 
                    : 'If you did not request a password reset, please contact our support team immediately.'}
            </p>
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee;">
                <p style="font-size: 0.9rem; color: #666;">
                    Thank you for choosing Smart Living Tech!<br>
                    <span style="font-size: 0.8rem;">
                        This is an automated message - please do not reply directly to this email.
                    </span>
                </p>
            </div>
        </div>
    `;

    return {
        subject: `Smart Living Tech - ${type === 'verification' ? 'Email Verification Code' : 'Password Reset Code'}`,
        html: commonTemplate
    };
};
module.exports = { sendOTPEmail};
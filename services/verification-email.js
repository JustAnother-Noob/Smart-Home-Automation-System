// services/emailService.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { 
    EMAIL_USER,
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_REFRESH_TOKEN,
    CLIENT_URL  // Make sure this is in your constants
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

const sendVerificationEmail = async (email, token) => {
    let transporter;
    try {
        transporter = await createTransporter();
        const verificationLink = `${CLIENT_URL}/api/auth/verify-email?token=${token}`;
        
        const mailOptions = {
            from: `"Smart Living Tech" <${EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email Address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Email Verification Required</h2>
                    <p>Please click the button below to verify your email address:</p>
                    <a href="${verificationLink}" 
                       style="display: inline-block; padding: 12px 24px; 
                              background-color: #2563eb; color: white; 
                              text-decoration: none; border-radius: 4px;
                              margin: 20px 0;">
                        Verify Email
                    </a>
                    <p style="color: #6b7280; font-size: 0.875rem;">
                        This link will expire in 10 minutes.<br>
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
            `,
            text: `Verify your email: ${verificationLink}\nThis link expires in 10 minutes.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent to:', email, 'Message ID:', info.messageId);
        return true;

    } catch (error) {
        console.error('Email sending error details:');
        console.error('Error code:', error.code);
        console.error('Command:', error.command);
        
        if (error.response) {
            console.error('SMTP response:', error.response);
        }
        
        throw new Error(`Failed to send verification email: ${error.message}`);
    }
};

module.exports = { sendVerificationEmail };
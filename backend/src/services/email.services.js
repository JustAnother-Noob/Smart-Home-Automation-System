const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { EMAIL_CONFIG } = require('../config/constants');

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    const oauth2Client = new OAuth2(
      EMAIL_CONFIG.clientId,
      EMAIL_CONFIG.clientSecret,
      "https://developers.google.com/oauthplayground"
    );
  
    oauth2Client.setCredentials({
      refresh_token: EMAIL_CONFIG.refreshToken
    });
  
    const accessToken = await new Promise((resolve, reject) => {
      oauth2Client.getAccessToken((err, token) => {
        if (err) reject("Error getting access token");
        resolve(token);
      });
    });
  
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: EMAIL_CONFIG.user, // Use config for email too
        accessToken,
        clientId: EMAIL_CONFIG.clientId,     // Fixed: Use config
        clientSecret: EMAIL_CONFIG.clientSecret, // Fixed: Use config
        refreshToken: EMAIL_CONFIG.refreshToken
      }
    });
  };
const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = await createTransporter(); // Now we properly await and get the transporter
    
    await transporter.sendMail({
      from: `"Smart Living" <${EMAIL_CONFIG.user}>`,
      to: email,
      subject: 'Your Verification Code',
      html: `<p>Your OTP code is: <strong>${otp}</strong></p>`
    });

  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send OTP email');
  }
};

module.exports = { sendOTPEmail };

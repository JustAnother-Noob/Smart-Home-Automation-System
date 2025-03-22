const nodemailer = require('nodemailer');
const { EMAIL_USER, EMAIL_PASS, CLIENT_URL } = require('../config/constants');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

const sendVerificationEmail = async (email, token) => {
    const verificationLink = `${CLIENT_URL}/api/auth/verify-email?token=${token}`;
    
    const mailOptions = {
        from: `"Smart Living Tech" <${EMAIL_USER}>`,
        to: email,
        subject: 'Email Verification',
        html: `
            <h2>Please verify your email</h2>
            <p>Click this link to complete your registration:</p>
            <a href="${verificationLink}">${verificationLink}</a>
            <p>This link will expire in 10 minutes.</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token: process.env.OAUTH_REFRESH_TOKEN
});

async function testEmail() {
  try {
    // 1. Get access token
    const { token } = await oauth2Client.getAccessToken();
    console.log('Access token:', token);

    // 2. Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USERNAME,
        accessToken: token,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        refreshToken: process.env.OAUTH_REFRESH_TOKEN
      }
    });

    // 3. Define email options
    const mailOptions = {
      from: `Test <${process.env.EMAIL_USERNAME}>`,
      to: process.env.EMAIL_USERNAME, // Send to yourself
      subject: 'OAuth2 Test Email',
      text: 'This is a test email using OAuth2'
    };

    // 4. Verify connection first
    await transporter.verify();
    console.log('SMTP connection verified');

    // 5. Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent:', info.messageId);

  } catch (error) {
    console.error('Test Failed:');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
  }
}

testEmail();
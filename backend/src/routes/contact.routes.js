const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const { EMAIL_CONFIG } = require('../config/constants');
const { sendContactFormEmail } = require('../services/email.services');

if (EMAIL_CONFIG.sendGridApiKey) {
  sgMail.setApiKey(EMAIL_CONFIG.sendGridApiKey);
}

const newsletterSubscribers = new Set();

router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, subject, message } = req.body;

    if (!firstName || !lastName || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (phone && phone.trim()) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit phone number'
        });
      }
    }

    const result = await sendContactFormEmail({
      firstName,
      lastName,
      email,
      phone,
      subject,
      message
    });

    if (!result.success) {
      
      if (result.message === 'Email service not configured') {
        return res.status(200).json({
          success: true,
          message: 'Your message has been received. We will contact you soon.'
        });
      }
      
      throw new Error(result.message || 'Failed to send email');
    }

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you within 24 hours.'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again or email us directly at smartlivingtech0@gmail.com'
    });
  }
});

router.post('/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (newsletterSubscribers.has(email.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'This email is already subscribed to our newsletter'
      });
    }

    newsletterSubscribers.add(email.toLowerCase());

    if (!EMAIL_CONFIG.sendGridApiKey) {
      console.log('⚠️  SendGrid not configured - logging newsletter subscription');
      console.log('Newsletter Subscription:', email);
      
      return res.status(200).json({
        success: true,
        message: 'Thank you for subscribing to our newsletter!'
      });
    }

    const welcomeEmail = {
      to: email,
      from: {
        email: EMAIL_CONFIG.user,
        name: 'Smart Living Tech'
      },
      subject: 'Welcome to Smart Living Tech Newsletter! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #667eea; margin-bottom: 10px;">Welcome to Our Newsletter! 🎉</h1>
              <p style="color: #718096; font-size: 16px;">Thank you for joining the Smart Living Tech family</p>
            </div>
            
            <p style="line-height: 1.6; color: #4a5568;">
              We're excited to have you on board! As a subscriber, you'll be the first to know about:
            </p>
            
            <ul style="line-height: 1.8; color: #4a5568;">
              <li>🎁 Exclusive deals and special offers</li>
              <li>🆕 New product launches and updates</li>
              <li>💡 Smart home tips and tricks</li>
              <li>📚 Installation guides and tutorials</li>
              <li>🏆 Member-only discounts</li>
            </ul>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
              <h3 style="color: white; margin-top: 0;">Special Welcome Offer</h3>
              <p style="color: white; margin-bottom: 20px;">Get 10% off your first order!</p>
              <div style="background-color: white; padding: 15px; border-radius: 8px; display: inline-block;">
                <p style="color: #667eea; font-weight: bold; font-size: 24px; margin: 0;">WELCOME10</p>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://smartlivingtech.me/user_products.html" 
                 style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Start Shopping
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px; text-align: center;">
              <p>You're receiving this email because you subscribed to our newsletter.</p>
              <p>If you no longer wish to receive these emails, you can unsubscribe at any time.</p>
              <p style="margin-top: 15px;">© 2025 Smart Living Tech. All rights reserved.</p>
            </div>
          </div>
        </div>
      `
    };

    await sgMail.send(welcomeEmail);

    console.log(`Newsletter subscription from ${email} successful`);

    res.status(200).json({
      success: true,
      message: 'Thank you for subscribing! Check your email for a special welcome offer.'
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe. Please try again later.'
    });
  }
});

router.get('/newsletter/subscribers', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      count: newsletterSubscribers.size,
      subscribers: Array.from(newsletterSubscribers)
    });
  } catch (error) {
    console.error('Error fetching newsletter subscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscribers'
    });
  }
});

module.exports = router;

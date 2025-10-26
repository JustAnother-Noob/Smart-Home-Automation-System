const sgMail = require('@sendgrid/mail');
const { EMAIL_CONFIG } = require('../config/constants');
const Coupon = require('../models/coupon.model'); 

const initializeSendGrid = () => {
  if (!EMAIL_CONFIG.sendGridApiKey) {
    console.log('⚠️  SendGrid API key not configured - email features will be disabled');
    console.log('📧 To enable emails, set EMAIL_API environment variable with your SendGrid API key');
    return false;
  }
  try {
    sgMail.setApiKey(EMAIL_CONFIG.sendGridApiKey);
    console.log('✅ SendGrid initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize SendGrid:', error.message);
    return false;
  }
};

const isSendGridInitialized = initializeSendGrid();

const isEmailServiceAvailable = () => {
  return isSendGridInitialized && EMAIL_CONFIG.sendGridApiKey;
};

const ensureEmailSubject = (msg, defaultSubject = 'Smart Living Tech Notification') => {
  if (!msg.subject || msg.subject.trim() === '') {
    console.warn('⚠️  Email subject is empty, using default subject:', defaultSubject);
    msg.subject = defaultSubject;
  }
  return msg;
};

const getWelcomeCoupon = async () => {
  try {
    const coupon = await Coupon.findById('68969c5f1b5472bbad363840');
    
    if (!coupon) {
      console.log('Welcome coupon not found in database, using fallback');
      return {
        code: 'WELCOME25',
        discountValue: '25'
      };
    }
    
    console.log(`Found coupon: ${coupon.code}, isActive: ${coupon.isActive}`);
    console.log(`Using database coupon: ${coupon.code} with value ${coupon.discountValue}`);
    
    return {
      code: coupon.code,
      discountValue: coupon.discountValue.toString()
    };
    
  } catch (error) {
    console.error('Error fetching welcome coupon:', error);
    
    return {
      code: 'WELCOME25',
      discountValue: '25'
    };
  }
};

const sendOTPEmail = async (email, otp, type = 'signup') => {
  try {
    
    if (!isEmailServiceAvailable()) {
      console.log(`⚠️  SendGrid not configured - skipping OTP email to ${email}`);
      return { success: false, message: 'Email service not configured' };
    }
    
    const templateId = type === 'password-reset' 
      ? EMAIL_CONFIG.templates.passwordReset 
      : EMAIL_CONFIG.templates.accountVerification;

    const subject = type === 'password-reset'
      ? 'Reset Your Password - OTP Code'
      : 'Verify Your Account - OTP Code';
    
    const msg = {
      to: email,
      from: {
        email: EMAIL_CONFIG.user,
        name: 'Smart Living Tech'
      },
      subject: subject,
      templateId: templateId,
      dynamicTemplateData: {
        otp: otp,
        expiryMinutes: '5' 
      }
    };

    ensureEmailSubject(msg, subject);

    console.log('📧 OTP Email message being sent:', JSON.stringify({
      to: msg.to,
      from: msg.from,
      subject: msg.subject,
      templateId: msg.templateId
    }, null, 2));

    await sgMail.send(msg);
    console.log(`${type} OTP email sent to ${email} using template ${templateId} with subject: "${msg.subject}"`);
    return true;
  } catch (error) {
    console.error('Email sending error:', error.response ? JSON.stringify(error.response.body, null, 2) : error);
    throw new Error('Failed to send OTP');
  }
};

const sendWelcomeEmail = async (user) => {
  try {
    
    if (!isEmailServiceAvailable()) {
      console.log(`⚠️  SendGrid not configured - skipping welcome email to ${user.email}`);
      return { success: false, message: 'Email service not configured' };
    }
    
    const coupon = await getWelcomeCoupon();
    
    const msg = {
      to: user.email,
      from: {
        email: EMAIL_CONFIG.user,
        name: 'Smart Living Tech'
      },
      subject: 'Welcome to Smart Living Tech! 🎉',
      templateId: EMAIL_CONFIG.templates.welcome,
      dynamicTemplateData: {
        firstName: user.firstName || 'Customer',
        code: coupon.code,
        discountValue: coupon.discountValue
      }
    };

    ensureEmailSubject(msg, 'Welcome to Smart Living Tech! 🎉');

    console.log('📧 Welcome Email message being sent:', JSON.stringify({
      to: msg.to,
      from: msg.from,
      subject: msg.subject,
      templateId: msg.templateId
    }, null, 2));

    await sgMail.send(msg);
    console.log(`Welcome email sent to ${user.email} using template ${EMAIL_CONFIG.templates.welcome} with coupon ${coupon.code} and subject: "${msg.subject}"`);
    return true;
  } catch (error) {
    console.error('Welcome email sending error:', error.response ? JSON.stringify(error.response.body, null, 2) : error);
    return false;
  }
};

const sendFailedLoginAttemptEmail = async (user) => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log(`⚠️  SendGrid not configured - skipping failed login attempt email to ${user.email}`);
            return { success: false, message: 'Email service not configured' };
        }
        
        const msg = {
            to: user.email,
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech Security'
            },
            subject: 'Security Alert: Multiple Failed Login Attempts',
            templateId: EMAIL_CONFIG.templates.multipleLoginAttempts,
            dynamicTemplateData: {
                firstName: user.firstName || 'Customer'
            }
        };

        ensureEmailSubject(msg, 'Security Alert: Multiple Failed Login Attempts');

        console.log('📧 Failed Login Attempt Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        await sgMail.send(msg);
        console.log(`Failed login attempt email sent to ${user.email} using template ${EMAIL_CONFIG.templates.multipleLoginAttempts} with subject: "${msg.subject}"`);
        return true;
    } catch (error) {
        console.error(`Error sending failed login attempt email to ${user.email}:`, error.response ? JSON.stringify(error.response.body, null, 2) : error);
        return false;
    }
};

const sendPasswordChangedEmail = async (user) => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log(`⚠️  SendGrid not configured - skipping password changed email to ${user.email}`);
            return { success: false, message: 'Email service not configured' };
        }
        
        const msg = {
            to: user.email,
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech Security'
            },
            subject: 'Password Changed Successfully',
            templateId: EMAIL_CONFIG.templates.passwordChanged,
            dynamicTemplateData: {
                firstName: user.firstName || 'Customer'
            }
        };

        ensureEmailSubject(msg, 'Password Changed Successfully');

        console.log('📧 Password Changed Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        await sgMail.send(msg);
        console.log(`Password changed email sent to ${user.email} using template ${EMAIL_CONFIG.templates.passwordChanged} with subject: "${msg.subject}"`);
        return true;
    } catch (error) {
        console.error(`Error sending password changed email to ${user.email}:`, error.response ? JSON.stringify(error.response.body, null, 2) : error);
        return false;
    }
};

const sendContactFormEmail = async (contactData) => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log('⚠️  SendGrid not configured - logging contact form submission');
            console.log('Contact Form Submission:', contactData);
            return { success: false, message: 'Email service not configured' };
        }

        if (!contactData.firstName || !contactData.lastName || !contactData.email || !contactData.subject || !contactData.message) {
            console.log('⚠️  Missing required fields in contact form data');
            return { success: false, message: 'Missing required fields' };
        }

        const templateId = EMAIL_CONFIG.templates?.contactSubmission;
        
        if (!templateId || templateId === 'd-contactsubmission') {
            console.warn('⚠️  Contact form template ID not configured. Using default template.');
        }

        const templateData = {
            firstName: contactData.firstName.trim(),
            lastName: contactData.lastName.trim(),
            email: contactData.email.trim(),
            phone: contactData.phone ? contactData.phone.trim() : 'Not provided',
            subject: contactData.subject.trim(),
            message: contactData.message.trim()
        };

        const msg = {
            to: 'smartlivingtech0@gmail.com',
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech Contact Form'
            },
            subject: `New Contact Form Submission: ${templateData.subject}`,
            templateId: templateId,
            dynamicTemplateData: templateData
        };

        ensureEmailSubject(msg, `New Contact Form Submission: ${templateData.subject}`);

        console.log('📧 Contact Form Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        await sgMail.send(msg);
        console.log(`✅ Contact form submission from ${contactData.email} sent successfully to company with subject: "${msg.subject}"`);
        return { success: true, message: 'Contact form email sent successfully' };
        
    } catch (error) {
        console.error('❌ Error sending contact form email:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return { success: false, message: 'Failed to send contact form email', error };
    }
};

const sendOrderConfirmationEmail = async (orderData) => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log(`⚠️  SendGrid not configured - skipping order confirmation email to ${orderData.customerEmail}`);
            return false;
        }

        console.log('📧 Processing order confirmation email with data:', {
            orderId: orderData._id,
            orderNumber: orderData.orderNumber,
            customerEmail: orderData.customerEmail,
            itemCount: orderData.orderItems?.length
        });

        const formattedItems = orderData.orderItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: `$${item.price.toFixed(2)}`,
            total: `$${(item.price * item.quantity).toFixed(2)}`,
            imageUrl: item.imageUrl || ''
        }));

        const shippingAddress = orderData.shippingAddress ? {
            street: orderData.shippingAddress.street,
            apartment: orderData.shippingAddress.apartmentSuite || orderData.shippingAddress.apartment || '',
            city: orderData.shippingAddress.city || orderData.shippingAddress.suburb,
            state: orderData.shippingAddress.state,
            zipCode: orderData.shippingAddress.zipCode,
            country: orderData.shippingAddress.country || 'Australia'
        } : null;

        const totals = {
            subtotal: `$${orderData.subtotal.toFixed(2)}`,
            shipping: orderData.shipping > 0 ? `$${orderData.shipping.toFixed(2)}` : 'FREE',
            tax: orderData.tax && orderData.tax > 0 ? `$${orderData.tax.toFixed(2)}` : 'Included',
            discount: orderData.discount && orderData.discount > 0 ? `-$${orderData.discount.toFixed(2)}` : null,
            total: `$${orderData.totalPrice.toFixed(2)}`
        };

        const adminOrdersUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/adminOrders.html`;

        console.log('Sending order confirmation email with template data:', {
            to: orderData.customerEmail,
            templateId: EMAIL_CONFIG.templates.orderConfirmation,
            firstName: orderData.customerFirstName,
            orderNumber: orderData.orderNumber,
            itemCount: formattedItems.length,
            total: totals.total
        });

        const msg = {
            to: orderData.customerEmail,
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech'
            },
            subject: `Order Confirmation - #${orderData.orderNumber}`,
            templateId: EMAIL_CONFIG.templates.orderConfirmation,
            dynamicTemplateData: {
                firstName: orderData.customerFirstName || 'Customer',
                orderNumber: orderData.orderNumber,
                orderDate: new Date(orderData.orderDate).toLocaleDateString('en-AU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                orderItems: formattedItems,
                shippingAddress: shippingAddress,
                paymentMethod: orderData.paymentMethod || 'Credit Card (Stripe)',
                totals: totals,
                adminOrdersUrl: adminOrdersUrl,
                supportEmail: 'support@smartlivingtech.com',
                supportPhone: '+61 1800 123 456'
            }
        };

        ensureEmailSubject(msg, `Order Confirmation - #${orderData.orderNumber}`);

        console.log('📧 Order Confirmation Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        console.log('📤 Attempting to send email via SendGrid...');
        await sgMail.send(msg);
        console.log('✅ Order confirmation email sent successfully to:', orderData.customerEmail, 'with subject: "' + msg.subject + '"');
        return true;
        
    } catch (error) {
        console.error('❌ Order confirmation email sending error:', error);

        if (error.response) {
            console.error('SendGrid API Error Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                body: error.response.body
            });
        }

        if (error.response?.body?.errors) {
            console.error('SendGrid Validation Errors:', error.response.body.errors);
        }
        
        return false;
    }
};

const sendInstallationNotificationEmail = async (installation, eventType = 'created') => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log(`⚠️  SendGrid not configured - skipping installation email to ${installation.customerEmail}`);
            return { success: false, message: 'Email service not configured' };
        }

        const installationDate = new Date(installation.installationDate).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const orderNumber = installation.orderNumber || installation.orderId?.orderNumber || 'N/A';
        const orderTotal = installation.orderId?.total ? `$${installation.orderId.total.toFixed(2)}` : 'N/A';

        const manageUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/user_account.html`;
        const adminInstallationsUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/adminInstallations.html`;

        console.log('Sending installation confirmation email:', {
            to: installation.customerEmail,
            templateId: EMAIL_CONFIG.templates.installationConfirmation,
            customerName: installation.customerName,
            orderNumber: orderNumber,
            installationDate: installationDate,
            address: installation.address  
        });

        console.log('📋 Installation data being sent to email:', {
            customerName: installation.customerName,
            orderNumber: orderNumber,
            installationDate: installationDate,
            installationAddress: installation.address,
            contactNumber: installation.contactNumber,
            customerEmail: installation.customerEmail,
            notes: installation.notes || 'No additional notes',
            status: installation.status || 'pending',
            orderTotal: orderTotal
        });

        const msg = {
            to: installation.customerEmail,
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech'
            },
            subject: `Installation Booking Confirmed - Order #${orderNumber}`,
            templateId: EMAIL_CONFIG.templates.installationConfirmation,
            dynamicTemplateData: {
                customerName: installation.customerName,
                orderNumber: orderNumber,
                installationDate: installationDate,
                installationAddress: installation.address,
                contactNumber: installation.contactNumber,
                customerEmail: installation.customerEmail,
                notes: installation.notes || 'No additional notes',
                status: installation.status || 'pending',
                orderTotal: orderTotal,
                manageUrl: manageUrl,
                adminInstallationsUrl: adminInstallationsUrl,
                supportEmail: EMAIL_CONFIG.user,
                currentYear: new Date().getFullYear()
            }
        };

        console.log('📧 Installation Confirmation Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        console.log('📤 Attempting to send installation confirmation email via SendGrid...');
        await sgMail.send(msg);
        console.log('✅ Installation confirmation email sent successfully to:', installation.customerEmail, 'with subject: "' + msg.subject + '"');
        return true;
        
    } catch (error) {
        console.error('❌ Installation confirmation email sending error:', error);

        if (error.response) {
            console.error('SendGrid API Error Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                body: error.response.body
            });
        }

        if (error.response?.body?.errors) {
            console.error('SendGrid Validation Errors:', error.response.body.errors);
        }
        
        return false;
    }
};

const sendInstallationAdminNotificationEmail = async (installation, eventType = 'created') => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log(`⚠️  SendGrid not configured - skipping admin installation notification`);
            return { success: false, message: 'Email service not configured' };
        }

        const adminEmail = process.env.ADMIN_EMAIL || EMAIL_CONFIG.user;

        const installationDate = new Date(installation.installationDate).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const orderNumber = installation.orderNumber || installation.orderId?.orderNumber || 'N/A';

        const adminInstallationsUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/adminInstallations.html`;
        const adminOrdersUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/adminOrders.html`;

        const msg = {
            to: adminEmail,
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech - System'
            },
            subject: `New Installation Booking - Order ${orderNumber}`,
            text: `
New Installation Booking Received

Customer: ${installation.customerName}
Email: ${installation.customerEmail}
Phone: ${installation.contactNumber}
Order Number: ${orderNumber}
Installation Date: ${installationDate}
Address: ${installation.address}
Notes: ${installation.notes || 'None'}
Status: ${installation.status}

Please review and confirm the installation booking.
            `,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #10b981;">New Installation Booking Received</h2>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Customer:</strong> ${installation.customerName}</p>
                        <p><strong>Email:</strong> ${installation.customerEmail}</p>
                        <p><strong>Phone:</strong> ${installation.contactNumber}</p>
                        <p><strong>Order Number:</strong> ${orderNumber}</p>
                        <p><strong>Installation Date:</strong> ${installationDate}</p>
                        <p><strong>Address:</strong> ${installation.address}</p>
                        <p><strong>Notes:</strong> ${installation.notes || 'None'}</p>
                        <p><strong>Status:</strong> ${installation.status}</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${adminInstallationsUrl}" style="background-color: #10b981; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                            Manage Installations
                        </a>
                        <a href="${adminOrdersUrl}" style="background-color: #3182ce; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                            View Orders
                        </a>
                    </div>
                    <hr>
                    <p style="text-align: center; color: #666; font-size: 14px;">
                        Please review and confirm the installation booking in the admin panel.
                    </p>
                </div>
            `
        };

        console.log('📧 Admin Installation Notification Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        console.log('📤 Sending admin notification for installation booking...');
        await sgMail.send(msg);
        console.log('✅ Admin notification email sent successfully with subject: "' + msg.subject + '"');
        return true;
        
    } catch (error) {
        console.error('❌ Admin notification email error:', error);
        return false;
    }
};

const sendOrderStatusEmail = async (order, newStatus, customerEmail) => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log(`⚠️  SendGrid not configured - skipping order status email to ${customerEmail}`);
            return { success: false, message: 'Email service not configured' };
        }

        const recipientEmail = customerEmail || order.customerInfo?.email;

        if (!recipientEmail) {
            console.log(`⚠️  No email address provided for order status update`);
            return { success: false, message: 'No email address provided' };
        }

        const orderDate = new Date(order.orderDate || order.createdAt).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const orderNumber = order.orderNumber || 'N/A';
        const customerName = order.customerInfo?.firstName || 'Customer';

        const statusMessages = {
            'pending': 'Your order is pending confirmation',
            'confirmed': 'Your order has been confirmed',
            'processing': 'Your order is being processed',
            'shipped': 'Your order has been shipped',
            'delivered': 'Your order has been delivered',
            'completed': 'Your order has been completed',
            'cancelled': 'Your order has been cancelled',
            'refunded': 'Your order has been refunded'
        };

        const statusMessage = statusMessages[newStatus] || 'Order status updated';

        const orderItems = order.items?.map(item => ({
            name: item.name || item.productName || 'Product',
            quantity: item.quantity || 1,
            price: `$${(item.price || 0).toFixed(2)}`,
            total: `$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`
        })) || [];

        const shippingAddress = order.shippingAddress ? {
            street: order.shippingAddress.street,
            apartment: order.shippingAddress.apartmentSuite || order.shippingAddress.apartment || '',
            city: order.shippingAddress.city || order.shippingAddress.suburb,
            state: order.shippingAddress.state,
            zipCode: order.shippingAddress.zipCode,
            country: order.shippingAddress.country || 'Australia'
        } : null;

        const adminOrdersUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/adminOrders.html`;

        console.log('Sending order status update email:', {
            to: recipientEmail,
            orderNumber: orderNumber,
            newStatus: newStatus
        });

        const msg = {
            to: recipientEmail,
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech'
            },
            subject: `Order Status Update - ${orderNumber}`,
            html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <title>Order Status Update - Smart Living Tech</title>
                </head>
                <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background:#f9f9f9; margin:0; padding:20px;">
                    <div style="max-width:700px; margin:auto; background:#fff; padding:30px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Logo -->
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="https://res.cloudinary.com/dkx5o5nqk/image/upload/v1759927622/logo_without_background_n42aqy.png" alt="Smart Living Tech Logo" style="max-width: 150px;" />
                        </div>

                        <!-- Header -->
                        <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem; margin-bottom: 1.5rem; font-weight: 600; text-align: left;">
                            Order Status Update
                        </h2>

                        <div style="text-align: left;">
                            <p>Hi ${customerName},</p>
                            
                            <!-- Status Summary -->
                            <div style="background-color: #d1fae5; color: #065f46; border: 1px solid #10b981; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                                <strong>📦 ${statusMessage}!</strong><br>
                                Order Number: <strong>${orderNumber}</strong>
                            </div>

                            <!-- Order Summary -->
                            <div style="background: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
                                <h3 style="margin-top: 0;">Order Details</h3>
                                <p style="margin: 8px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
                                <p style="margin: 8px 0;"><strong>Order Date:</strong> ${orderDate}</p>
                                <p style="margin: 8px 0;"><strong>Current Status:</strong> <span style="color: #10b981; font-weight: bold;">${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</span></p>
                                <p style="margin: 8px 0;"><strong>Total Amount:</strong> $${(order.total || 0).toFixed(2)}</p>
                            </div>

                            ${orderItems.length > 0 ? `
                            <!-- Order Items -->
                            <div style="margin-bottom: 30px;">
                                <h3>Order Items</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background: #f1f5f9;">
                                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Product</th>
                                            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                                            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${orderItems.map(item => `
                                            <tr>
                                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
                                                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">${item.quantity}</td>
                                                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">${item.total}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            ` : ''}

                            ${shippingAddress ? `
                            <!-- Shipping Address -->
                            <div style="margin-bottom: 30px;">
                                <h3>Shipping Address</h3>
                                <p style="margin: 5px 0;">${shippingAddress.street}</p>
                                ${shippingAddress.apartment ? `<p style="margin: 5px 0;">${shippingAddress.apartment}</p>` : ''}
                                <p style="margin: 5px 0;">${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}</p>
                                <p style="margin: 5px 0;">${shippingAddress.country}</p>
                            </div>
                            ` : ''}

                            ${order.trackingNumber ? `
                            <!-- Tracking Info -->
                            <div style="background-color: #eff6ff; border-left: 4px solid #3182ce; padding: 20px; margin: 30px 0; border-radius: 0 6px 6px 0;">
                                <h4 style="color: #1e40af; margin: 0 0 10px 0;">📍 Tracking Information</h4>
                                <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${order.trackingNumber}</p>
                                ${order.carrier ? `<p style="margin: 5px 0;"><strong>Carrier:</strong> ${order.carrier}</p>` : ''}
                            </div>
                            ` : ''}

                            <!-- Action Buttons -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${adminOrdersUrl}" style="background-color: #6b7280; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                                    Admin Panel
                                </a>
                            </div>

                            <!-- Footer -->
                            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #1a365d; font-style: italic; text-align: center;">
                                Thank you for choosing Smart Living Tech!<br>
                                This is an automated message — please do not reply directly to this email.
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        console.log('📧 Order Status Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        console.log('📤 Attempting to send order status email via SendGrid...');
        await sgMail.send(msg);
        console.log('✅ Order status email sent successfully to:', recipientEmail, 'with subject: "' + msg.subject + '"');
        return true;
        
    } catch (error) {
        console.error('❌ Order status email sending error:', error);

        if (error.response) {
            console.error('SendGrid API Error Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                body: error.response.body
            });
        }
        
        return false;
    }
};

const sendInstallationStatusEmail = async (installation, newStatus, customerEmail) => {
    try {
        
        if (!isEmailServiceAvailable()) {
            console.log(`⚠️  SendGrid not configured - skipping installation status email to ${customerEmail}`);
            return { success: false, message: 'Email service not configured' };
        }

        const recipientEmail = customerEmail || installation.customerEmail;

        if (!recipientEmail) {
            console.log(`⚠️  No email address provided for installation status update`);
            return { success: false, message: 'No email address provided' };
        }

        const installationDate = new Date(installation.installationDate).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const orderNumber = installation.orderNumber || installation.orderId?.orderNumber || 'N/A';

        const statusMessages = {
            'pending': 'Your installation request is pending confirmation',
            'confirmed': 'Your installation has been confirmed',
            'completed': 'Your installation has been completed successfully',
            'cancelled': 'Your installation has been cancelled'
        };

        const statusMessage = statusMessages[newStatus] || 'Installation status updated';

        const manageUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/user_account.html`;
        const adminInstallationsUrl = `${process.env.CLIENT_URL || 'https://smartlivingtech.me'}/adminInstallations.html`;

        console.log('Sending installation status update email:', {
            to: recipientEmail,
            templateId: EMAIL_CONFIG.templates.installationStatusUpdate,
            customerName: installation.customerName,
            orderNumber: orderNumber,
            newStatus: newStatus
        });

        const msg = {
            to: recipientEmail,
            from: {
                email: EMAIL_CONFIG.user,
                name: 'Smart Living Tech'
            },
            
            ...(EMAIL_CONFIG.templates.installationStatusUpdate && EMAIL_CONFIG.templates.installationStatusUpdate !== 'd-installationstatusupdate' ? {
                templateId: EMAIL_CONFIG.templates.installationStatusUpdate,
                dynamicTemplateData: {
                    customerName: installation.customerName,
                    orderNumber: orderNumber,
                    installationStatus: newStatus,
                    statusMessage: statusMessage,
                    installationDate: installationDate,
                    installationAddress: installation.address,
                    manageUrl: manageUrl,
                    adminInstallationsUrl: adminInstallationsUrl,
                    currentYear: new Date().getFullYear()
                }
            } : {
                subject: `Installation Status Update - Order ${orderNumber}`,
                html: `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8" />
                        <title>Installation Status Update - Smart Living Tech</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background:#f9f9f9; margin:0; padding:20px;">
                        <div style="max-width:700px; margin:auto; background:#fff; padding:30px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                            <!-- Logo -->
                            <div style="text-align: center; margin-bottom: 20px;">
                                <img src="https://res.cloudinary.com/dkx5o5nqk/image/upload/v1759927622/logo_without_background_n42aqy.png" alt="Smart Living Tech Logo" style="max-width: 150px;" />
                            </div>

                            <!-- Header -->
                            <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem; margin-bottom: 1.5rem; font-weight: 600; text-align: left;">
                                Installation Status Update
                            </h2>

                            <div style="text-align: left;">
                                <!-- Status Summary -->
                                <div style="background-color: #d1fae5; color: #065f46; border: 1px solid #10b981; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                                    <strong>🔧 ${statusMessage}!</strong><br>
                                    Order Number: <strong>${orderNumber}</strong>
                                </div>

                                <!-- Installation Summary -->
                                <div style="background: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
                                    <p style="margin: 8px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
                                    <p style="margin: 8px 0;"><strong>Current Status:</strong> ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</p>
                                    <p style="margin: 8px 0;"><strong>Installation Date:</strong> ${installationDate}</p>
                                    <p style="margin: 8px 0;"><strong>Installation Address:</strong> ${installation.address}</p>
                                </div>

                                <!-- Action Buttons -->
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${manageUrl}" style="background-color: #3182ce; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                                        Manage Installation
                                    </a>
                                    <a href="${adminInstallationsUrl}" style="background-color: #6b7280; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                                        Admin Panel
                                    </a>
                                </div>

                                <!-- Footer -->
                                <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #1a365d; font-style: italic; text-align: center;">
                                    Thank you for choosing Smart Living Tech!<br>
                                    This is an automated message — please do not reply directly to this email.
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            })
        };

        console.log('📧 Installation Status Email message being sent:', JSON.stringify({
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            templateId: msg.templateId
        }, null, 2));

        console.log('📤 Attempting to send installation status email via SendGrid...');
        await sgMail.send(msg);
        console.log('✅ Installation status email sent successfully to:', recipientEmail, 'with subject: "' + msg.subject + '"');
        return true;
        
    } catch (error) {
        console.error('❌ Installation status email sending error:', error);

        if (error.response) {
            console.error('SendGrid API Error Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                body: error.response.body
            });
        }
        
        return false;
    }
};

module.exports = { 
    sendOTPEmail, 
    sendWelcomeEmail, 
    sendFailedLoginAttemptEmail,
    sendPasswordChangedEmail,
    sendOrderConfirmationEmail,
    sendOrderStatusEmail,
    sendInstallationNotificationEmail,
    sendInstallationAdminNotificationEmail,
    sendInstallationStatusEmail,
    sendContactFormEmail,
    isEmailServiceAvailable
};
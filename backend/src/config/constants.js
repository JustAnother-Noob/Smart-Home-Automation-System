require('dotenv').config({ path: __dirname + '/.env' });

const DB_NAME = process.env.DB_NAME || 'SmartLivingTech';
let MONGO_URI_FULL = process.env.MONGO_URI;

if (MONGO_URI_FULL && !MONGO_URI_FULL.match(/\/[^/]+(\?|$)/)) {
  MONGO_URI_FULL = `${MONGO_URI_FULL}/${DB_NAME}`;
}

const CONSTANTS = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  PORT: process.env.PORT || 5002,
  MONGO_URI: MONGO_URI_FULL,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL || 'https://smartlivingtech.me',
  API_URL: process.env.API_URL || 'http://127.0.0.1:5002',
  LOG_RETENTION: {
    infoDays: Number(process.env.LOG_RETENTION_INFO_DAYS) || 30,
    warningDays: Number(process.env.LOG_RETENTION_WARNING_DAYS) || 90,
    errorDays: Number(process.env.LOG_RETENTION_ERROR_DAYS) || 180,
    securityDays: Number(process.env.LOG_RETENTION_SECURITY_DAYS) || 365,
    adminDays: Number(process.env.LOG_RETENTION_ADMIN_DAYS) || 365
  },
  LOG_MONITORING: {
    reviewIntervalHours: Number(process.env.LOG_MONITOR_REVIEW_HOURS) || 6,
    securitySpikeThreshold: Number(process.env.LOG_MONITOR_SECURITY_THRESHOLD) || 20
  },
  EMAIL_CONFIG: {
    sendGridApiKey: process.env.EMAIL_API,
    user: process.env.EMAIL_USERNAME || 'smartlivingtech0@gmail.com',
    
    templates: {
        accountVerification: process.env.SENDGRID_TEMPLATE_ACCOUNT_VERIFICATION || 'd-9877728a89a443709aa97bc5f24437c2',
        passwordReset: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET || 'd-19c850a13f5d4ad6a6d2746bfce75ac0',
        welcome: process.env.SENDGRID_TEMPLATE_WELCOME || 'd-0a7e2d411b484cf89a0dfea2d77dd853',
        passwordChanged: process.env.SENDGRID_TEMPLATE_PASSWORD_CHANGED || 'd-622955182a5949bcab085b847e6de3b0',
        multipleLoginAttempts: process.env.SENDGRID_TEMPLATE_MULTIPLE_LOGIN || 'd-09dbd22376fc433ab0769a86bd03713e',
        orderConfirmation: process.env.SENDGRID_TEMPLATE_ORDER_CONFIRMATION || 'd-869c566b9f064b199fd960bd1f254519',
        installationConfirmation: process.env.SENDGRID_TEMPLATE_INSTALLATION_CONFIRMATION || 'd-defaultinstallation',
        installationStatusUpdate: process.env.SENDGRID_TEMPLATE_INSTALLATION_STATUS_UPDATE || 'd-installationstatusupdate',
        contactSubmission: process.env.SENDGRID_TEMPLATE_CONTACT_FORM_EMAIL || 'd-37483749afb3417c9498de4cc4f1d04b',
        contactConfirmation: process.env.SENDGRID_TEMPLATE_CONTACT_CONFIRMATION || 'd-contactconfirmation'
    }
  },
  RECAPTCHA: {
    siteKey: process.env.RECAPTCHA_SITE_KEY,
    secretKey: process.env.RECAPTCHA_SECRET_KEY,
    skipValidation: process.env.SKIP_RECAPTCHA === 'true'
  },
  
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  DISABLE_CSRF: process.env.DISABLE_CSRF === 'true' || process.env.NODE_ENV === 'development',
    CLOUDINARY: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    enabled: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  },
  MONGODB_CHARTS: {
    baseUrl: process.env.FRONTEND_CHARTS_BASE_URL || 'https://charts.mongodb.com/charts-project-0-bwexumm',
    dashboardId: process.env.FRONTEND_CHARTS_DASHBOARD_ID,
    chart1Id: process.env.FRONTEND_CHARTS_CHART_1_ID,
    chart2Id: process.env.FRONTEND_CHARTS_CHART_2_ID,
    weeklyId: process.env.FRONTEND_CHARTS_WEEKLY_ID,
    monthlyId: process.env.FRONTEND_CHARTS_MONTHLY_ID,
    weeklyByDateId: process.env.FRONTEND_CHARTS_WEEKLY_BY_DATE_ID,
    dailyId: process.env.FRONTEND_CHARTS_DAILY_ID,
    theme: process.env.FRONTEND_CHARTS_THEME || 'light',
    maxDataAge: Number(process.env.FRONTEND_CHARTS_MAX_DATA_AGE) || 0
  }
};

module.exports = CONSTANTS;
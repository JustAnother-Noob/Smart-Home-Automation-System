require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const connectDB = require('../config/db');
const authRoutes = require('../routes/authRoutes');

const app = express();
const port = process.env.PORT || 5001;

// Connect to database
connectDB();

app.use(express.json());

// Middleware
app.use(cors({
    origin: 'http://127.0.0.1:5500', // allow from frontend
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Basic route for testing
app.get('/', (req, res) => {
    res.send('University Project API');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

app.get('/signup', (req, res) => {
    res.render('signup', {
        recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY // Pass site key to the view
    });
});
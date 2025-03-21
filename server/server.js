require('dotenv').config();
const cors = require('cors'); // to remove server errors
const bcrypt = require('bcryptjs'); // to hash password
const express = require('express'); // to create server
const mongoose = require('mongoose'); // to connect to database
const { validateEmail, validatePassword } = require('../utils/validators.js'); 
const User = require('./models/user.models.js'); // to use user model
const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
// express feature to parse json
app.use(express.json());

// connecting server to mongodb
const dbURI = process.env.MONGO_URI;
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB Atlas!"))
    .catch(err => console.error("MongoDB Connection Error:", err));

//---------------------- Register---------------------------------------------------

// **********************Main Code for Signup*******************************
app.post('/signup', async (req, res) => {
    let { email, password } = req.body;
    email = email.toLowerCase();

    // Email validation
    if (!validateEmail(email)) return res.status(400).json({ message: 'Invalid email' });

    // Password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) return res.status(400).json({ message: 'Invalid password', requirements: passwordValidation.requirements });

    try {
        // Existing user check
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ 
                message: 'Email already exists',
                type: 'email'
            });
        }

        // Password hashing and user creation
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();

        console.log("New user registered:", email);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: 'Error registering user' });
    }
});
// ----------------------End of Register--------------------------------------------


// ----------------------Login------------------------------------------------------
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user in the database by their email
        const user = await User.findOne({ email });

        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                console.log("Logged in: ", user.email);
                res.status(200).json({ message: "Logged in successfully!" });
            } else {
                console.log("Incorrect password for email: ", email);
                res.status(401).json({ message: "Incorrect password" });
            }
        } else {
            // 5. User not found
            console.log("User not found for email: ", email);
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        // 6. Handle any errors that occur during the database query or password comparison
        console.error("Login error:", error);
        res.status(500).json({ message: "Login failed due to server error" });
    }
});
//-----------------------------------------------------------------------------------
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


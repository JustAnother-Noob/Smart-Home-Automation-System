const cors = require('cors'); // to remove server errors
const bcrypt = require('bcryptjs'); // to hash password
const express = require('express'); // to create server
const mongoose = require('mongoose'); // to connect to database
const User = require('./models/user.models.js'); // to use user model
const app = express();
const port = 5001;

app.use(cors());
// express feature to parse json
app.use(express.json());

// connecting server to mongodb
const mongoURI = 'mongodb://127.0.0.1:27017/smart_home_auth';

//using mongoose to connect to mongodb
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected')) //for debugging
.catch(err => console.error('MongoDB connection error:', err));

//----------------------Register---------------------------------------------------
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Check if a user with this email already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({ message: 'Email already exists' }); // 409 Conflict
        }

        // 2. Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Create a new user in the database
        const newUser = new User({
            email: email,
            password: hashedPassword,
        });

        // 4. Save the new user to the database
        await newUser.save();

        // 5. Send a success response
        console.log("New user registered:", email);
        res.status(201).json({ message: 'User registered successfully!' }); // 201 Created
    } catch (error) {
        // 6. Handle any errors during the process
        console.error("Signup error:", error);
        res.status(500).json({ message: 'Error registering user' }); // 500 Internal Server Error
    }
});
//-----------------------------------------------------------------------------------

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


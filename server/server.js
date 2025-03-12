// importing express, cors and setting port
const cors = require('cors');
const bcrypt = require('bcryptjs');
const express = require('express');
const app = express();
const port = 5001;

app.use(cors());
// express feature to parse json
app.use(express.json());

// hardcoded user creds
const users = [
    {
        email: "nothing@gmail.com",
        password: bcrypt.hashSync('password', 10) // hashing password with bcrypt
    },
    {
        email: "something@gmail.com",
        password: bcrypt.hashSync('password123', 10)
    },
];

app.post('/login', async (req, res) => {
    // getting creds from request
    const { email, password } = req.body;
    // finding user with email
    const user = users.find(user => user.email === email);
    // user authentication
    if (user) {
        const passwordMatch = bcrypt.compare(password, user.password); //comparing entered password with hashed password
        if (passwordMatch) {
            console.log("Logged in: ", user);
            console.log('Entered password:', password); // for debugging
            console.log('Stored hash:', user.password); // for debugging
            res.status(200).json({ message: "Logged in" });
        }
        else {
            console.log("Incorrect password: ", user);
            res.status(401).json({ message: "Incorrect password" });
        }
    }
    else {
        console.log("User not found: ", email);
        res.status(404).json({ message: "User not found" });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
Here's a concise README.md for your Git repository:

```markdown
# Smart Home Automation System

A smart home automation system with React frontend and Node.js backend.

## Prerequisites

- Node.js (v16+ recommended)
- npm (comes with Node.js)
- Git

## Getting Started

### Clone the Repository

1. Clone the repo and switch to the `login-react` branch:
```bash
git clone git@github.com:JustAnother-Noob/Smart-Home-Automation-System.git
cd Smart-Home-Automation-System
git checkout login-react
```

### Install Dependencies

2. Navigate to project directories and install dependencies:

#### Frontend Setup
```bash
cd frontend
npm install
```

#### Backend Setup
```bash
cd ../backend
npm install
```

### Run the Application

3. Start the backend server:
```bash
cd backend/src
nodemon server.js  # or: node server.js
```

4. Start the frontend development server (in a new terminal):
```bash
cd frontend
npm run dev
```

## Project Structure

```
Smart-Home-Automation-System/
├── frontend/       # React application
│   ├── public/
│   └── src/
└── backend/        # Node.js server
    └── src/
        └── server.js
```

## Running the Servers

- **Backend**: Runs on `http://localhost:5000`
- **Frontend**: Runs on `http://localhost:5173` (default Vite port)

## Notes

- Ensure you have nodemon installed globally for hot-reloading (optional):
  ```bash
  npm install -g nodemon
  ```
- Create a `.env` file in backend directory with required environment variables
- Install project dependencies in both frontend and backend directories before first run
```

## Troubleshooting

- If you get installation errors:
  - Delete `node_modules` and `package-lock.json` in the problematic directory
  - Run `npm install` again
- Port conflicts:
  - Change port numbers in respective configuration files
  - Update CORS settings in backend if changing frontend port

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

[MIT](LICENSE)
```

This README includes:
1. Clear installation instructions
2. Project structure visualization
3. Running commands for both frontend and backend
4. Troubleshooting tips
5. Standard documentation sections
6. Proper code formatting for commands

Adjust the ports, license information, and contributing guidelines as needed for your specific project requirements.

# Smart Home Automation System

Smart Living Tech website made with a React frontend and Node.js backend.

## Prerequisites

- Node.js (v16+ recommended)
- npm (comes with Node.js)
- Git

## Getting Started

### Clone the Repository

1. Clone the repository and switch to the `login-react` branch:

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

- **Backend**: Runs on `http://localhost:5001`
- **Frontend**: Runs on `http://localhost:5173` (default Vite port)


## Troubleshooting

- **Installation Errors:**
  - Delete `node_modules` and `package-lock.json` in the problematic directory.
  - Run `npm install` again.
- **Port Conflicts:**
  - Change port numbers in respective configuration files.
  - Update CORS settings in the backend if changing the frontend port.

## Additional Notes

- Ensure you have `nodemon` installed globally for hot-reloading (optional):
  
  ```bash
  npm install -g nodemon
  ```
- Install project dependencies in both `frontend/` and `backend/` directories before the first run.

# Quick Start - Backend on Your Laptop

## 🚀 Fastest Way to Start

### Windows:
1. Double-click `start-local.bat` in the `backend` folder
2. The script will:
   - Create `.env` file if it doesn't exist
   - Install dependencies if needed
   - Initialize database if needed
   - Start the server

### Mac/Linux:
```bash
cd backend
npm install
npm run migrate
npm run dev
```

## 📋 Manual Setup (Step by Step)

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Create Environment File
Copy `env.example` to `.env`:
```bash
# Windows
copy env.example .env

# Mac/Linux
cp env.example .env
```

The `.env` file is already configured for local development - no changes needed!

### Step 3: Initialize Database
```bash
npm run migrate
```

### Step 4: Start the Server
```bash
npm run dev
```

The server will start on **http://localhost:5000**

## ✅ Verify It's Working

Open your browser and go to:
```
http://localhost:5000/health
```

You should see:
```json
{
  "status": "OK",
  "timestamp": "...",
  "uptime": ...
}
```

## 🔗 Connect Your Frontend

The backend is now ready! Your frontend is already configured to connect to `http://localhost:5000`.

### To run the frontend:
```bash
cd frontend
npm run dev
```

### Or run the desktop app:
```bash
cd frontend
npm run electron:dev
```

## 📝 Important Notes

1. **Port**: Backend runs on port 5000 by default
2. **Database**: SQLite database is created automatically at `database/sumitask.db`
3. **No External Services Required**: Works without Google OAuth, Twilio, or Cloudinary
4. **Guest Users**: You can create guest users without authentication
5. **File Uploads**: Files are stored locally in the `uploads` folder

## 🛠️ Troubleshooting

### Port 5000 Already in Use?
Change the port in `.env`:
```env
PORT=5001
```

Then update frontend `api.ts` to use the new port, or set:
```env
VITE_API_URL=http://localhost:5001
```

### Database Errors?
Delete the database and reinitialize:
```bash
rm database/sumitask.db
npm run migrate
```

### Dependencies Not Installing?
Make sure you have Node.js v18 or higher:
```bash
node --version
```

## 🎉 You're All Set!

The backend is now running on your laptop. Start your frontend and you're ready to go!

For more details, see `SETUP_LOCAL.md`



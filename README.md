# ViMusic – Web Version with Cloud Sync

![React](https://img.shields.io/badge/React-18.3-blue)
![Vite](https://img.shields.io/badge/Vite-5.4-purple)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-teal)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Storage-brightgreen)

A web version of the popular **ViMusic** Android app — now with **Google login + cloud sync** via Supabase.

Uses the **exact same SQLite schema** as the original app. So, Your playlists, favorites, play counts — everything stays intact.

## ✨ Features

- Full cloud sync with google login(Supabase Storage)
- Guest mode, supports old vimusic databse
- Favorites, playlists, reorder songs
- YouTube search (official API)
- Beautiful player with shuffle/repeat
- Import / Export `.db` file

## 🚀 Tech Stack

**Frontend**: React 18 + Vite + TailwindCSS + Lucide Icons  
**Backend**: Node.js + Express + better-sqlite3  
**Auth & Storage**: Supabase (Google OAuth + Storage)  
**Database**: SQLite (ViMusic Android compatible)

## 📦 Installation

### Prerequisites

- Node.js (v14 or higher)

### 1. Clone Repository

```bash
git clone https://github.com/ab007shetty/ViMusic.git
cd vimusic
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install
```

Add the following to `.env`:

```env
PORT=5000

# Supabase Configuration
SUPABASE_URL=https://username.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

```bash
# Start backend server
npm run dev
```

Backend will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
# Navigate to frontend directory (from root)
cd frontend

# Install dependencies
npm install
```

Add the following to frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api

VITE_YOUTUBE_API_KEY=get_it_from_gcp

# Supabase Configuration
VITE_SUPABASE_URL=https://username.supabase.co
VITE_SUPABASE_ANON_KEY=anon_key
```

```bash
# Start frontend development server
npm run dev
```

Frontend will run on `http://localhost:3000`

## 🗂️ Project Structure

```bash
|-- backend
|   |-- package-lock.json
|   |-- package.json
|   |-- public
|   |   +-- database
|   |       |-- empty.db
|   |       +-- vimusic.db
|   |-- scripts
|   |   |-- syncGuestDatabase.js
|   |   +-- testSync.js
|   +-- server.js

|-- eslint.config.js

|-- frontend
|   |-- index.html
|   |-- package-lock.json
|   |-- package.json
|   |-- postcss.config.js
|   |-- public
|   |   +-- images
|   |       |-- beats.jpeg
|   |       |-- default.jpg
|   |       |-- high.jpeg
|   |       |-- kannada.jpg
|   |       |-- low.jpeg
|   |       +-- peace.jpeg
|   |-- src
|   |   |-- App.jsx
|   |   |-- components
|   |   |   |-- AccountSettingsModal.jsx
|   |   |   |-- Header.jsx
|   |   |   |-- LoginModal.jsx
|   |   |   |-- Player.jsx
|   |   |   |-- PlaylistCard.jsx
|   |   |   |-- Sidebar.jsx
|   |   |   |-- SongCard.jsx
|   |   |   +-- SortFilter.jsx
|   |   |-- contexts
|   |   |   +-- PlayerContext.jsx
|   |   |-- index.css
|   |   |-- main.jsx
|   |   |-- supabase.js
|   |   +-- utils
|   |       |-- api.js
|   |       +-- databaseUtils.js
|   |-- tailwind.config.js
|   +-- vite.config.js

|-- LICENSE
+-- README.md

```

## 📄 License

This project is licensed under the MIT License.

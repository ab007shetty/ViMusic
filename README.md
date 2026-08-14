# ViMusic – Web Version with Cloud Sync

![React](https://img.shields.io/badge/React-18.3-blue)
![Vite](https://img.shields.io/badge/Vite-5.4-purple)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-teal)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Realtime-brightgreen)

A sleek, responsive web version of the popular **ViMusic** Android app — featuring **Google OAuth + Real-time Cloud Sync** via Supabase, background lock-screen playback, and seamless audio/video toggling.

Compatible with the **exact same SQLite schema** as the original ViMusic Android app. Your playlists, favorites, and library stay completely intact.

---

## ✨ Features

- **🔒 Lock Screen & Background Playback**: Full MediaSession API support with high-resolution album artwork, lock screen playback controls, and headphone button support.
- **🔄 Instant Song / Video Toggle**: Switch seamlessly between lightweight audio mode and full HD video mode on the fly with a single click.
- **⚡ Real-time Cloud Sync**: Instant live database synchronization via Supabase Realtime sockets across devices without needing manual refreshes.
- **🎧 Master's Mix & Favorites**: Curated Master's Mix for guest visitors that converts into your personal Favorites library upon Google login.
- **📂 Playlist Management**: Create, edit, and organize custom playlists with intuitive add/remove indicators and quick actions.
- **⌨️ Desktop Keyboard Shortcuts**:
  - `Space` : Play / Pause
  - `→` (Right Arrow) : Next Song
  - `←` (Left Arrow) : Previous Song
- **🔍 YouTube Search & URL Support**: Search millions of tracks or directly paste YouTube / YouTube Music / Shorts URLs to play instantly.
- **📱 Responsive Minimized & Maximized Players**: Touch gestures (swipe down to minimize), subtitle support, shuffle, and repeat modes (One / All / Off).
- **💾 Import / Export Database**: Directly backup or import `.db` files compatible with Android ViMusic.

---

## 🚀 Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons, React Hot Toast
- **Backend**: Node.js, Express, Supabase JS SDK (Serverless / Vercel ready)
- **Auth & Realtime**: Supabase (Google OAuth + PostgreSQL Realtime)
- **Database**: PostgreSQL (Supabase) + SQLite `.db` import/export support

---

## 📦 Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/ab007shetty/ViMusic.git
cd vimusic
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
PORT=8080
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Start the backend server:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:8080/api
VITE_YOUTUBE_API_KEY=your_youtube_data_api_v3_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the frontend development server:

```bash
npm run dev
```

---

## 📄 License

This project is licensed under the MIT License.

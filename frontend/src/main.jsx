// main.jsx or index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AndroidLanding from './pages/AndroidLanding';
import './index.css';

// The player is a single screen with tabs, so there's no router in this app.
// /android is one static page; matching the path here keeps it that way
// instead of pulling in a routing library for a single route.
const isAndroidLanding = /^\/android\/?$/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAndroidLanding ? <AndroidLanding /> : <App />}
  </React.StrictMode>
);

// Thumbnail cache (see public/sw.js). Production only — in dev it would sit
// in front of Vite's module requests and serve stale code across restarts.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
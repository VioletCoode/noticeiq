import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initOneSignal } from './services/notifications'

// Initialize OneSignal Web Push once on app load
initOneSignal().catch((err) => console.warn('[OneSignal] Init error on startup:', err));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

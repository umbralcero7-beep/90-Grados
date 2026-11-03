import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Registro de Service Worker para PWA y soporte offline
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Registro de Service Worker omitido:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

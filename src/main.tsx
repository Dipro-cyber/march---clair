import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(() => {
      // Service worker registration is best-effort in restricted iframe contexts
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);


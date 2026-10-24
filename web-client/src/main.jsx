window.global = window;
window.process = window.process || {};
window.process.env = window.process.env || {};
window.process.nextTick = window.process.nextTick || ((fn, ...args) => setTimeout(() => fn(...args), 0));

import { Buffer } from 'buffer';
window.Buffer = window.Buffer || Buffer;

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <App />
)

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { QueryProvider } from './providers/QueryProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

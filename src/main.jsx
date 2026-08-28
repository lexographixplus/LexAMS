import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';
import './responsive.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);

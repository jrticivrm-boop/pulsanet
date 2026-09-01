import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import GlobalEscapeClose from './GlobalEscapeClose.jsx';
import { ThemeProvider } from './theme.jsx';
import './styles.css';
import './dispatch.css';
import './institutional.css';
import './theme-contrast.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <GlobalEscapeClose />
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

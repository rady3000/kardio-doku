import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { api } from './api';
import { flushAllAutosaves } from './autosave';
import './styles.css';

api.onBeforeClose(flushAllAutosaves);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

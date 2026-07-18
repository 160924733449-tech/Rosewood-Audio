import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './premium-ui.css'
import App from './App.jsx'

import { ToastProvider } from './components/Toast.jsx'
import { ContextMenuProvider } from './components/ContextMenu.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ContextMenuProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ContextMenuProvider>
  </StrictMode>,
)

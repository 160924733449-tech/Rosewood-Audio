import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({ toast, onRemove }) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    let innerTimer;
    const timer = setTimeout(() => {
      setIsClosing(true);
      innerTimer = setTimeout(() => onRemove(toast.id), 300); // match CSS animation
    }, toast.duration);

    return () => {
      clearTimeout(timer);
      if (innerTimer) clearTimeout(innerTimer);
    };
  }, [toast, onRemove]);

  return (
    <div className={`toast-message toast-${toast.type} ${isClosing ? 'toast-fade-out' : 'toast-fade-in'}`}>
      {toast.message}
    </div>
  );
}

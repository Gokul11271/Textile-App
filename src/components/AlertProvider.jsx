import React, { createContext, useContext, useCallback } from 'react';
import { toast } from 'sonner';

const AlertContext = createContext();

export const useAlert = () => useContext(AlertContext);

export const AlertProvider = ({ children }) => {
  const showAlert = useCallback((message, severity = 'info') => {
    let title = message;
    let description = undefined;
    
    if (message && typeof message === 'string' && message.includes('\n')) {
      const parts = message.split('\n');
      title = parts[0];
      description = parts.slice(1).join('\n');
    }

    // Give it a bit more time if there's a description to read (like a file path)
    const options = description ? { description, duration: 6000 } : {};

    switch(severity) {
      case 'success':
        toast.success(title, options);
        break;
      case 'error':
        toast.error(title, options);
        break;
      case 'warning':
        toast.warning(title, options);
        break;
      default:
        toast.info(title, options);
        break;
    }
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

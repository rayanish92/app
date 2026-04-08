import React, { useEffect, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Download, X } from '@phosphor-icons/react';

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }
    
    setDeferredPrompt(null);
    setShowInstall(false);
  }, [deferredPrompt]);

  if (!showInstall) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card border border-border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom">
      <button
        onClick={() => setShowInstall(false)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
          <Download size={24} className="text-primary-foreground" weight="bold" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-heading text-lg font-light mb-1">
            Install App
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Install this app on your device for quick access and offline use
          </p>
          
          <Button
            onClick={handleInstall}
            className="w-full bg-primary hover:bg-[#152B23] text-primary-foreground"
            size="sm"
          >
            Install Now
          </Button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useOnlineStatus } from '../lib/usePWAInstall';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-indicator"
      className="fixed top-3.5 right-4 md:top-5 md:right-6 z-50 flex items-center justify-center p-2 rounded-full bg-orange-500/10 border border-orange-400/40 text-orange-500 shadow-sm backdrop-blur-sm animate-pulse cursor-help"
      title="Você está offline — as alterações locais serão salvas e sincronizadas automaticamente"
      aria-label="Sem conexão à internet (Modo Offline)"
    >
      <WifiOff className="w-5 h-5 text-orange-500" strokeWidth={2.2} />
    </div>
  );
};

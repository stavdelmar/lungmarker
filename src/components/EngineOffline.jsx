import { WifiOff } from 'lucide-react';

export default function EngineOffline({ onRetry, message, dark }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-md border text-sm ${dark ? 'border-rose-400/30 bg-rose-950/40 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
      <WifiOff className="w-4 h-4 shrink-0" />
      <span className="font-medium">AI engine is offline</span>
      {message && <span className="opacity-70">{message}</span>}
      {onRetry && (
        <button onClick={onRetry} className={`ml-auto px-3 py-1 rounded border ${dark ? 'border-rose-300/30 hover:bg-rose-900/50' : 'bg-white border-rose-200 hover:bg-rose-100'}`}>
          Retry
        </button>
      )}
    </div>
  );
}
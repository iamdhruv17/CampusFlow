import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ title = 'Something went wrong', message = '', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle size={24} className="text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {message && <p className="text-sm text-slate-500 max-w-sm">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm mt-4">
          Try Again
        </button>
      )}
    </div>
  );
}

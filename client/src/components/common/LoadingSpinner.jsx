import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: 16, md: 24, lg: 40 };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 size={sizes[size]} className="animate-spin text-indigo-600" />
      {text && <p className="text-sm text-slate-500">{text}</p>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-white" />
        </div>
        <p className="text-sm text-slate-500">Loading CampusFlow...</p>
      </div>
    </div>
  );
}

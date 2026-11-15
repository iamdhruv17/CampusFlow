export default function StatCard({ label, value, icon: Icon, color = 'indigo', description }) {
  const colors = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', val: 'text-indigo-700' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', val: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', val: 'text-emerald-700' },
    red: { bg: 'bg-red-50', text: 'text-red-600', val: 'text-red-700' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', val: 'text-orange-700' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', val: 'text-blue-700' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-500', val: 'text-slate-700' },
  };

  const c = colors[color] || colors.indigo;

  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${c.val}`}>{value ?? '—'}</p>
          {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={c.text} />
        </div>
      </div>
    </div>
  );
}

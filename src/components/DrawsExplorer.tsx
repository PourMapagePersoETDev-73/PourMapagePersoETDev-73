import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EuroMillionsDraw, formatEur } from '../utils/euromillionsAnalysis';

interface DrawsExplorerProps {
  drawsDescending: EuroMillionsDraw[];
}

export const DrawsExplorer: React.FC<DrawsExplorerProps> = ({ drawsDescending }) => {
  const [query, setQuery] = useState('');
  const [dayFilter, setDayFilter] = useState<'ALL' | 'MARDI' | 'VENDREDI'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drawsDescending.filter((d) => {
      if (dayFilter !== 'ALL' && !d.jour.toUpperCase().includes(dayFilter)) {
        return false;
      }
      if (!q) return true;
      if (d.date.includes(q) || d.id.includes(q)) return true;
      const numQ = Number.parseInt(q, 10);
      if (!Number.isNaN(numQ)) {
        return d.balls.includes(numQ) || d.stars.includes(numQ);
      }
      return false;
    });
  }, [drawsDescending, query, dayFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Historique complet des tirages ({filtered.length} résultats)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Recherchez par date (ex : 20/11/2026), numéro de boule (1–50) ou identifiant de tirage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Date ou numéro (ex : 35)..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md w-52 focus:outline-none focus:border-blue-700"
            />
          </div>

          <div className="flex items-center border border-slate-200 rounded-md overflow-hidden text-xs">
            {(['ALL', 'MARDI', 'VENDREDI'] as const).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setDayFilter(day);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 font-medium cursor-pointer ${
                  dayFilter === day
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {day === 'ALL' ? 'Tous' : day === 'MARDI' ? 'Mardi' : 'Vendredi'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-md">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left font-mono uppercase text-slate-500">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Jour</th>
              <th className="py-2.5 px-3">Boules (1–50)</th>
              <th className="py-2.5 px-3">Étoiles</th>
              <th className="py-2.5 px-3 text-right">Somme</th>
              <th className="py-2.5 px-3 text-right">Gagnants R1 (EU)</th>
              <th className="py-2.5 px-3 text-right">Gain Rang 2</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  Aucun tirage ne correspond à votre recherche.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id + d.date} className="h-10 hover:bg-slate-50/70">
                  <td className="py-2 px-3 font-mono tabular-nums text-slate-900 font-medium">
                    {d.date}
                  </td>
                  <td className="py-2 px-3 text-slate-600">{d.jour}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 font-mono tabular-nums">
                      {d.balls.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-white text-[11px] font-semibold"
                        >
                          {b.toString().padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1 font-mono tabular-nums">
                      {d.stars.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-[11px] font-semibold"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {d.sum}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {d.winnersRank1Eu > 0 ? (
                      <span className="text-emerald-700 font-semibold">{d.winnersRank1Eu}</span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                    {d.payoutRank2 > 0 ? formatEur(d.payoutRank2) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="font-mono tabular-nums">
          Page {safePage} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
          >
            Précédent
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
          >
            Suivant
          </button>
        </div>
      </div>
    </section>
  );
};

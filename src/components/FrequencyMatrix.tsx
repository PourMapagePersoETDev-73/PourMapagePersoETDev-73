import React, { useMemo, useState } from 'react';
import { computeNumberStats, EuroMillionsDraw, NumberStat } from '../utils/euromillionsAnalysis';

interface FrequencyMatrixProps {
  draws: EuroMillionsDraw[];
}

type ScopeFilter = 'all' | 'last100' | 'last50' | 'tuesday' | 'friday';
type SortMode = 'number' | 'frequency' | 'gap' | 'zscore' | 'markov';

export const FrequencyMatrix: React.FC<FrequencyMatrixProps> = ({ draws }) => {
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('number');
  const [selectedBall, setSelectedBall] = useState<number>(35);
  const [selectedStar, setSelectedStar] = useState<number>(2);

  const filteredDraws = useMemo(() => {
    if (scope === 'last100') return draws.slice(-100);
    if (scope === 'last50') return draws.slice(-50);
    if (scope === 'tuesday') return draws.filter((d) => d.jour.toUpperCase().includes('MARDI'));
    if (scope === 'friday') return draws.filter((d) => d.jour.toUpperCase().includes('VENDREDI'));
    return draws;
  }, [draws, scope]);

  const computed = useMemo(
    () => computeNumberStats(filteredDraws, draws),
    [filteredDraws, draws]
  );

  const sortList = (list: NumberStat[]) => {
    const copy = [...list];
    if (sortMode === 'frequency') return copy.sort((a, b) => b.frequency - a.frequency || a.number - b.number);
    if (sortMode === 'gap') return copy.sort((a, b) => b.currentGap - a.currentGap || a.number - b.number);
    if (sortMode === 'zscore') return copy.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    if (sortMode === 'markov') return copy.sort((a, b) => b.markovLift - a.markovLift);
    return copy.sort((a, b) => a.number - b.number);
  };

  const ballsSorted = useMemo(() => sortList(computed.ballStats), [computed.ballStats, sortMode]);
  const starsSorted = useMemo(() => sortList(computed.starStats), [computed.starStats, sortMode]);

  const activeBall = computed.ballStats.find((b) => b.number === selectedBall) || computed.ballStats[0];
  const activeStar = computed.starStats.find((s) => s.number === selectedStar) || computed.starStats[0];

  const maxBallFreq = Math.max(...computed.ballStats.map((b) => b.frequency), 1);
  const minBallFreq = Math.min(...computed.ballStats.map((b) => b.frequency), 0);

  const scopeLabels: Array<{ id: ScopeFilter; label: string }> = [
    { id: 'all', label: `Tous (${draws.length})` },
    { id: 'last100', label: '100 derniers' },
    { id: 'last50', label: '50 derniers' },
    { id: 'tuesday', label: 'Mardi' },
    { id: 'friday', label: 'Vendredi' },
  ];

  const sortLabels: Array<{ id: SortMode; label: string }> = [
    { id: 'number', label: 'Numéro' },
    { id: 'frequency', label: 'Fréquence ↓' },
    { id: 'gap', label: 'Écart actuel ↓' },
    { id: 'zscore', label: 'Écart-type |Z| ↓' },
    { id: 'markov', label: 'Affinité Markov ↓' },
  ];

  return (
    <div className="space-y-6">
      {/* Barre de filtres */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase text-slate-500 mr-2">Périmètre :</span>
          {scopeLabels.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScope(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                scope === item.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase text-slate-500 mr-2">Tri :</span>
          {sortLabels.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSortMode(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                sortMode === item.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Matrice 1-50 des boules + Inspecteur */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Distribution des boules (1 à 50)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {filteredDraws.length} tirages analysés · Fréquence théorique attendue :{' '}
                {computed.ballChi2.expectedPerNumber.toFixed(1)} sorties · χ² ={' '}
                {computed.ballChi2.chi2.toFixed(2)} (p = {computed.ballChi2.pValue.toFixed(3)})
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500">Cliquez un numéro pour l’inspecter</div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {ballsSorted.map((b) => {
              const ratio =
                maxBallFreq > minBallFreq
                  ? (b.frequency - minBallFreq) / (maxBallFreq - minBallFreq)
                  : 0.5;
              const isSelected = b.number === selectedBall;
              const heatBg =
                ratio >= 0.72
                  ? 'bg-blue-50 border-blue-300'
                  : ratio <= 0.25
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-white border-slate-200';

              return (
                <button
                  key={b.number}
                  type="button"
                  onClick={() => setSelectedBall(b.number)}
                  className={`p-2 rounded-md border text-left transition-colors cursor-pointer ${heatBg} ${
                    isSelected ? 'ring-2 ring-blue-700 border-blue-700' : 'hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {b.number.toString().padStart(2, '0')}
                    </span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        b.zScore >= 1.5
                          ? 'text-blue-700 font-semibold'
                          : b.zScore <= -1.5
                          ? 'text-amber-700 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {b.zScore >= 0 ? `+${b.zScore.toFixed(1)}` : b.zScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs font-mono text-slate-700 tabular-nums">
                    {b.frequency}×
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                    éc. {b.currentGap}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Panneau d'inspection boule sélectionnée */}
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-mono uppercase text-slate-500">Fiche statistique boule</div>
                <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                  Boule n°{activeBall.number.toString().padStart(2, '0')}
                </h3>
              </div>
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-700 text-white font-mono text-base font-semibold tabular-nums">
                {activeBall.number.toString().padStart(2, '0')}
              </span>
            </div>

            <dl className="divide-y divide-slate-100 text-sm mt-2">
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-600">Sorties observées / attendues</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {activeBall.frequency} / {activeBall.expected.toFixed(1)}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-600">Z-score (écart à l’uniforme)</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {activeBall.zScore >= 0 ? '+' : ''}
                  {activeBall.zScore.toFixed(2)} σ
                </dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-600">Écart actuel / moyen / max</dt>
                <dd className="font-mono text-slate-900 tabular-nums">
                  {activeBall.currentGap} / {activeBall.avgGap.toFixed(1)} / {activeBall.maxGap}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-600">Sorties 50 / 100 derniers</dt>
                <dd className="font-mono text-slate-900 tabular-nums">
                  {activeBall.recent50} / {activeBall.recent100}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-600">Affinité Markov (après dernier tirage)</dt>
                <dd
                  className={`font-mono font-medium tabular-nums ${
                    activeBall.markovLift >= 0 ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {activeBall.markovLift >= 0 ? '+' : ''}
                  {activeBall.markovLift.toFixed(1)}%
                </dd>
              </div>
            </dl>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs font-mono uppercase text-slate-500 mb-2">
                Paires les plus fréquentes avec le {activeBall.number}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {activeBall.topPartners.map((p) => (
                  <button
                    key={p.number}
                    type="button"
                    onClick={() => setSelectedBall(p.number)}
                    className="flex items-center justify-between px-2.5 py-1.5 border border-slate-200 rounded-md text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {activeBall.number} – {p.number}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums">{p.count}×</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Matrice 1-12 des étoiles + Top paires globales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Distribution des étoiles (1 à 12)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Fréquence attendue : {computed.starChi2.expectedPerNumber.toFixed(1)} sorties · χ² ={' '}
                {computed.starChi2.chi2.toFixed(2)} (p = {computed.starChi2.pValue.toFixed(3)})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {starsSorted.map((s) => {
              const isSelected = s.number === selectedStar;
              return (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => setSelectedStar(s.number)}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-mono text-xs font-semibold tabular-nums">
                      {s.number}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {s.zScore >= 0 ? `+${s.zScore.toFixed(1)}` : s.zScore.toFixed(1)}σ
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    {s.frequency}×{' '}
                    <span className="text-xs font-normal text-slate-500">({s.pct.toFixed(1)}%)</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
                    Écart : {s.currentGap} (max {s.maxGap})
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Co-occurrences les plus fréquentes
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Étoile {activeStar.number} inspectée ({activeStar.frequency} sorties, écart {activeStar.currentGap})
          </p>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono uppercase text-slate-500 mb-2">
                Top paires de boules ({filteredDraws.length} tirages)
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                {computed.topBallPairs.slice(0, 5).map((item) => (
                  <div
                    key={item.pair.join('-')}
                    className="px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {item.pair[0].toString().padStart(2, '0')} +{' '}
                      {item.pair[1].toString().padStart(2, '0')}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {item.count} fois
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase text-slate-500 mb-2">
                Top paires d’étoiles
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                {computed.topStarPairs.slice(0, 3).map((item) => (
                  <div
                    key={item.pair.join('-')}
                    className="px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono font-semibold text-amber-800 tabular-nums">
                      ★ {item.pair[0]} + ★ {item.pair[1]}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {item.count} fois
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

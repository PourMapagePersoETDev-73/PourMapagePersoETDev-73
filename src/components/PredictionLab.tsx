import React, { useMemo, useState } from 'react';
import { Copy, Check, RefreshCw, Sliders } from 'lucide-react';
import {
  DatasetAnalysis,
  generateOptimizedGrids,
  generateRank2Wheel,
  PredictionWeights,
  scoreCandidates,
} from '../utils/euromillionsAnalysis';

interface PredictionLabProps {
  analysis: DatasetAnalysis;
}

export const PredictionLab: React.FC<PredictionLabProps> = ({ analysis }) => {
  const [weights, setWeights] = useState<PredictionWeights>({
    wHot: 35,
    wGap: 35,
    wMarkov: 20,
    wAntiShare: 45,
    enforceStructure: true,
    avoidConsecutive: false,
  });

  const [mode, setMode] = useState<'simple' | 'wheel'>('simple');
  const [gridCount, setGridCount] = useState<number>(5);
  const [generationNonce, setGenerationNonce] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Paramètres du système réducteur Rang 2
  const [poolSize, setPoolSize] = useState<number>(8);
  const [starPoolSize, setStarPoolSize] = useState<number>(3);
  const [wheelFullMode, setWheelFullMode] = useState<boolean>(false);
  const [customBallSelection, setCustomBallSelection] = useState<number[] | null>(null);
  const [customStarSelection, setCustomStarSelection] = useState<number[] | null>(null);

  const scoredBalls = useMemo(
    () => scoreCandidates(analysis.ballStats, weights, false),
    [analysis.ballStats, weights]
  );

  const scoredStars = useMemo(
    () => scoreCandidates(analysis.starStats, weights, true),
    [analysis.starStats, weights]
  );

  const generatedGrids = useMemo(() => {
    // Shift slightly when user requests regeneration while staying grounded in top candidates
    const rotated =
      generationNonce === 0
        ? scoredBalls
        : scoredBalls.map((b, i) => ({
            ...b,
            compositeScore: b.compositeScore + ((i + generationNonce * 3) % 5) * 1.4,
          }));
    const sortedRotated = [...rotated].sort((a, b) => b.compositeScore - a.compositeScore);
    return generateOptimizedGrids(sortedRotated, scoredStars, weights, gridCount);
  }, [scoredBalls, scoredStars, weights, gridCount, generationNonce]);

  const activeBallPool = useMemo(() => {
    if (customBallSelection && customBallSelection.length >= 6) {
      return customBallSelection;
    }
    return scoredBalls.slice(0, poolSize).map((b) => b.number);
  }, [customBallSelection, scoredBalls, poolSize]);

  const activeStarPool = useMemo(() => {
    if (customStarSelection && customStarSelection.length >= 2) {
      return customStarSelection;
    }
    return scoredStars.slice(0, starPoolSize).map((s) => s.number);
  }, [customStarSelection, scoredStars, starPoolSize]);

  const wheelResult = useMemo(
    () => generateRank2Wheel(activeBallPool, activeStarPool, wheelFullMode),
    [activeBallPool, activeStarPool, wheelFullMode]
  );

  const applyPreset = (preset: 'balanced' | 'hot' | 'gap' | 'antishare') => {
    setGenerationNonce(0);
    if (preset === 'balanced') {
      setWeights({
        wHot: 35,
        wGap: 35,
        wMarkov: 20,
        wAntiShare: 45,
        enforceStructure: true,
        avoidConsecutive: false,
      });
    } else if (preset === 'hot') {
      setWeights({
        wHot: 80,
        wGap: 10,
        wMarkov: 30,
        wAntiShare: 20,
        enforceStructure: true,
        avoidConsecutive: false,
      });
    } else if (preset === 'gap') {
      setWeights({
        wHot: 10,
        wGap: 85,
        wMarkov: 20,
        wAntiShare: 25,
        enforceStructure: true,
        avoidConsecutive: false,
      });
    } else {
      setWeights({
        wHot: 20,
        wGap: 25,
        wMarkov: 15,
        wAntiShare: 95,
        enforceStructure: true,
        avoidConsecutive: true,
      });
    }
  };

  const toggleCustomBall = (num: number) => {
    const current = customBallSelection ?? scoredBalls.slice(0, poolSize).map((b) => b.number);
    if (current.includes(num)) {
      if (current.length <= 6) return;
      setCustomBallSelection(current.filter((x) => x !== num));
    } else {
      if (current.length >= 11) return;
      setCustomBallSelection([...current, num]);
    }
  };

  const toggleCustomStar = (num: number) => {
    const current = customStarSelection ?? scoredStars.slice(0, starPoolSize).map((s) => s.number);
    if (current.includes(num)) {
      if (current.length <= 2) return;
      setCustomStarSelection(current.filter((x) => x !== num));
    } else {
      if (current.length >= 5) return;
      setCustomStarSelection([...current, num]);
    }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Colonne gauche : Contrôles & pondérations */}
      <aside className="lg:col-span-4 space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">Pondération des signaux</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => applyPreset('balanced')}
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              Équilibré
            </button>
            <button
              type="button"
              onClick={() => applyPreset('antishare')}
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              Anti-partage (&gt;31)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hot')}
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              Tendance chaude
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gap')}
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              Rattrapage d’écart
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="wHot" className="font-medium text-slate-700">
                  Fréquence historique (Hot)
                </label>
                <span className="font-mono text-slate-900 tabular-nums">{weights.wHot}%</span>
              </div>
              <input
                id="wHot"
                type="range"
                min={0}
                max={100}
                value={weights.wHot}
                onChange={(e) => setWeights({ ...weights, wHot: Number(e.target.value) })}
                className="w-full accent-blue-700 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="wGap" className="font-medium text-slate-700">
                  Écart / Retard (Mean-Reversion)
                </label>
                <span className="font-mono text-slate-900 tabular-nums">{weights.wGap}%</span>
              </div>
              <input
                id="wGap"
                type="range"
                min={0}
                max={100}
                value={weights.wGap}
                onChange={(e) => setWeights({ ...weights, wGap: Number(e.target.value) })}
                className="w-full accent-blue-700 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="wMarkov" className="font-medium text-slate-700">
                  Affinité Markov (après {analysis.latestDraw.date})
                </label>
                <span className="font-mono text-slate-900 tabular-nums">{weights.wMarkov}%</span>
              </div>
              <input
                id="wMarkov"
                type="range"
                min={0}
                max={100}
                value={weights.wMarkov}
                onChange={(e) => setWeights({ ...weights, wMarkov: Number(e.target.value) })}
                className="w-full accent-blue-700 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="wAntiShare" className="font-medium text-slate-700">
                  Optimisation Anti-partage (&gt;31)
                </label>
                <span className="font-mono text-slate-900 tabular-nums">{weights.wAntiShare}%</span>
              </div>
              <input
                id="wAntiShare"
                type="range"
                min={0}
                max={100}
                value={weights.wAntiShare}
                onChange={(e) => setWeights({ ...weights, wAntiShare: Number(e.target.value) })}
                className="w-full accent-blue-700 cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 space-y-2.5 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={weights.enforceStructure}
                onChange={(e) => setWeights({ ...weights, enforceStructure: e.target.checked })}
                className="mt-0.5 accent-blue-700"
              />
              <span className="text-slate-700">
                Filtre structurel (Somme 95–165, parité 2/3 ou 3/2, équilibre bas/haut)
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={weights.avoidConsecutive}
                onChange={(e) => setWeights({ ...weights, avoidConsecutive: e.target.checked })}
                className="mt-0.5 accent-blue-700"
              />
              <span className="text-slate-700">
                Éviter les suites consécutives (ex : 14–15) — réduit les grilles jouées par imitation
              </span>
            </label>
          </div>
        </section>

        {/* Classement des meilleurs candidats */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Top 12 Boules & Top 5 Étoiles selon vos poids
          </h3>
          <div className="space-y-3">
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
              {scoredBalls.slice(0, 12).map((c, idx) => (
                <div key={c.number} className="px-3 py-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-slate-400 w-4 tabular-nums">{idx + 1}.</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      Boule {c.number.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-slate-500">
                      {c.frequency}× · éc.{c.currentGap}
                    </span>
                    <span className="font-semibold text-blue-700 w-10 text-right">
                      {c.compositeScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {scoredStars.slice(0, 5).map((s) => (
                <div
                  key={s.number}
                  className="border border-amber-300 bg-amber-50/50 rounded-md p-2 text-center"
                >
                  <div className="font-mono text-sm font-semibold text-amber-950 tabular-nums">
                    ★ {s.number}
                  </div>
                  <div className="font-mono text-[10px] text-amber-800 tabular-nums mt-0.5">
                    {s.compositeScore.toFixed(0)} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </aside>

      {/* Colonne droite : Grilles optimisées ou Système réducteur Rang 2 */}
      <div className="lg:col-span-8 space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('simple')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                  mode === 'simple'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Grilles simples optimisées (Rang 1 & 2)
              </button>
              <button
                type="button"
                onClick={() => setMode('wheel')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                  mode === 'wheel'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Système réducteur Rang 2 (5+1)
              </button>
            </div>

            {mode === 'simple' && (
              <div className="flex items-center gap-3">
                <select
                  aria-label="Nombre de grilles"
                  value={gridCount}
                  onChange={(e) => setGridCount(Number(e.target.value))}
                  className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 font-mono"
                >
                  <option value={3}>3 grilles (7,50 €)</option>
                  <option value={5}>5 grilles (12,50 €)</option>
                  <option value={8}>8 grilles (20,00 €)</option>
                  <option value={10}>10 grilles (25,00 €)</option>
                </select>
                <button
                  type="button"
                  onClick={() => setGenerationNonce((n) => n + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Variante
                </button>
              </div>
            )}
          </div>

          {mode === 'simple' ? (
            <div className="pt-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Ces combinaisons puisent dans vos meilleurs candidats pondérés tout en respectant la zone
                structurelle statistiquement majoritaire et l’optimisation anti-partage pour éviter de
                diviser un éventuel gain de Rang 1 ou Rang 2.
              </p>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                {generatedGrids.map((g) => {
                  const textLine = `${g.balls.join(' - ')}  |  Etoiles: ${g.stars.join(' - ')}`;
                  return (
                    <div
                      key={g.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-xs text-slate-400 w-6 tabular-nums">
                          #{g.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {g.balls.map((b) => (
                            <span
                              key={b}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-700 text-white font-mono text-xs font-semibold tabular-nums"
                            >
                              {b.toString().padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                        <span className="text-slate-300 font-mono">+</span>
                        <div className="flex items-center gap-1.5">
                          {g.stars.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-mono text-xs font-semibold tabular-nums"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-5 text-xs font-mono tabular-nums">
                        <div className="text-slate-600">
                          Σ {g.sum} · {g.evenCount}P/{5 - g.evenCount}I · {g.above31Count} &gt;31
                        </div>
                        <div
                          className={`font-medium ${
                            g.antiShareRating === 'Élevé'
                              ? 'text-emerald-700'
                              : g.antiShareRating === 'Standard'
                              ? 'text-slate-700'
                              : 'text-amber-700'
                          }`}
                        >
                          Partage : {g.antiShareRating}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(`grid-${g.id}`, textLine)}
                          className="p-1.5 border border-slate-200 rounded hover:bg-white text-slate-600 cursor-pointer"
                          title="Copier la grille"
                        >
                          {copiedId === `grid-${g.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pt-5 space-y-5">
              {/* Configuration du système réducteur */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-md p-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Taille sélection boules
                  </label>
                  <select
                    value={poolSize}
                    onChange={(e) => {
                      setPoolSize(Number(e.target.value));
                      setCustomBallSelection(null);
                    }}
                    className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white font-mono"
                  >
                    <option value={7}>7 boules</option>
                    <option value={8}>8 boules</option>
                    <option value={9}>9 boules</option>
                    <option value={10}>10 boules</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Étoiles rotatives
                  </label>
                  <select
                    value={starPoolSize}
                    onChange={(e) => {
                      setStarPoolSize(Number(e.target.value));
                      setCustomStarSelection(null);
                    }}
                    className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white font-mono"
                  >
                    <option value={2}>2 étoiles (1 paire)</option>
                    <option value={3}>3 étoiles (3 paires)</option>
                    <option value={4}>4 étoiles (6 paires)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pb-1.5">
                    <input
                      type="checkbox"
                      checked={wheelFullMode}
                      onChange={(e) => setWheelFullMode(e.target.checked)}
                      className="accent-blue-700"
                    />
                    Système complet (coûteux)
                  </label>
                </div>
              </div>

              {/* Sélection manuelle rapide des boules & étoiles du système */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">
                    Boules actives ({activeBallPool.length}) — cliquez pour personnaliser (6 à 11) :
                  </span>
                  {customBallSelection && (
                    <button
                      type="button"
                      onClick={() => setCustomBallSelection(null)}
                      className="text-xs text-blue-700 hover:underline cursor-pointer"
                    >
                      Réinitialiser au Top {poolSize}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scoredBalls.slice(0, 20).map((b) => {
                    const active = activeBallPool.includes(b.number);
                    return (
                      <button
                        key={b.number}
                        type="button"
                        onClick={() => toggleCustomBall(b.number)}
                        className={`w-8 h-8 rounded-md font-mono text-xs font-semibold border transition-colors cursor-pointer tabular-nums ${
                          active
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {b.number.toString().padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">
                    Étoiles actives ({activeStarPool.length}) — cliquez pour personnaliser (2 à 5) :
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scoredStars.map((s) => {
                    const active = activeStarPool.includes(s.number);
                    return (
                      <button
                        key={s.number}
                        type="button"
                        onClick={() => toggleCustomStar(s.number)}
                        className={`w-8 h-8 rounded-md font-mono text-xs font-semibold border transition-colors cursor-pointer tabular-nums ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        ★{s.number}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Résumé mathématique du système */}
              <div className="border border-slate-200 rounded-md p-4 bg-slate-50 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {wheelResult.reducedGridsCount} grilles générées · Coût :{' '}
                    <span className="font-mono tabular-nums">
                      {wheelResult.totalCostEur.toFixed(2).replace('.', ',')} €
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-600 tabular-nums">
                    Système complet équivalent : {wheelResult.fullCombinationsCount} grilles (
                    {(wheelResult.fullCombinationsCount * 2.5).toFixed(0)} €)
                  </div>
                </div>
                <p className="text-xs text-slate-700">{wheelResult.guaranteeLabel}</p>
                <p className="text-xs text-slate-600">{wheelResult.rank2CoverageNote}</p>
              </div>

              {/* Liste des grilles du système */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md">
                {wheelResult.grids.slice(0, 80).map((g, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50"
                  >
                    <span className="font-mono text-slate-400 w-8 tabular-nums">#{idx + 1}</span>
                    <div className="flex items-center gap-2 font-mono font-semibold text-slate-900 tabular-nums">
                      {g.balls.map((b) => (
                        <span key={b} className="px-1.5 py-0.5 bg-blue-50 text-blue-900 rounded">
                          {b.toString().padStart(2, '0')}
                        </span>
                      ))}
                      <span className="text-slate-400">+</span>
                      {g.stars.map((s) => (
                        <span key={s} className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded">
                          ★{s}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `wheel-${idx}`,
                          `${g.balls.join(' - ')} | Etoiles: ${g.stars.join(' - ')}`
                        )
                      }
                      className="text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      {copiedId === `wheel-${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
                {wheelResult.grids.length > 80 && (
                  <div className="px-4 py-2 text-xs text-slate-500 text-center">
                    Affichage limité aux 80 premières grilles sur {wheelResult.grids.length}.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

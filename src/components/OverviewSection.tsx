import React, { useMemo, useState } from 'react';
import { Check, Copy, Upload } from 'lucide-react';
import {
  buildNextDrawProposals,
  DatasetAnalysis,
  formatEur,
} from '../utils/euromillionsAnalysis';

interface OverviewSectionProps {
  analysis: DatasetAnalysis;
  onNavigate: (tab: 'overview' | 'frequencies' | 'lab' | 'backtest' | 'history') => void;
  onOpenImport: () => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  analysis,
  onNavigate,
  onOpenImport,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const proposals = useMemo(() => buildNextDrawProposals(analysis), [analysis]);

  const {
    totalDraws,
    firstDate,
    lastDate,
    latestDraw,
    ballChi2,
    starChi2,
    structure,
    payouts,
    ballStats,
    starStats,
  } = analysis;

  const topHotBall = [...ballStats].sort((a, b) => b.frequency - a.frequency)[0];
  const topDueBall = [...ballStats].sort((a, b) => b.currentGap - a.currentGap)[0];
  const topHotStar = [...starStats].sort((a, b) => b.frequency - a.frequency)[0];
  const topDueStar = [...starStats].sort((a, b) => b.currentGap - a.currentGap)[0];

  const maxSumCount = Math.max(...structure.sumBins.map((b) => b.count), 1);

  const copyGrid = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  return (
    <div className="space-y-8">
      {/* Propositions concrètes pour le prochain tirage (Rang 1 & Rang 2) */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-blue-700 font-medium">
              Prochain tirage estimé · {proposals.nextDraw.jour} {proposals.nextDraw.dateStr}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">
              Propositions de combinaisons à jouer (Rang 1 &amp; Rang 2)
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Calculées automatiquement sur vos {totalDraws} tirages ({firstDate} — {lastDate}) en
              combinant fréquence, écart actuel, affinité Markov et filtre anti-partage (&gt; 31).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Mettre à jour CSV
            </button>
            <button
              type="button"
              onClick={() => onNavigate('lab')}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-700 text-white rounded-md hover:bg-blue-800 cursor-pointer"
            >
              Personnaliser dans le Laboratoire →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
          {/* Proposition Rang 1 */}
          <div className="lg:col-span-6 border border-slate-200 rounded-md p-5 flex flex-col justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-mono uppercase text-slate-500">
                    Objectif Rang 1 (5 boules + 2 étoiles)
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                    Grille Principale Anti-Partage (2,50 €)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyGrid(
                      'r1-main',
                      `${proposals.rank1Primary.balls.join(' - ')} | Etoiles: ${proposals.rank1Primary.stars.join(' - ')}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-200 bg-white rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedKey === 'r1-main' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Copié
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copier
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 py-3">
                {proposals.rank1Primary.balls.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-700 text-white font-mono text-sm font-semibold tabular-nums"
                  >
                    {b.toString().padStart(2, '0')}
                  </span>
                ))}
                <span className="text-slate-300 font-mono px-1">+</span>
                {proposals.rank1Primary.stars.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-mono text-sm font-semibold tabular-nums"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="text-xs font-mono text-slate-700 tabular-nums mt-1">
                Somme : {proposals.rank1Primary.sum} · Parité : {proposals.rank1Primary.evenCount}P/
                {5 - proposals.rank1Primary.evenCount}I · Haut (&gt;31) :{' '}
                {proposals.rank1Primary.above31Count}/5
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {proposals.rank1Primary.rationale}
              </p>
            </div>

            {/* Variante secondaire Rang 1 */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-slate-500">Variante B : </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {proposals.rank1Alternate.balls.map((b) => b.toString().padStart(2, '0')).join(' · ')}
                  {'  +  '}
                  ★{proposals.rank1Alternate.stars.join(' · ★')}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyGrid(
                    'r1-alt',
                    `${proposals.rank1Alternate.balls.join(' - ')} | Etoiles: ${proposals.rank1Alternate.stars.join(' - ')}`
                  )
                }
                className="text-xs font-medium text-blue-700 hover:text-blue-800 self-start sm:self-auto cursor-pointer"
              >
                {copiedKey === 'r1-alt' ? 'Copié ✓' : 'Copier variante'}
              </button>
            </div>
          </div>

          {/* Proposition Pack Rang 2 */}
          <div className="lg:col-span-6 border border-blue-200 rounded-md p-5 flex flex-col justify-between bg-blue-50/25">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-mono uppercase text-blue-800">
                    Objectif Rang 2 (5 boules + 1 étoile · Pack 3 grilles)
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                    Rotation 3 Étoiles sur Base Optimale (7,50 €)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyGrid(
                      'r2-pack',
                      proposals.rank2Pack.grids
                        .map(
                          (g, i) =>
                            `Grille ${i + 1}: ${g.balls.join(' - ')} | Etoiles: ${g.stars.join(' - ')}`
                        )
                        .join('\n')
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-blue-200 bg-white rounded-md text-blue-800 hover:bg-blue-50 cursor-pointer"
                >
                  {copiedKey === 'r2-pack' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Pack copié
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copier les 3 grilles
                    </>
                  )}
                </button>
              </div>

              <div className="divide-y divide-blue-100 border border-blue-200 rounded-md bg-white my-2">
                {proposals.rank2Pack.grids.map((g, idx) => (
                  <div
                    key={idx}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-mono text-slate-400 tabular-nums">#{idx + 1}</span>
                    <div className="flex items-center gap-1.5 font-mono tabular-nums">
                      {g.balls.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-700 text-white text-[11px] font-semibold"
                        >
                          {b.toString().padStart(2, '0')}
                        </span>
                      ))}
                      <span className="text-slate-300 px-0.5">+</span>
                      {g.stars.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-slate-950 text-[11px] font-semibold"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <span className="hidden sm:inline font-mono text-[11px] text-slate-500 tabular-nums">
                      Σ {g.sum} · {g.above31Count} &gt;31
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-700 mt-3 leading-relaxed">
                {proposals.rank2Pack.coverageNote}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Synthèse exécutive & dernier tirage */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Corpus empirique · {totalDraws} tirages · {firstDate} — {lastDate}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Diagnostic statistique de l’historique
            </h2>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              L’analyse des {totalDraws} tirages montre que la machine respecte une loi uniforme
              indépendante (test du χ² non significatif). En revanche, on peut optimiser l’espérance de gain
              et la couverture du <strong>Rang 2 (5+1, 20× plus probable que le Rang 1)</strong> par filtrage
              structurel, systèmes réducteurs et évitement des numéros populaires.
            </p>
          </div>

          <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-md px-4 py-3">
            <div className="text-xs font-mono text-slate-500 mb-2">
              Dernier tirage enregistré · {latestDraw.jour} {latestDraw.date}
            </div>
            <div className="flex items-center gap-2">
              {latestDraw.balls.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-mono font-semibold tabular-nums"
                >
                  {b.toString().padStart(2, '0')}
                </span>
              ))}
              <span className="text-slate-300 font-mono px-0.5">+</span>
              {latestDraw.stars.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-slate-950 text-xs font-mono font-semibold tabular-nums"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Indicateurs clés */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Test χ² Boules (1–50)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">
                {ballChi2.chi2.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                p = {ballChi2.pValue.toFixed(3)}
              </span>
            </div>
            <div className="mt-1 text-xs text-emerald-700 font-medium">
              ● Conforme à l’aléatoire uniforme (df = 49)
            </div>
          </div>

          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Test χ² Étoiles (1–12)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">
                {starChi2.chi2.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                p = {starChi2.pValue.toFixed(3)}
              </span>
            </div>
            <div className="mt-1 text-xs text-emerald-700 font-medium">
              ● Conforme à l’aléatoire uniforme (df = 11)
            </div>
          </div>

          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Gain Médian Rang 2 (5+1)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">
                {formatEur(payouts.rank2Median)}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-600 tabular-nums">
              Moyenne : {formatEur(payouts.rank2Mean)} · 1 chance / 6 991 908
            </div>
          </div>

          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Taux de répétition (t−1 → t)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">
                {structure.repeatRatePerDraw.toFixed(3)}
              </span>
              <span className="text-xs font-mono text-slate-500">boule / tirage</span>
            </div>
            <div className="mt-1 text-xs text-slate-600 tabular-nums">
              Espérance théorique indépendante : 0.500
            </div>
          </div>
        </div>
      </section>

      {/* Comparatif Rang 1 vs Rang 2 vs Rang 3 & Signaux observés */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Architecture des probabilités : pourquoi viser le Rang 2 ?
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('lab')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              Ouvrir les systèmes réducteurs →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-mono uppercase text-slate-500">
                  <th className="py-2.5 pr-4">Rang</th>
                  <th className="py-2.5 px-4">Combinaison</th>
                  <th className="py-2.5 px-4 text-right">Probabilité</th>
                  <th className="py-2.5 px-4 text-right">Combinaisons</th>
                  <th className="py-2.5 pl-4 text-right">Gain moyen CSV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="h-10">
                  <td className="py-2 pr-4 font-semibold text-slate-900">Rang 1</td>
                  <td className="py-2 px-4 text-slate-600">5 boules + 2 étoiles</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-900">
                    1 / 139 838 160
                  </td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-600">1</td>
                  <td className="py-2 pl-4 text-right font-mono tabular-nums text-slate-900">
                    {formatEur(payouts.rank1Mean)}
                  </td>
                </tr>
                <tr className="h-10 bg-blue-50/40">
                  <td className="py-2 pr-4 font-semibold text-blue-800">Rang 2</td>
                  <td className="py-2 px-4 text-slate-800 font-medium">5 boules + 1 étoile</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums font-semibold text-blue-800">
                    1 / 6 991 908
                  </td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-blue-800">
                    20 (20×)
                  </td>
                  <td className="py-2 pl-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {formatEur(payouts.rank2Mean)}
                  </td>
                </tr>
                <tr className="h-10">
                  <td className="py-2 pr-4 font-semibold text-slate-900">Rang 3</td>
                  <td className="py-2 px-4 text-slate-600">5 boules + 0 étoile</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-900">
                    1 / 3 107 515
                  </td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-600">
                    45 (45×)
                  </td>
                  <td className="py-2 pl-4 text-right font-mono tabular-nums text-slate-900">
                    {formatEur(payouts.rank3Mean)}
                  </td>
                </tr>
                <tr className="h-10">
                  <td className="py-2 pr-4 font-medium text-slate-700">Rang 4</td>
                  <td className="py-2 px-4 text-slate-600">4 boules + 2 étoiles</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-700">
                    1 / 621 503
                  </td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-600">
                    225
                  </td>
                  <td className="py-2 pl-4 text-right font-mono tabular-nums text-slate-500">
                    ~1 300 € – 5 000 €
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
            <strong>Levier clé du Rang 2 :</strong> Sur les 66 combinaisons possibles de 2 étoiles parmi 12,
            <span className="font-mono font-medium text-slate-900"> 21 paires </span>
            contiennent au moins une des 2 étoiles gagnantes (soit <strong>31,8 %</strong> de couverture
            étoile avec une seule grille si vous trouvez les 5 boules). Avec un système rotatif sur 3 ou 4
            étoiles, la probabilité conditionnelle de capter au moins le Rang 2 atteint 45 % à 58 %.
          </div>
        </section>

        {/* Distribution des sommes (Graphique SVG) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-slate-900">
              Zone structurelle des tirages (Somme)
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              Moy. {structure.avgSum.toFixed(1)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Répartition réelle des {totalDraws} sommes de 5 boules (théorique : 127,5).
          </p>

          <div className="space-y-3">
            {structure.sumBins.map((bin) => {
              const widthPct = (bin.count / maxSumCount) * 100;
              const isCore = bin.label === '100–124' || bin.label === '125–149' || bin.label === '150–174';
              return (
                <div key={bin.label} className="grid grid-cols-12 items-center gap-2 text-xs">
                  <div className="col-span-3 font-mono text-slate-700 tabular-nums">{bin.label}</div>
                  <div className="col-span-6 h-5 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-all ${isCore ? 'bg-blue-700' : 'bg-slate-400'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="col-span-3 text-right font-mono text-slate-700 tabular-nums">
                    {bin.count} ({bin.pct.toFixed(1)}%)
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-slate-500">Parité dominante (2P/3I ou 3P/2I)</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {(
                  structure.parityDistribution[2].pct + structure.parityDistribution[3].pct
                ).toFixed(1)}
                % des tirages
              </div>
            </div>
            <div>
              <div className="text-slate-500">Tirages avec paire consécutive</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {structure.consecutiveDrawPct.toFixed(1)}% ({Math.round((structure.consecutiveDrawPct / 100) * totalDraws)})
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Synthèse des 4 méthodes d'attaque + Instantané des extrêmes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Comment « prédire l’aléatoire » de façon rationnelle ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="border border-slate-200 rounded-md p-4">
              <div className="text-xs font-mono uppercase text-slate-500 mb-1">
                01 · Diagnostic mécanique
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
                Surveiller les biais (Fréquence, Écart, Markov)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Un tirage mécanique parfait donne χ² non significatif (ici p = {ballChi2.pValue.toFixed(2)}).
                Le laboratoire permet néanmoins d’exploiter vos hypothèses (chaud, rattrapage d’écart,
                transitions t−1) et de les vérifier par backtest réel.
              </p>
            </div>

            <div className="border border-slate-200 rounded-md p-4">
              <div className="text-xs font-mono uppercase text-slate-500 mb-1">
                02 · Filtrage combinatoire
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
                Éliminer les grilles statistiquement rares
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Plus de 70 % des tirages ont une somme entre 95 et 165 et une parité 2/3 ou 3/2.
                Filtrer ces paramètres évite les combinaisons extrêmes (ex : 1-2-3-4-5) tout en
                respectant l’équipement probabiliste.
              </p>
            </div>

            <div className="border border-slate-200 rounded-md p-4">
              <div className="text-xs font-mono uppercase text-slate-500 mb-1">
                03 · Couverture Rang 2 (5+1)
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
                Systèmes réducteurs sur sélection élargie
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Plutôt que de figer 5 boules, sélectionnez un panier de 7 à 9 boules + 3 étoiles et
                générez un système réducteur (couverture 4/5 garantie) avec rotation des paires
                d’étoiles pour maximiser les chances de capter le Rang 2 ou Rang 3.
              </p>
            </div>

            <div className="border border-slate-200 rounded-md p-4">
              <div className="text-xs font-mono uppercase text-slate-500 mb-1">
                04 · Asymétrie de gain (Anti-partage)
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
                Le seul vrai avantage mathématique prouvé
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dans votre CSV, quand les 5 boules sont ≤ 31 (dates d’anniversaire), le gain moyen au
                Rang 2 chute à <strong>{formatEur(payouts.rank2CalendarOnlyMean)}</strong> contre{' '}
                <strong>{formatEur(payouts.rank2HighNumbersMean)}</strong> avec ≥ 2 boules &gt; 31.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Extrêmes actuels</h2>
              <button
                type="button"
                onClick={() => onNavigate('frequencies')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                Matrice 1–50 →
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-sm">
              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Boule la plus fréquente</div>
                  <div className="font-mono text-xs text-slate-700 tabular-nums mt-0.5">
                    {topHotBall.frequency} sorties ({topHotBall.pct.toFixed(1)}%)
                  </div>
                </div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-700 text-white font-mono text-sm font-semibold tabular-nums">
                  {topHotBall.number.toString().padStart(2, '0')}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Plus grand écart (Boule)</div>
                  <div className="font-mono text-xs text-slate-700 tabular-nums mt-0.5">
                    Absente depuis {topDueBall.currentGap} tirages
                  </div>
                </div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 text-white font-mono text-sm font-semibold tabular-nums">
                  {topDueBall.number.toString().padStart(2, '0')}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Étoile la plus fréquente</div>
                  <div className="font-mono text-xs text-slate-700 tabular-nums mt-0.5">
                    {topHotStar.frequency} sorties ({topHotStar.pct.toFixed(1)}%)
                  </div>
                </div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-500 text-slate-950 font-mono text-sm font-semibold tabular-nums">
                  {topHotStar.number}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Plus grand écart (Étoile)</div>
                  <div className="font-mono text-xs text-slate-700 tabular-nums mt-0.5">
                    Absente depuis {topDueStar.currentGap} tirages
                  </div>
                </div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 border border-amber-400 text-amber-950 font-mono text-sm font-semibold tabular-nums">
                  {topDueStar.number}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('backtest')}
            className="mt-4 w-full py-2 px-3 border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Voir les résultats du backtest Walk-Forward →
          </button>
        </section>
      </div>
    </div>
  );
};

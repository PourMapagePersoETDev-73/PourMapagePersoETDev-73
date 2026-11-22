import React from 'react';
import { DatasetAnalysis, formatEur } from '../utils/euromillionsAnalysis';

interface BacktestAndPayoutsProps {
  analysis: DatasetAnalysis;
}

export const BacktestAndPayouts: React.FC<BacktestAndPayoutsProps> = ({ analysis }) => {
  const { backtest, payouts, structure } = analysis;
  const evaluated = backtest[0]?.evaluatedDraws || 0;

  return (
    <div className="space-y-6">
      {/* Section 1 : Backtesting Walk-Forward */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="mb-5">
          <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Validation hors-échantillon · {evaluated} tirages simulés séquentiellement
          </p>
          <h2 className="text-lg font-semibold text-slate-900 mt-1">
            Backtest Walk-Forward : les stratégies passées battent-elles le hasard ?
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            À chaque tirage <span className="font-mono">t</span> (à partir du 101e tirage), chaque
            algorithme génère une grille de 5 boules + 2 étoiles en utilisant uniquement l’historique{' '}
            <span className="font-mono">0…t−1</span>, sans aucune connaissance du futur. L’espérance
            mathématique d’une grille aléatoire est de <strong>0,500 boule</strong> et{' '}
            <strong>0,333 étoile</strong> par tirage.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-mono uppercase text-slate-500">
                <th className="py-2.5 pr-4">Stratégie testée</th>
                <th className="py-2.5 px-3 text-right">Moy. boules / tirage</th>
                <th className="py-2.5 px-3 text-right">Moy. étoiles / tirage</th>
                <th className="py-2.5 px-3 text-right">≥ 2 boules</th>
                <th className="py-2.5 px-3 text-right">≥ 3 boules</th>
                <th className="py-2.5 px-3 text-right">Rangs payants (1–13)</th>
                <th className="py-2.5 pl-3 text-right">Meilleur rang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backtest.map((row) => (
                <tr
                  key={row.id}
                  className={`h-11 ${row.id === 'uniform' ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'}`}
                >
                  <td className="py-2 pr-4">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-[11px] text-slate-500">{row.description}</div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {row.avgBallsMatched.toFixed(3)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                    {row.avgStarsMatched.toFixed(3)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {row.drawsWith2PlusBalls}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {row.drawsWith3PlusBalls}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                    {row.payingRankHits} / {row.evaluatedDraws}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono tabular-nums text-blue-700 font-medium">
                    {row.bestRankLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 text-xs text-slate-700 leading-relaxed">
          <strong>Verdict empirique :</strong> Sur les {evaluated} tirages hors-échantillon, aucune
          méthode fondée sur les fréquences passées, les écarts ou les transitions de Markov ne surpasse
          significativement la référence aléatoire uniforme (~0,50 boule trouvée par grille). C’est la
          signature exacte d’un processus sans mémoire.
        </div>
      </section>

      {/* Section 2 : Preuve de l'asymétrie anti-partage sur le Rang 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Optimisation d’espérance de gain · Analyse des rapports CSV
          </p>
          <h2 className="text-lg font-semibold text-slate-900 mt-1 mb-2">
            Impact réel des dates de naissance (≤ 31) sur le gain au Rang 2
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed mb-5">
            Si la machine n’a pas de biais, les joueurs humains en ont un massif : ils jouent des jours
            et mois de naissance (1 à 31). Lorsque vous touchez les 5 boules + 1 étoile (Rang 2), le
            montant gagné dépend directement du nombre de co-gagnants européens qui partagent la cagnotte.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
              <div className="text-xs font-mono uppercase text-slate-500">
                Tirages 100 % « Calendrier » (5 boules ≤ 31)
              </div>
              <div className="mt-2 text-2xl font-mono font-semibold text-slate-900 tabular-nums">
                {formatEur(payouts.rank2CalendarOnlyMean)}
              </div>
              <div className="mt-1 text-xs text-slate-600 tabular-nums">
                Gain moyen au Rang 2 ({payouts.rank2CalendarOnlyCount} tirages observés)
              </div>
            </div>

            <div className="border border-blue-200 rounded-md p-4 bg-blue-50/40">
              <div className="text-xs font-mono uppercase text-blue-800">
                Tirages avec ≥ 2 boules &gt; 31
              </div>
              <div className="mt-2 text-2xl font-mono font-semibold text-blue-900 tabular-nums">
                {formatEur(payouts.rank2HighNumbersMean)}
              </div>
              <div className="mt-1 text-xs text-blue-800 tabular-nums">
                Gain moyen au Rang 2 ({payouts.rank2HighNumbersCount} tirages observés · +
                {Math.round(
                  ((payouts.rank2HighNumbersMean - payouts.rank2CalendarOnlyMean) /
                    Math.max(payouts.rank2CalendarOnlyMean, 1)) *
                    100
                )}
                %)
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-slate-500">Rang 2 Min observé</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {formatEur(payouts.rank2Min)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Rang 2 Médian</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {formatEur(payouts.rank2Median)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Rang 2 Max observé</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {formatEur(payouts.rank2Max)}
              </div>
            </div>
          </div>
        </section>

        {/* Distribution Parité & Bas/Haut */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Équilibre Pair / Impair &amp; Bas / Haut
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Répartition empirique sur les {analysis.totalDraws} tirages.
          </p>

          <div className="space-y-2.5">
            {structure.parityDistribution.map((p) => (
              <div key={p.label} className="grid grid-cols-12 items-center gap-2 text-xs">
                <div className="col-span-3 font-mono text-slate-700">{p.label}</div>
                <div className="col-span-6 h-4 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className={`h-full ${
                      p.label.startsWith('2P') || p.label.startsWith('3P')
                        ? 'bg-slate-800'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, p.pct * 2.5)}%` }}
                  />
                </div>
                <div className="col-span-3 text-right font-mono text-slate-700 tabular-nums">
                  {p.pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 space-y-2.5">
            <div className="text-xs font-mono uppercase text-slate-500">
              Répartition Bas (1–25) / Haut (26–50)
            </div>
            {structure.lowHighDistribution.map((lh) => (
              <div key={lh.label} className="grid grid-cols-12 items-center gap-2 text-xs">
                <div className="col-span-3 font-mono text-slate-700">{lh.label}</div>
                <div className="col-span-6 h-4 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className={`h-full ${
                      lh.label.startsWith('2B') || lh.label.startsWith('3B')
                        ? 'bg-blue-700'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, lh.pct * 2.5)}%` }}
                  />
                </div>
                <div className="col-span-3 text-right font-mono text-slate-700 tabular-nums">
                  {lh.pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

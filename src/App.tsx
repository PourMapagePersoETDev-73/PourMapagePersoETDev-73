import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Upload } from 'lucide-react';
import { auth } from './firebase';
import {
  analyzeDataset,
  buildNextDrawProposals,
  DatasetAnalysis,
  EuroMillionsDraw,
  parseEuroMillionsCsv,
} from './utils/euromillionsAnalysis';
import { OverviewSection } from './components/OverviewSection';
import { FrequencyMatrix } from './components/FrequencyMatrix';
import { PredictionLab } from './components/PredictionLab';
import { BacktestAndPayouts } from './components/BacktestAndPayouts';
import { DrawsExplorer } from './components/DrawsExplorer';
import { ImportDrawsModal } from './components/ImportDrawsModal';
import { PersonalPortal } from './components/PersonalPortal';

type ActiveTab = 'portal' | 'overview' | 'frequencies' | 'lab' | 'backtest' | 'history';

const CSV_PATH = './assets/aistudio/euromillions_202002_8b4fe599.csv';
const STORAGE_KEY = 'euroquant_custom_draws_v1';

export default function App() {
  const isEmbedMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('embed') === 'euroquant';
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('portal');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);

  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null);
  const [defaultDraws, setDefaultDraws] = useState<EuroMillionsDraw[]>([]);
  const [hasCustomData, setHasCustomData] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(CSV_PATH);
        if (!response.ok) {
          throw new Error(`Impossible de charger le fichier CSV (HTTP ${response.status})`);
        }
        const text = await response.text();
        const baseDraws = parseEuroMillionsCsv(text);
        if (baseDraws.length === 0) {
          throw new Error('Aucun tirage valide détecté dans le fichier CSV.');
        }

        let initialDraws = baseDraws;
        let isCustom = false;
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsedSaved = JSON.parse(saved) as EuroMillionsDraw[];
            if (Array.isArray(parsedSaved) && parsedSaved.length > 0) {
              initialDraws = parsedSaved;
              isCustom = true;
            }
          }
        } catch {
          // Ignore malformed localStorage cache
        }

        const computed = analyzeDataset(initialDraws);
        if (!cancelled) {
          setDefaultDraws(baseDraws);
          setHasCustomData(isCustom);
          setAnalysis(computed);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur lors de l’analyse du fichier.');
          setLoading(false);
        }
      }
    }

    loadDataset();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApplyImport = (nextDraws: EuroMillionsDraw[], isCustom: boolean) => {
    setAnalysis(analyzeDataset(nextDraws));
    setHasCustomData(isCustom);
    try {
      if (isCustom) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraws));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota issues
    }
  };

  const handleResetDefault = () => {
    if (defaultDraws.length > 0) {
      handleApplyImport(defaultDraws, false);
    }
  };

  // Mode widget iframe (?embed=euroquant) pour intégration sur une page externe GitHub
  if (isEmbedMode) {
    const proposals = analysis ? buildNextDrawProposals(analysis) : null;
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : './';

    return (
      <div className="min-h-screen bg-white text-slate-900 p-5 flex flex-col justify-between">
        {loading && (
          <div className="text-xs font-mono text-slate-500">Chargement EuroQuant…</div>
        )}
        {error && <div className="text-xs text-rose-700">{error}</div>}
        {analysis && proposals && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-mono uppercase text-blue-700">
                  EuroQuant · {proposals.nextDraw.jour} {proposals.nextDraw.dateStr}
                </div>
                <h1 className="text-base font-semibold text-slate-900">
                  Propositions prochain tirage ({analysis.totalDraws} tirages)
                </h1>
              </div>
              <a
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Ouvrir l’app complète →
              </a>
            </div>

            <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
              <div className="text-xs font-mono uppercase text-slate-500 mb-2">
                Rang 1 (5+2 Anti-Partage)
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                {proposals.rank1Primary.balls.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-semibold"
                  >
                    {b.toString().padStart(2, '0')}
                  </span>
                ))}
                <span className="text-slate-300 px-0.5">+</span>
                {proposals.rank1Primary.stars.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-slate-950 text-xs font-semibold"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="border border-blue-200 rounded-md p-4 bg-blue-50/30 space-y-2">
              <div className="text-xs font-mono uppercase text-blue-800">
                Rang 2 (Pack 3 grilles · Rotation ★{proposals.rank2Pack.rotatingStars.join(', ★')})
              </div>
              {proposals.rank2Pack.grids.map((g, idx) => (
                <div key={idx} className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                  <span className="text-slate-400 w-5">#{idx + 1}</span>
                  <span>{g.balls.map((b) => b.toString().padStart(2, '0')).join(' · ')}</span>
                  <span className="text-slate-400">+</span>
                  <span className="font-semibold text-amber-800">
                    ★{g.stars[0]} · ★{g.stars[1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isEuroQuantTab = activeTab !== 'portal';

  const euroQuantLinks: Array<{ id: ActiveTab; label: string }> = [
    { id: 'overview', label: 'Vue d’ensemble' },
    { id: 'frequencies', label: 'Fréquences' },
    { id: 'backtest', label: 'Backtest & Gains' },
    { id: 'history', label: 'Historique' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar 3 zones : Wordmark | Navigation | Actions */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('portal')}
            className="flex items-baseline gap-2.5 text-left shrink-0 cursor-pointer"
          >
            <span className="text-base font-bold tracking-tight text-slate-900 font-display">
              {isEuroQuantTab ? 'EuroQuant' : 'Mon Portail'}
            </span>
            <span className="hidden sm:inline text-xs font-mono text-slate-500">
              {isEuroQuantTab
                ? hasCustomData
                  ? 'Base mise à jour'
                  : 'Analyse EuroMillions'
                : user
                ? 'Tableau de bord perso'
                : 'Espace Applications'}
            </span>
          </button>

          <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-7">
            <button
              type="button"
              onClick={() => setActiveTab('portal')}
              className={`text-sm font-medium whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                activeTab === 'portal'
                  ? 'text-slate-900 border-blue-700'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              Mes Applications
            </button>

            {isEuroQuantTab ? (
              euroQuantLinks.map((link) => {
                const isActive = activeTab === link.id;
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => setActiveTab(link.id)}
                    className={`text-sm font-medium whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                      isActive
                        ? 'text-slate-900 border-blue-700'
                        : 'text-slate-600 border-transparent hover:text-slate-900'
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="text-sm font-medium whitespace-nowrap transition-colors py-1 border-b-2 border-transparent text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                EuroQuant
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            {isEuroQuantTab ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Importer CSV</span>
                  <span className="sm:hidden">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('lab')}
                  className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'lab'
                      ? 'bg-slate-900 text-white'
                      : 'bg-blue-700 text-white hover:bg-blue-800'
                  }`}
                >
                  Laboratoire Rang 1 &amp; 2
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 whitespace-nowrap transition-colors cursor-pointer"
              >
                Ouvrir EuroQuant →
              </button>
            )}
          </div>
        </div>

        {/* Navigation mobile secondaire */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('portal')}
            className={`text-xs font-medium whitespace-nowrap py-1 cursor-pointer ${
              activeTab === 'portal' ? 'text-blue-700 font-semibold' : 'text-slate-600'
            }`}
          >
            Mes Applications
          </button>
          {isEuroQuantTab ? (
            euroQuantLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setActiveTab(link.id)}
                className={`text-xs font-medium whitespace-nowrap py-1 cursor-pointer ${
                  activeTab === link.id ? 'text-blue-700 font-semibold' : 'text-slate-600'
                }`}
              >
                {link.label}
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="text-xs font-medium whitespace-nowrap py-1 text-slate-600 cursor-pointer"
            >
              EuroQuant
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'portal' ? (
          <PersonalPortal
            user={user}
            authReady={authReady}
            analysis={analysis}
            onOpenEuroQuant={() => setActiveTab('overview')}
          />
        ) : (
          <>
            {loading && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-lg p-6 animate-pulse">
                  <div className="h-4 w-48 bg-slate-200 rounded mb-3" />
                  <div className="h-7 w-96 max-w-full bg-slate-200 rounded mb-4" />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-slate-100">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-3 w-24 bg-slate-200 rounded" />
                        <div className="h-7 w-28 bg-slate-200 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="bg-white border border-rose-200 rounded-lg p-6 text-sm text-rose-800">
                <h2 className="font-semibold text-base mb-1">Erreur de chargement des données</h2>
                <p>{error}</p>
              </div>
            )}

            {analysis && !loading && (
              <>
                {activeTab === 'overview' && (
                  <OverviewSection
                    analysis={analysis}
                    onNavigate={(t) => setActiveTab(t)}
                    onOpenImport={() => setIsImportOpen(true)}
                  />
                )}
                {activeTab === 'frequencies' && <FrequencyMatrix draws={analysis.draws} />}
                {activeTab === 'lab' && <PredictionLab analysis={analysis} />}
                {activeTab === 'backtest' && <BacktestAndPayouts analysis={analysis} />}
                {activeTab === 'history' && (
                  <DrawsExplorer drawsDescending={analysis.drawsDescending} />
                )}
              </>
            )}
          </>
        )}
      </main>

      {analysis && (
        <ImportDrawsModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          currentDraws={analysis.draws}
          hasCustomData={hasCustomData}
          onApplyImport={handleApplyImport}
          onResetDefault={handleResetDefault}
        />
      )}

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Portail Personnel &amp; EuroQuant · {analysis?.totalDraws ?? 710} tirages FDJ analysés
          </div>
          <div className="font-mono">
            Hébergement GitHub Pages · Accès synchronisé
          </div>
        </div>
      </footer>
    </div>
  );
}

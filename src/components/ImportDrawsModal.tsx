import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus, FileSpreadsheet, RotateCcw, Upload, X } from 'lucide-react';
import {
  createManualEuroMillionsDraw,
  EuroMillionsDraw,
  getDefaultNextDrawIsoDate,
  mergeEuroMillionsDraws,
  parseEuroMillionsCsv,
} from '../utils/euromillionsAnalysis';

interface ImportDrawsModalProps {
  isOpen: boolean;
  initialMode?: 'manual' | 'csv';
  onClose: () => void;
  currentDraws: EuroMillionsDraw[];
  hasCustomData: boolean;
  onApplyImport: (nextDraws: EuroMillionsDraw[], isCustom: boolean) => void;
  onResetDefault: () => void;
}

export const ImportDrawsModal: React.FC<ImportDrawsModalProps> = ({
  isOpen,
  initialMode = 'manual',
  onClose,
  currentDraws,
  hasCustomData,
  onApplyImport,
  onResetDefault,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>(initialMode);

  // Manual single-draw state
  const [dateIso, setDateIso] = useState<string>(() => getDefaultNextDrawIsoDate(currentDraws));
  const [ballInputs, setBallInputs] = useState<string[]>(['', '', '', '', '']);
  const [starInputs, setStarInputs] = useState<string[]>(['', '']);
  const [manualError, setManualError] = useState<string | null>(null);

  // CSV state
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedIncoming, setParsedIncoming] = useState<EuroMillionsDraw[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setDateIso(getDefaultNextDrawIsoDate(currentDraws));
      setBallInputs(['', '', '', '', '']);
      setStarInputs(['', '']);
      setManualError(null);
      setParseError(null);
    }
  }, [isOpen, initialMode, currentDraws]);

  if (!isOpen) return null;

  const formattedDatePreview = dateIso
    ? `${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}/${dateIso.slice(0, 4)}`
    : '';
  const existingOnDate = formattedDatePreview
    ? currentDraws.find((d) => d.date === formattedDatePreview)
    : undefined;

  const selectedDayName = (() => {
    if (!dateIso) return '';
    const [y, m, d] = dateIso.split('-').map(Number);
    if (!y || !m || !d) return '';
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][wd] || '';
  })();

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      setManualError('Veuillez choisir une date valide.');
      return;
    }

    const balls = ballInputs.map((v) => Number.parseInt(v.trim(), 10));
    if (balls.some((b) => !Number.isInteger(b) || b < 1 || b > 50)) {
      setManualError('Les 5 boules doivent être des nombres entre 1 et 50.');
      return;
    }
    if (new Set(balls).size !== 5) {
      setManualError('Les 5 boules doivent être toutes différentes.');
      return;
    }

    const stars = starInputs.map((v) => Number.parseInt(v.trim(), 10));
    if (stars.some((s) => !Number.isInteger(s) || s < 1 || s > 12)) {
      setManualError('Les 2 étoiles doivent être des nombres entre 1 et 12.');
      return;
    }
    if (new Set(stars).size !== 2) {
      setManualError('Les 2 étoiles doivent être différentes.');
      return;
    }

    const newDraw = createManualEuroMillionsDraw(dateIso, balls, stars);
    const { merged } = mergeEuroMillionsDraws(currentDraws, [newDraw]);
    onApplyImport(merged, true);
    onClose();
  };

  const handleFile = async (file: File) => {
    try {
      setParseError(null);
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      let draws = parseEuroMillionsCsv(text);
      if (draws.length === 0) {
        text = new TextDecoder('windows-1252').decode(buffer);
        draws = parseEuroMillionsCsv(text);
      }
      if (draws.length === 0) {
        setParsedIncoming(null);
        setParseError(
          'Aucun tirage valide trouvé. Vérifiez qu’il s’agit bien d’un CSV FDJ EuroMillions (séparateur « ; » avec colonnes boule_1..5 et etoile_1..2).'
        );
        return;
      }
      setParsedIncoming(draws);
    } catch {
      setParsedIncoming(null);
      setParseError('Impossible de lire ce fichier CSV.');
    }
  };

  const previewMerge =
    parsedIncoming && importMode === 'merge'
      ? mergeEuroMillionsDraws(currentDraws, parsedIncoming)
      : null;

  const confirmCsvImport = () => {
    if (!parsedIncoming) return;
    if (importMode === 'merge') {
      const { merged } = mergeEuroMillionsDraws(currentDraws, parsedIncoming);
      onApplyImport(merged, true);
    } else {
      onApplyImport(parsedIncoming, true);
    }
    setParsedIncoming(null);
    setFileName(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-draws-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 id="import-draws-title" className="text-base font-semibold text-slate-900">
              Mettre à jour les tirages EuroMillions
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Saisissez directement le dernier résultat ou importez un export CSV FDJ complet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Onglets Saisie rapide / Import CSV */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-md text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded font-semibold transition-colors cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Saisir un tirage
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded font-semibold transition-colors cursor-pointer ${
              activeTab === 'csv'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Importer CSV FDJ
          </button>
        </div>

        {activeTab === 'manual' ? (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="draw-date" className="font-medium text-slate-700">
                  Date du tirage
                </label>
                {selectedDayName && (
                  <span className="font-mono text-[11px] text-blue-700 font-medium">
                    {selectedDayName}
                  </span>
                )}
              </div>
              <input
                id="draw-date"
                type="date"
                required
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono text-xs focus:outline-none focus:border-blue-700"
              />
              {existingOnDate && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Un tirage existe déjà le {formattedDatePreview} (
                  {existingOnDate.balls.map((b) => b.toString().padStart(2, '0')).join('-')} + ★
                  {existingOnDate.stars.join(' ★')}) — il sera remplacé.
                </p>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-slate-700 mb-1.5">
                5 Boules (1 à 50)
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ballInputs.map((val, idx) => (
                  <input
                    key={idx}
                    type="number"
                    min={1}
                    max={50}
                    inputMode="numeric"
                    required
                    placeholder={`B${idx + 1}`}
                    value={val}
                    onChange={(e) => {
                      const next = [...ballInputs];
                      next[idx] = e.target.value;
                      setBallInputs(next);
                    }}
                    className="w-full h-10 text-center font-mono text-sm font-semibold border border-blue-200 bg-blue-50/30 rounded-md focus:outline-none focus:border-blue-700"
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-700 mb-1.5">
                2 Étoiles (1 à 12)
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-[180px]">
                {starInputs.map((val, idx) => (
                  <input
                    key={idx}
                    type="number"
                    min={1}
                    max={12}
                    inputMode="numeric"
                    required
                    placeholder={`★${idx + 1}`}
                    value={val}
                    onChange={(e) => {
                      const next = [...starInputs];
                      next[idx] = e.target.value;
                      setStarInputs(next);
                    }}
                    className="w-full h-10 text-center font-mono text-sm font-semibold border border-amber-300 bg-amber-50/40 rounded-md focus:outline-none focus:border-amber-600"
                  />
                ))}
              </div>
            </div>

            {manualError && (
              <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded-md p-3 text-xs">
                {manualError}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div>
                {hasCustomData && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetDefault();
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Base d’origine
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-blue-700 text-white hover:bg-blue-800 cursor-pointer"
                >
                  {existingOnDate ? 'Mettre à jour ce tirage' : 'Ajouter et recalculer'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <>
            {/* Zone de dépôt de fichier */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-700 bg-blue-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-900">
                {fileName ? fileName : 'Glissez votre fichier .csv ici ou cliquez pour parcourir'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Format supporté : CSV FDJ (séparateur point-virgule « ; »)
              </div>
            </div>

            {/* Mode d'importation */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`p-3 rounded-md border text-left cursor-pointer ${
                  importMode === 'merge'
                    ? 'border-blue-700 bg-blue-50/40 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold">Fusionner (recommandé)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Ajoute uniquement les nouveaux tirages sans perdre l’historique actuel.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`p-3 rounded-md border text-left cursor-pointer ${
                  importMode === 'replace'
                    ? 'border-blue-700 bg-blue-50/40 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold">Remplacer l’historique</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Utilise exclusivement les tirages contenus dans le nouveau fichier.
                </div>
              </button>
            </div>

            {parseError && (
              <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded-md p-3 text-xs">
                {parseError}
              </div>
            )}

            {parsedIncoming && (
              <div className="border border-emerald-200 bg-emerald-50/60 rounded-md p-3.5 text-xs space-y-1">
                <div className="flex items-center gap-2 font-semibold text-emerald-900">
                  <FileSpreadsheet className="w-4 h-4" />
                  Fichier analysé avec succès
                </div>
                <div className="font-mono text-emerald-800 tabular-nums">
                  {parsedIncoming.length} tirages détectés ({parsedIncoming[0].date} —{' '}
                  {parsedIncoming[parsedIncoming.length - 1].date})
                </div>
                {importMode === 'merge' && previewMerge ? (
                  <div className="text-emerald-800 font-medium">
                    +{previewMerge.addedCount} nouveau(x) tirage(s) à ajouter (total après fusion :{' '}
                    {previewMerge.merged.length} tirages).
                  </div>
                ) : (
                  <div className="text-emerald-800 font-medium">
                    Remplacement complet par {parsedIncoming.length} tirages.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                {hasCustomData && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetDefault();
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Revenir au fichier d’origine
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!parsedIncoming}
                  onClick={confirmCsvImport}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
                >
                  Appliquer la mise à jour
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

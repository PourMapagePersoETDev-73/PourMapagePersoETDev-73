import React, { useRef, useState } from 'react';
import { Upload, X, RotateCcw, FileSpreadsheet } from 'lucide-react';
import {
  EuroMillionsDraw,
  mergeEuroMillionsDraws,
  parseEuroMillionsCsv,
} from '../utils/euromillionsAnalysis';

interface ImportDrawsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDraws: EuroMillionsDraw[];
  hasCustomData: boolean;
  onApplyImport: (nextDraws: EuroMillionsDraw[], isCustom: boolean) => void;
  onResetDefault: () => void;
}

export const ImportDrawsModal: React.FC<ImportDrawsModalProps> = ({
  isOpen,
  onClose,
  currentDraws,
  hasCustomData,
  onApplyImport,
  onResetDefault,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedIncoming, setParsedIncoming] = useState<EuroMillionsDraw[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    try {
      setParseError(null);
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      // Decode UTF-8 first, fallback to ISO-8859-1 (Windows-1252 common in FDJ exports)
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

  const confirmImport = () => {
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
      aria-labelledby="import-csv-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 id="import-csv-title" className="text-base font-semibold text-slate-900">
              Importer / Mettre à jour les tirages (CSV FDJ)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Importez un fichier CSV EuroMillions officiel pour actualiser toutes les statistiques
              et recalculer les combinaisons pour le prochain tirage.
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
              onClick={confirmImport}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
            >
              Appliquer la mise à jour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  Pencil,
  Pin,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from '../firebase';
import { buildNextDrawProposals, DatasetAnalysis } from '../utils/euromillionsAnalysis';

export interface TrackedApp {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  githubRepo: string;
  category: 'Outil' | 'Dashboard' | 'Jeu' | 'API' | 'Portfolio' | 'Autre';
  status: 'online' | 'dev' | 'maintenance';
  notes: string;
  isPinned: boolean;
  isInternalEuroQuant: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

interface PersonalPortalProps {
  user: User | null;
  authReady: boolean;
  analysis: DatasetAnalysis | null;
  focusedAppId: string | null;
  onFocusApp: (appId: string | null) => void;
  onAppsChange: (
    apps: Array<{ id: string; name: string; isInternalEuroQuant: boolean }>
  ) => void;
  onOpenEuroQuant: () => void;
}

const CATEGORIES: TrackedApp['category'][] = [
  'Outil',
  'Dashboard',
  'Jeu',
  'API',
  'Portfolio',
  'Autre',
];

const STATUS_LABELS: Record<TrackedApp['status'], { label: string; color: string }> = {
  online: { label: '● En ligne', color: 'text-emerald-700' },
  dev: { label: '▲ En dev', color: 'text-amber-700' },
  maintenance: { label: '◆ Maintenance', color: 'text-slate-500' },
};

function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 300);
  return `https://${trimmed}`.slice(0, 300);
}

export const PersonalPortal: React.FC<PersonalPortalProps> = ({
  user,
  authReady,
  analysis,
  focusedAppId,
  onFocusApp,
  onAppsChange,
  onOpenEuroQuant,
}) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [apps, setApps] = useState<TrackedApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const seededCheckedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TrackedApp['status']>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<TrackedApp | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formGithub, setFormGithub] = useState('');
  const [formCategory, setFormCategory] = useState<TrackedApp['category']>('Outil');
  const [formStatus, setFormStatus] = useState<TrackedApp['status']>('online');
  const [formNotes, setFormNotes] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'mosaic' | 'cards'>('mosaic');
  const [iframeVersions, setIframeVersions] = useState<Record<string, number>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showGithubGuide, setShowGithubGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const proposals = useMemo(
    () => (analysis ? buildNextDrawProposals(analysis) : null),
    [analysis]
  );

  useEffect(() => {
    onAppsChange(
      apps.map((a) => ({
        id: a.id,
        name: a.name,
        isInternalEuroQuant: a.isInternalEuroQuant,
      }))
    );
  }, [apps, onAppsChange]);

  // Sync user profile + subscribe to tracked apps once authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setApps([]);
      seededCheckedRef.current = false;
      return;
    }

    const uid = user.uid;

    async function ensureUserProfile() {
      const userRef = doc(db, 'users', uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid,
            displayName: (user?.displayName || 'Utilisateur').slice(0, 120),
            email: (user?.email || 'utilisateur@exemple.com').slice(0, 200),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    }

    ensureUserProfile().catch((err) => {
      setErrorBanner(err instanceof Error ? err.message : 'Erreur profil Firestore.');
    });

    setLoadingApps(true);
    const appsPath = `users/${uid}/apps`;
    const appsQuery = query(collection(db, appsPath), where('ownerId', '==', uid));

    const unsubApps = onSnapshot(
      appsQuery,
      async (snapshot) => {
        const list: TrackedApp[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TrackedApp, 'id'>),
        }));
        list.sort(
          (a, b) => Number(b.isPinned) - Number(a.isPinned) || a.name.localeCompare(b.name)
        );
        setApps(list);
        setLoadingApps(false);

        if (snapshot.empty && !seededCheckedRef.current) {
          seededCheckedRef.current = true;
          try {
            const defaultId = 'app_euroquant_main';
            await setDoc(doc(db, appsPath, defaultId), {
              ownerId: uid,
              name: 'EuroQuant — Analyse EuroMillions',
              url: window.location.origin,
              githubRepo: '',
              category: 'Dashboard',
              status: 'online',
              notes:
                'Analyse statistique des tirages FDJ, backtesting Walk-Forward, systèmes réducteurs Rang 2 et import CSV.',
              isPinned: true,
              isInternalEuroQuant: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `${appsPath}/app_euroquant_main`);
          }
        } else {
          seededCheckedRef.current = true;
        }
      },
      (err) => {
        setLoadingApps(false);
        try {
          handleFirestoreError(err, OperationType.LIST, appsPath);
        } catch (wrapped) {
          setErrorBanner(
            wrapped instanceof Error
              ? `Impossible de lire vos applications : ${wrapped.message}`
              : 'Impossible de lire vos applications dans Firestore.'
          );
        }
      }
    );

    return () => {
      unsubApps();
    };
  }, [authReady, user]);

  const handleLogin = async () => {
    try {
      setAuthError(null);
      setSigningIn(true);
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Connexion annulée ou bloquée par le navigateur.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const openAddModal = () => {
    setEditingApp(null);
    setFormName('');
    setFormUrl('');
    setFormGithub('');
    setFormCategory('Outil');
    setFormStatus('online');
    setFormNotes('');
    setFormPinned(true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (app: TrackedApp) => {
    setEditingApp(app);
    setFormName(app.name);
    setFormUrl(app.url);
    setFormGithub(app.githubRepo);
    setFormCategory(app.category);
    setFormStatus(app.status);
    setFormNotes(app.notes);
    setFormPinned(app.isPinned);
    setFormError(null);
    setIsFormOpen(true);
  };

  const applyAppPreset = (
    name: string,
    url: string,
    githubRepo: string,
    notes: string
  ) => {
    setFormName(name);
    setFormUrl(url);
    setFormGithub(githubRepo);
    setFormCategory('Outil');
    setFormStatus('online');
    setFormNotes(notes);
    setFormError(null);
  };

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanName = formName.trim().slice(0, 80);
    const cleanUrl = sanitizeUrl(formUrl);
    if (!cleanName || !cleanUrl) return;

    const cleanGithub = formGithub.trim() ? sanitizeUrl(formGithub) : '';
    const cleanNotes = formNotes.trim().slice(0, 500);
    const appsPath = `users/${user.uid}/apps`;

    setSavingForm(true);
    setFormError(null);

    let timeoutId: number | undefined;
    try {
      const writePromise = editingApp
        ? updateDoc(doc(db, appsPath, editingApp.id), {
            name: cleanName,
            url: cleanUrl,
            githubRepo: cleanGithub,
            category: formCategory,
            status: formStatus,
            notes: cleanNotes,
            isPinned: formPinned,
            updatedAt: serverTimestamp(),
          })
        : setDoc(
            doc(
              db,
              appsPath,
              `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
            ),
            {
              ownerId: user.uid,
              name: cleanName,
              url: cleanUrl,
              githubRepo: cleanGithub,
              category: formCategory,
              status: formStatus,
              notes: cleanNotes,
              isPinned: formPinned,
              isInternalEuroQuant: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
          );

      await writePromise;
      setIsFormOpen(false);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, appsPath);
      } catch (wrappedErr) {
        setFormError(
          wrappedErr instanceof Error
            ? `Erreur d’enregistrement : ${wrappedErr.message}`
            : 'Erreur lors de l’enregistrement dans Firestore.'
        );
      }
    } finally {
      setSavingForm(false);
    }
  };

  const reportActionError = (err: unknown, op: OperationType, path: string, label: string) => {
    try {
      handleFirestoreError(err, op, path);
    } catch (wrapped) {
      const msg = wrapped instanceof Error ? wrapped.message : String(wrapped);
      setErrorBanner(`${label} : ${msg}`);
    }
  };

  const cycleStatus = async (app: TrackedApp) => {
    if (!user) return;
    const order: TrackedApp['status'][] = ['online', 'dev', 'maintenance'];
    const nextStatus = order[(order.indexOf(app.status) + 1) % order.length];
    const path = `users/${user.uid}/apps/${app.id}`;
    try {
      await updateDoc(doc(db, path), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      reportActionError(err, OperationType.UPDATE, path, 'Impossible de changer le statut');
    }
  };

  const togglePin = async (app: TrackedApp) => {
    if (!user) return;
    const path = `users/${user.uid}/apps/${app.id}`;
    try {
      await updateDoc(doc(db, path), {
        isPinned: !app.isPinned,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      reportActionError(err, OperationType.UPDATE, path, 'Impossible d’épingler l’application');
    }
  };

  const handleDeleteApp = async (app: TrackedApp) => {
    if (!user || deletingId) return;
    const path = `users/${user.uid}/apps/${app.id}`;
    setDeletingId(app.id);
    setErrorBanner(null);
    try {
      await deleteDoc(doc(db, path));
      if (focusedAppId === app.id) onFocusApp(null);
      setConfirmDeleteId(null);
    } catch (err) {
      reportActionError(err, OperationType.DELETE, path, `Échec de suppression de « ${app.name} »`);
    } finally {
      setDeletingId(null);
    }
  };

  const reloadAppFrame = (appId: string) => {
    setIframeVersions((prev) => ({
      ...prev,
      [appId]: (prev[appId] || 0) + 1,
    }));
  };

  const openAppInCockpit = (app: TrackedApp) => {
    if (app.isInternalEuroQuant) {
      onOpenEuroQuant();
      return;
    }
    onFocusApp(app.id);
  };

  const copySnippet = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return apps.filter((app) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        app.notes.toLowerCase().includes(q) ||
        app.url.toLowerCase().includes(q)
      );
    });
  }, [apps, searchQuery, statusFilter]);

  const focusedApp = useMemo(
    () => apps.find((a) => a.id === focusedAppId) || null,
    [apps, focusedAppId]
  );

  const onlineCount = apps.filter((a) => a.status === 'online').length;
  const pinnedCount = apps.filter((a) => a.isPinned).length;
  const githubCount = apps.filter((a) => a.githubRepo.trim().length > 0).length;

  const currentOriginUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const embedIframeCode = `<iframe\n  src="${currentOriginUrl}?embed=euroquant"\n  title="EuroQuant — Propositions EuroMillions"\n  width="100%"\n  height="540"\n  style="border: 1px solid #e2e8f0; border-radius: 8px;"\n></iframe>`;

  if (!authReady) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
        Vérification de votre session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-8">
          <div className="space-y-2 pb-6 border-b border-slate-200">
            <p className="text-xs font-mono uppercase tracking-wider text-blue-700">
              Espace Personnel · Authentification requise
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Tableau de bord de vos applications web &amp; dépôts GitHub
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Connectez-vous avec votre compte Google pour retrouver toutes vos applications
              hébergées sur GitHub Pages, les afficher côte à côte en direct et basculer
              entre elles depuis un cockpit unique.
            </p>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              type="button"
              disabled={signingIn}
              onClick={handleLogin}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {signingIn ? 'Connexion en cours…' : 'Se connecter avec Google'}
            </button>

            <button
              type="button"
              onClick={onOpenEuroQuant}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              Accéder à EuroQuant sans connexion →
            </button>
          </div>

          {authError && (
            <div className="mt-4 border border-rose-200 bg-rose-50 text-rose-800 rounded-md p-3 text-xs">
              {authError}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Mode Cockpit Focus : une application agrandie plein écran dans le portail avec barre de bascule rapide
  if (focusedApp) {
    const stMeta = STATUS_LABELS[focusedApp.status];
    const frameVersion = iframeVersions[focusedApp.id] || 0;

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onFocusApp(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Tableau de bord
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 truncate">{focusedApp.name}</h2>
                <span className={`text-[11px] font-medium ${stMeta.color} shrink-0`}>{stMeta.label}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate">{focusedApp.url}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => reloadAppFrame(focusedApp.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
              title="Recharger l'application"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Recharger</span>
            </button>
            <a
              href={focusedApp.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-md text-blue-700 hover:bg-slate-50 font-medium"
            >
              Ouvrir
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={() => onFocusApp(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
              title="Revenir à la grille"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Réduire</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <iframe
            key={`${focusedApp.id}-${frameVersion}`}
            src={focusedApp.url}
            title={focusedApp.name}
            className="w-full h-[calc(100vh-14.5rem)] min-h-[600px] border-0 bg-slate-50"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {errorBanner && (
        <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-800 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* En-tête compact du portail personnel */}
      <section className="bg-white border border-slate-200 rounded-lg px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Tableau de bord personnel · {user.email}
            </p>
            <h1 className="text-xl font-semibold text-slate-900 mt-0.5">
              Bonjour {user.displayName || 'Utilisateur'} — Vos Applications Web
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowGithubGuide(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              GitHub &amp; Embed
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-700 text-white rounded-md hover:bg-blue-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une app
            </button>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* 4 Indicateurs neutres du portail */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">Applications suivies</div>
            <div className="mt-1 text-xl font-mono font-semibold text-slate-900 tabular-nums">
              {apps.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">En ligne</div>
            <div className="mt-1 text-xl font-mono font-semibold text-emerald-700 tabular-nums">
              {onlineCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">Épinglées</div>
            <div className="mt-1 text-xl font-mono font-semibold text-blue-700 tabular-nums">
              {pinnedCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">Dépôts GitHub</div>
            <div className="mt-1 text-xl font-mono font-semibold text-slate-900 tabular-nums">
              {githubCount}
            </div>
          </div>
        </div>
      </section>

      {/* Cockpit Mosaïque (par défaut) / Cartes */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Vos applications ({filteredApps.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Utilisez <span className="font-medium text-slate-700">Agrandir</span> pour afficher une appli en grand dans cette fenêtre ou basculez en vue Cartes pour gérer vos liens.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setViewMode('mosaic')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium cursor-pointer ${
                  viewMode === 'mosaic'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Tableau de bord
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cartes
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une app..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md w-44 focus:outline-none focus:border-blue-700"
              />
            </div>

            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden text-xs">
              {(['all', 'online', 'dev', 'maintenance'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 font-medium cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {st === 'all'
                    ? 'Toutes'
                    : st === 'online'
                    ? 'En ligne'
                    : st === 'dev'
                    ? 'En dev'
                    : 'Maint.'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadingApps ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Chargement de vos applications…
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="border border-slate-200 rounded-md p-8 text-center space-y-3">
            <p className="text-sm text-slate-600">
              Aucune application ne correspond à vos critères actuels.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-700 text-white rounded-md hover:bg-blue-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter ma première application
            </button>
          </div>
        ) : viewMode === 'mosaic' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredApps.map((app) => {
              const stMeta = STATUS_LABELS[app.status];
              const frameVersion = iframeVersions[app.id] || 0;
              const isConfirming = confirmDeleteId === app.id;

              return (
                <article
                  key={app.id}
                  className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white"
                >
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{app.name}</h3>
                        <button
                          type="button"
                          onClick={() => cycleStatus(app)}
                          className={`text-[11px] font-medium ${stMeta.color} shrink-0 cursor-pointer`}
                          title="Cliquer pour changer le statut"
                        >
                          {stMeta.label}
                        </button>
                      </div>
                      {!app.isInternalEuroQuant && (
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {app.url.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-xs">
                      {isConfirming ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            disabled={deletingId === app.id}
                            onClick={() => handleDeleteApp(app)}
                            className="px-2 py-1 bg-rose-600 text-white rounded font-medium disabled:opacity-50 cursor-pointer"
                          >
                            {deletingId === app.id ? 'Suppression…' : 'Confirmer'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === app.id}
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-1 border border-slate-200 bg-white text-slate-600 rounded disabled:opacity-50 cursor-pointer"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <>
                          {!app.isInternalEuroQuant && (
                            <button
                              type="button"
                              onClick={() => reloadAppFrame(app.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Recharger l'aperçu"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(app)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(app.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openAppInCockpit(app)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 cursor-pointer"
                            title="Agrandir dans le portail"
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span>Agrandir</span>
                          </button>

                          {!app.isInternalEuroQuant && (
                            <a
                              href={app.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800"
                              title="Ouvrir dans un nouvel onglet"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {app.isInternalEuroQuant ? (
                    <div className="p-5 flex flex-col justify-between h-[400px] bg-white">
                      {proposals ? (
                        <div className="space-y-3">
                          <div className="text-xs font-mono uppercase text-slate-500">
                            Prochain tirage : {proposals.nextDraw.jour} {proposals.nextDraw.dateStr} ·{' '}
                            {analysis?.totalDraws ?? 710} tirages en base
                          </div>
                          <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50">
                            <div className="text-[11px] font-mono uppercase text-slate-500 mb-2">
                              Rang 1 (5+2 Anti-partage)
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
                          <div className="border border-blue-200 rounded-md p-3.5 bg-blue-50/25">
                            <div className="text-[11px] font-mono uppercase text-blue-800 mb-2">
                              Rang 2 (Rotation ★{proposals.rank2Pack.rotatingStars.join(', ★')})
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                              {proposals.rank2Pack.baseBalls.map((b) => (
                                <span
                                  key={b}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-semibold"
                                >
                                  {b.toString().padStart(2, '0')}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">Chargement de l’analyse…</div>
                      )}

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500 line-clamp-2">{app.notes}</p>
                        <button
                          type="button"
                          onClick={onOpenEuroQuant}
                          className="px-3.5 py-2 bg-blue-700 text-white rounded-md text-xs font-semibold hover:bg-blue-800 shrink-0 cursor-pointer"
                        >
                          Ouvrir EuroQuant →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      key={`${app.id}-${frameVersion}`}
                      src={app.url}
                      title={app.name}
                      loading="lazy"
                      className="w-full h-[400px] border-0 bg-slate-50"
                    />
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => {
              const stMeta = STATUS_LABELS[app.status];
              const cleanHostPath = app.url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
              const isConfirming = confirmDeleteId === app.id;
              return (
                <article
                  key={app.id}
                  className="border border-slate-200 rounded-md p-4 flex flex-col justify-between hover:border-slate-300 transition-colors bg-slate-50/30"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-mono uppercase text-slate-500">
                          {app.category}
                          {app.isPinned ? ' · Épinglée' : ''}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{app.name}</h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => cycleStatus(app)}
                        className={`text-xs font-medium ${stMeta.color} cursor-pointer shrink-0`}
                        title="Cliquer pour changer le statut"
                      >
                        {stMeta.label}
                      </button>
                    </div>

                    {!app.isInternalEuroQuant && cleanHostPath && (
                      <div className="mt-1.5 text-[11px] font-mono text-slate-400 truncate">
                        {cleanHostPath}
                      </div>
                    )}

                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {app.notes || 'Cliquez sur le crayon pour ajouter une description.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-xs">
                      {app.isInternalEuroQuant ? (
                        <button
                          type="button"
                          onClick={onOpenEuroQuant}
                          className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                        >
                          Ouvrir
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openAppInCockpit(app)}
                            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                            title="Agrandir dans le portail"
                          >
                            <Monitor className="w-3.5 h-3.5" />
                            <span>Agrandir</span>
                          </button>
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                            title="Nouvel onglet"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Onglet</span>
                          </a>
                        </>
                      )}

                      {app.githubRepo && (
                        <a
                          href={app.githubRepo}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                          title="Voir le dépôt GitHub"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          GitHub
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isConfirming ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            disabled={deletingId === app.id}
                            onClick={() => handleDeleteApp(app)}
                            className="px-2 py-0.5 bg-rose-600 text-white rounded font-medium disabled:opacity-50 cursor-pointer"
                          >
                            {deletingId === app.id ? 'Suppression…' : 'Confirmer'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === app.id}
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 border border-slate-200 bg-white text-slate-600 rounded disabled:opacity-50 cursor-pointer"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => togglePin(app)}
                            className={`p-1 rounded cursor-pointer ${
                              app.isPinned
                                ? 'text-blue-700'
                                : 'text-slate-400 hover:text-slate-700'
                            }`}
                            title={app.isPinned ? 'Désépingler' : 'Épingler'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(app)}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(app.id)}
                            className="p-1 text-slate-400 hover:text-rose-700 cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Ajout / Modification d'application */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveApp}
            className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                {editingApp ? 'Modifier l’application' : 'Ajouter une application web'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!editingApp && (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-slate-500">
                  Pré-remplir rapidement :
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyAppPreset(
                        'Suivi Piscine',
                        'https://pourmapagepersoetdev-73.github.io/SuiviPiscine/',
                        'https://github.com/PourMapagePersoETDev-73/SuiviPiscine',
                        'Suivi des paramètres et traitement de la piscine'
                      )
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded hover:border-blue-700 hover:text-blue-700 cursor-pointer"
                  >
                    Suivi Piscine
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyAppPreset(
                        'Ski Pilot',
                        'https://pourmapagepersoetdev-73.github.io/SkiPilot/',
                        'https://github.com/PourMapagePersoETDev-73/SkiPilot',
                        'Suivi enneigement et sessions ski'
                      )
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded hover:border-blue-700 hover:text-blue-700 cursor-pointer"
                  >
                    Ski Pilot
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyAppPreset(
                        'Suivi PAC',
                        'https://pourmapagepersoetdev-73.github.io/SuiviPAC-V3/',
                        'https://github.com/PourMapagePersoETDev-73/SuiviPAC-V3',
                        'Suivi pompe à chaleur'
                      )
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded hover:border-blue-700 hover:text-blue-700 cursor-pointer"
                  >
                    Suivi PAC (SuiviPAC-V3)
                  </button>
                </div>
              </div>
            )}

            {formError && (
              <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded-md p-3 text-xs leading-relaxed">
                {formError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nom de l’application *</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex : Mon Portfolio, Tracker Crypto..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  URL de l’application (GitHub Pages, Vercel, etc.) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://pseudo.github.io/mon-app/"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono focus:outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Dépôt GitHub (optionnel)</label>
                <input
                  type="text"
                  maxLength={300}
                  value={formGithub}
                  onChange={(e) => setFormGithub(e.target.value)}
                  placeholder="https://github.com/pseudo/mon-app"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TrackedApp['category'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Statut</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TrackedApp['status'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white"
                  >
                    <option value="online">En ligne</option>
                    <option value="dev">En développement</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Stack technique, rappels de déploiement..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="accent-blue-700"
                />
                <span className="text-slate-700">Épingler en haut du tableau de bord</span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="px-4 py-2 text-xs font-semibold bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
              >
                {savingForm ? 'Enregistrement…' : editingApp ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Guide GitHub Pages & Intégration iframe */}
      {showGithubGuide && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Déploiement GitHub Pages &amp; Intégration Widget
              </h2>
              <button
                type="button"
                onClick={() => setShowGithubGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">
                  1. Publier ce portail sur GitHub Pages
                </h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <span className="font-mono">vite.config.ts</span> utilise déjà{' '}
                    <span className="font-mono">base: './'</span> et le workflow{' '}
                    <span className="font-mono">.github/workflows/deploy.yml</span> déploie
                    automatiquement sur la branche <span className="font-mono">main</span>.
                  </li>
                  <li>
                    Dans GitHub → <strong>Settings → Pages</strong>, sélectionnez Source :{' '}
                    <strong>GitHub Actions</strong>.
                  </li>
                  <li>
                    Dans <strong>Firebase Console → Authentication → Settings → Authorized domains</strong>,
                    ajoutez votre domaine <span className="font-mono">votre-pseudo.github.io</span> pour
                    autoriser la connexion Google.
                  </li>
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-slate-900">
                    2. Intégrer EuroQuant dans une autre page HTML (Mode Widget)
                  </h3>
                  <button
                    type="button"
                    onClick={() => copySnippet('iframe-code', embedIframeCode)}
                    className="inline-flex items-center gap-1 text-blue-700 font-medium cursor-pointer"
                  >
                    {copiedKey === 'iframe-code' ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copié
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copier le code
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 rounded-md p-3 font-mono text-[11px] overflow-x-auto">
                  {embedIframeCode}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowGithubGuide(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

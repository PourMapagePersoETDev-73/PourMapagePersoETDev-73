import React, { useEffect, useMemo, useState } from 'react';
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
  Bookmark,
  Check,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  LogOut,
  Monitor,
  Pencil,
  Pin,
  Plus,
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

export interface SavedGridDoc {
  id: string;
  ownerId: string;
  label: string;
  targetRank: 'Rang 1' | 'Rang 2';
  balls: number[];
  stars: number[];
  drawDate: string;
  createdAt?: Timestamp | null;
}

interface PersonalPortalProps {
  user: User | null;
  authReady: boolean;
  analysis: DatasetAnalysis | null;
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
  onOpenEuroQuant,
}) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [apps, setApps] = useState<TrackedApp[]>([]);
  const [savedGrids, setSavedGrids] = useState<SavedGridDoc[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [seededChecked, setSeededChecked] = useState(false);

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

  const [previewApp, setPreviewApp] = useState<TrackedApp | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'mosaic'>('cards');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showGithubGuide, setShowGithubGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const proposals = useMemo(
    () => (analysis ? buildNextDrawProposals(analysis) : null),
    [analysis]
  );

  // Sync user profile + subscribe to apps & savedGrids once authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setApps([]);
      setSavedGrids([]);
      setSeededChecked(false);
      return;
    }

    const uid = user.uid;
    let unsubApps = () => {};
    let unsubGrids = () => {};

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

    unsubApps = onSnapshot(
      appsQuery,
      async (snapshot) => {
        const list: TrackedApp[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TrackedApp, 'id'>),
        }));
        list.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || a.name.localeCompare(b.name));
        setApps(list);
        setLoadingApps(false);

        if (snapshot.empty && !seededChecked) {
          setSeededChecked(true);
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
          setSeededChecked(true);
        }
      },
      (err) => {
        setLoadingApps(false);
        handleFirestoreError(err, OperationType.LIST, appsPath);
      }
    );

    const gridsPath = `users/${uid}/savedGrids`;
    const gridsQuery = query(collection(db, gridsPath), where('ownerId', '==', uid));

    unsubGrids = onSnapshot(
      gridsQuery,
      (snapshot) => {
        const items: SavedGridDoc[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SavedGridDoc, 'id'>),
        }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setSavedGrids(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, gridsPath);
      }
    );

    return () => {
      unsubApps();
      unsubGrids();
    };
  }, [authReady, user, seededChecked]);

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
    setFormPinned(false);
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
    setIsFormOpen(true);
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
    try {
      if (editingApp) {
        const ref = doc(db, appsPath, editingApp.id);
        await updateDoc(ref, {
          name: cleanName,
          url: cleanUrl,
          githubRepo: cleanGithub,
          category: formCategory,
          status: formStatus,
          notes: cleanNotes,
          isPinned: formPinned,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ref = doc(db, appsPath, newId);
        await setDoc(ref, {
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
        });
      }
      setIsFormOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, appsPath);
    } finally {
      setSavingForm(false);
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
      handleFirestoreError(err, OperationType.UPDATE, path);
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
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteApp = async (app: TrackedApp) => {
    if (!user) return;
    const path = `users/${user.uid}/apps/${app.id}`;
    try {
      await deleteDoc(doc(db, path));
      if (previewApp?.id === app.id) setPreviewApp(null);
      setConfirmDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSaveProposedGrid = async (
    label: string,
    targetRank: 'Rang 1' | 'Rang 2',
    balls: number[],
    stars: number[],
    drawDate: string
  ) => {
    if (!user) return;
    const gridsPath = `users/${user.uid}/savedGrids`;
    const newId = `grid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, gridsPath, newId), {
        ownerId: user.uid,
        label: label.slice(0, 80),
        targetRank,
        balls: balls.map((n) => Math.trunc(n)),
        stars: stars.map((n) => Math.trunc(n)),
        drawDate: drawDate.slice(0, 32),
        createdAt: serverTimestamp(),
      });
      setCopiedKey(`saved-${targetRank}`);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${gridsPath}/${newId}`);
    }
  };

  const handleDeleteSavedGrid = async (gridId: string) => {
    if (!user) return;
    const path = `users/${user.uid}/savedGrids/${gridId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
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

  const onlineCount = apps.filter((a) => a.status === 'online').length;
  const githubCount = apps.filter((a) => a.githubRepo.trim().length > 0).length;

  const currentOriginUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const embedIframeCode = `<iframe\n  src="${currentOriginUrl}?embed=euroquant"\n  title="EuroQuant — Propositions EuroMillions"\n  width="100%"\n  height="540"\n  style="border: 1px solid #e2e8f0; border-radius: 8px;"\n></iframe>`;

  // État non connecté : Portail d'authentification Google
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
              Connectez-vous avec votre compte Google pour retrouver vos applications hébergées
              (GitHub Pages, Vercel, Cloud Run…), suivre leur statut, conserver vos grilles
              EuroMillions favorites et accéder à vos outils depuis n’importe quel appareil.
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
              Consulter EuroQuant sans connexion →
            </button>
          </div>

          {authError && (
            <div className="mt-4 border border-rose-200 bg-rose-50 text-rose-800 rounded-md p-3 text-xs">
              {authError}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">
            Déploiement GitHub Pages inclus
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Ce projet est déjà configuré avec <span className="font-mono">base: './'</span> dans
            Vite et un workflow <span className="font-mono">.github/workflows/deploy.yml</span>.
            Une fois hébergé sur <span className="font-mono">votre-pseudo.github.io</span>, pensez à
            ajouter votre domaine GitHub Pages dans Firebase Console → Authentication → Settings →
            Authorized domains pour que la connexion Google fonctionne également depuis GitHub.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorBanner && (
        <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-800 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* En-tête du portail personnel */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Tableau de bord personnel · Connecté en tant que {user.email}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">
              Bonjour {user.displayName || 'Utilisateur'} — Vos Applications Web
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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

        {/* 4 Indicateurs du portail */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-5">
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">Applications suivies</div>
            <div className="mt-1 text-2xl font-mono font-semibold text-slate-900 tabular-nums">
              {apps.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">Statut En ligne</div>
            <div className="mt-1 text-2xl font-mono font-semibold text-emerald-700 tabular-nums">
              {onlineCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">Dépôts GitHub liés</div>
            <div className="mt-1 text-2xl font-mono font-semibold text-slate-900 tabular-nums">
              {githubCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">Prochain EuroMillions</div>
            <div className="mt-1 text-sm font-mono font-semibold text-blue-700 tabular-nums">
              {proposals ? `${proposals.nextDraw.jour} ${proposals.nextDraw.dateStr}` : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {analysis ? `${analysis.totalDraws} tirages en base` : ''}
            </div>
          </div>
        </div>
      </section>

      {/* Liste / Catalogue des applications web personnelles — EN PREMIER */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Vos applications web ({filteredApps.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lancez vos applis dans un nouvel onglet ou ouvrez l’aperçu directement ici avec l’icône écran.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden text-xs">
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
              return (
                <article
                  key={app.id}
                  className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white"
                >
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{app.name}</h3>
                        <span className={`text-[11px] font-medium ${stMeta.color} shrink-0`}>
                          {stMeta.label}
                        </span>
                      </div>
                      {!app.isInternalEuroQuant && (
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {app.url}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      {app.isInternalEuroQuant ? (
                        <button
                          type="button"
                          onClick={onOpenEuroQuant}
                          className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 cursor-pointer"
                        >
                          Ouvrir →
                        </button>
                      ) : (
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800"
                        >
                          Ouvrir
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {app.isInternalEuroQuant && proposals ? (
                    <div className="p-4 space-y-3 flex-1 bg-white">
                      <div className="text-xs font-mono uppercase text-blue-700">
                        Prochain tirage : {proposals.nextDraw.jour} {proposals.nextDraw.dateStr}
                      </div>
                      <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
                        <div className="text-[11px] font-mono uppercase text-slate-500 mb-1.5">
                          Rang 1 (5+2 Anti-partage)
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                          {proposals.rank1Primary.balls.map((b) => (
                            <span
                              key={b}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-700 text-white text-xs font-semibold"
                            >
                              {b.toString().padStart(2, '0')}
                            </span>
                          ))}
                          <span className="text-slate-300">+</span>
                          {proposals.rank1Primary.stars.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-slate-950 text-xs font-semibold"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="border border-blue-200 rounded-md p-3 bg-blue-50/25">
                        <div className="text-[11px] font-mono uppercase text-blue-800 mb-1.5">
                          Rang 2 (Rotation ★{proposals.rank2Pack.rotatingStars.join(', ★')})
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                          {proposals.rank2Pack.baseBalls.map((b) => (
                            <span
                              key={b}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-700 text-white text-xs font-semibold"
                            >
                              {b.toString().padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      src={app.url}
                      title={app.name}
                      loading="lazy"
                      className="w-full h-[380px] border-0 bg-slate-50"
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
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800"
                          >
                            Ouvrir
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setPreviewApp(app)}
                            className={`inline-flex items-center gap-1 cursor-pointer ${
                              previewApp?.id === app.id
                                ? 'text-blue-700 font-medium'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Aperçu intégré dans le portail"
                          >
                            <Monitor className="w-3.5 h-3.5" />
                            <span>Aperçu</span>
                          </button>
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
                            onClick={() => handleDeleteApp(app)}
                            className="px-2 py-0.5 bg-rose-600 text-white rounded font-medium cursor-pointer"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 border border-slate-200 bg-white text-slate-600 rounded cursor-pointer"
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

      {/* Panneau d'aperçu intégré (iframe) si une app externe est inspectée */}
      {previewApp && (
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-slate-500">Aperçu intégré · {previewApp.url}</div>
              <h3 className="text-base font-semibold text-slate-900">{previewApp.name}</h3>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={previewApp.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                Ouvrir dans un nouvel onglet
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => setPreviewApp(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <iframe
            src={previewApp.url}
            title={previewApp.name}
            className="w-full h-[540px] border border-slate-200 rounded-md bg-slate-50"
          />
        </section>
      )}

      {/* Widget EuroQuant en direct + Grilles sauvegardées — EN SECOND PLAN */}
      {proposals && (
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-mono uppercase text-blue-700">
                Accès rapide · EuroQuant ({proposals.nextDraw.jour} {proposals.nextDraw.dateStr})
              </div>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                Propositions prêtes pour le prochain tirage
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenEuroQuant}
              className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer self-start sm:self-auto"
            >
              Ouvrir EuroQuant complet →
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
            <div className="lg:col-span-7 space-y-3">
              {/* Ligne Rang 1 */}
              <div className="border border-slate-200 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <div className="text-xs font-mono uppercase text-slate-500 mb-1.5">
                    Rang 1 (5+2 · Anti-partage)
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
                <button
                  type="button"
                  onClick={() =>
                    handleSaveProposedGrid(
                      `Rang 1 · ${proposals.nextDraw.dateStr}`,
                      'Rang 1',
                      proposals.rank1Primary.balls,
                      proposals.rank1Primary.stars,
                      proposals.nextDraw.dateStr
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer self-start sm:self-center"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {copiedKey === 'saved-Rang 1' ? 'Enregistrée ✓' : 'Sauvegarder'}
                </button>
              </div>

              {/* Ligne Rang 2 */}
              <div className="border border-blue-200 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/25">
                <div>
                  <div className="text-xs font-mono uppercase text-blue-800 mb-1.5">
                    Rang 2 (Pack 3 étoiles rotatives : ★{proposals.rank2Pack.rotatingStars.join(', ★')})
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
                    <span className="text-slate-400 px-1 text-xs">
                      + rotation ★{proposals.rank2Pack.rotatingStars.join('/')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveProposedGrid(
                      `Rang 2 Base · ${proposals.nextDraw.dateStr}`,
                      'Rang 2',
                      proposals.rank2Pack.baseBalls,
                      proposals.rank2Pack.grids[0].stars,
                      proposals.nextDraw.dateStr
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-blue-200 bg-white rounded-md text-blue-800 hover:bg-blue-50 cursor-pointer self-start sm:self-center"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {copiedKey === 'saved-Rang 2' ? 'Enregistrée ✓' : 'Sauvegarder'}
                </button>
              </div>
            </div>

            {/* Grilles sauvegardées dans Firestore */}
            <div className="lg:col-span-5 border border-slate-200 rounded-md p-4 flex flex-col">
              <div className="text-xs font-mono uppercase text-slate-500 mb-2">
                Mes grilles sauvegardées ({savedGrids.length})
              </div>
              {savedGrids.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-6 text-center">
                  Cliquez sur « Sauvegarder » pour conserver vos grilles dans votre compte.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {savedGrids.map((g) => (
                    <div key={g.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-medium text-slate-800">{g.label}</div>
                        <div className="font-mono text-slate-600 tabular-nums">
                          {g.balls.map((n) => String(n).padStart(2, '0')).join(' · ')} + ★
                          {g.stars.join(' · ★')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedGrid(g.id)}
                        className="p-1 text-slate-400 hover:text-rose-700 cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
                  1. Publier ce portail + EuroQuant sur GitHub Pages
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

export interface EuroMillionsDraw {
  id: string;
  jour: 'MARDI' | 'VENDREDI' | string;
  date: string;
  timestamp: number;
  cycleDrawNumber: number | null;
  balls: [number, number, number, number, number];
  stars: [number, number];
  sum: number;
  evenCount: number;
  lowCount: number; // <= 25
  above31Count: number; // > 31 (anti-calendar)
  hasConsecutive: boolean;
  winnersRank1Fr: number;
  winnersRank1Eu: number;
  payoutRank1: number;
  winnersRank2Fr: number;
  winnersRank2Eu: number;
  payoutRank2: number;
  winnersRank3Eu: number;
  payoutRank3: number;
  myMillion: string;
}

export interface NumberStat {
  number: number;
  frequency: number;
  expected: number;
  pct: number;
  zScore: number;
  recent50: number;
  recent100: number;
  currentGap: number;
  maxGap: number;
  avgGap: number;
  markovLift: number; // relative lift given last draw
  topPartners: Array<{ number: number; count: number }>;
}

export interface ChiSquareResult {
  chi2: number;
  df: number;
  pValue: number;
  expectedPerNumber: number;
  isConsistentWithUniform: boolean;
}

export interface StructuralDistribution {
  sumBins: Array<{ label: string; count: number; pct: number }>;
  parityDistribution: Array<{ label: string; count: number; pct: number }>;
  lowHighDistribution: Array<{ label: string; count: number; pct: number }>;
  above31Distribution: Array<{ label: string; count: number; pct: number }>;
  avgSum: number;
  avgStarSum: number;
  repeatRatePerDraw: number;
  consecutiveDrawPct: number;
}

export interface PayoutInsight {
  rank2DrawsWithWinners: number;
  rank2Mean: number;
  rank2Median: number;
  rank2Min: number;
  rank2Max: number;
  rank1DrawsWithWinners: number;
  rank1Mean: number;
  rank1Median: number;
  rank2CalendarOnlyMean: number; // all 5 balls <= 31
  rank2CalendarOnlyCount: number;
  rank2HighNumbersMean: number; // >= 2 balls > 31
  rank2HighNumbersCount: number;
  rank3Mean: number;
}

export interface BacktestStrategyResult {
  id: string;
  name: string;
  description: string;
  evaluatedDraws: number;
  avgBallsMatched: number;
  avgStarsMatched: number;
  drawsWith2PlusBalls: number;
  drawsWith3PlusBalls: number;
  drawsWith4PlusBalls: number;
  payingRankHits: number; // Rank 1..13
  bestRankLabel: string;
}

export interface DatasetAnalysis {
  draws: EuroMillionsDraw[]; // chronological oldest -> newest
  drawsDescending: EuroMillionsDraw[]; // newest -> oldest
  totalDraws: number;
  firstDate: string;
  lastDate: string;
  latestDraw: EuroMillionsDraw;
  ballStats: NumberStat[];
  starStats: NumberStat[];
  ballChi2: ChiSquareResult;
  starChi2: ChiSquareResult;
  structure: StructuralDistribution;
  payouts: PayoutInsight;
  topBallPairs: Array<{ pair: [number, number]; count: number }>;
  topStarPairs: Array<{ pair: [number, number]; count: number }>;
  backtest: BacktestStrategyResult[];
}

export interface PredictionWeights {
  wHot: number;      // 0..100
  wGap: number;      // 0..100
  wMarkov: number;   // 0..100
  wAntiShare: number;// 0..100
  enforceStructure: boolean;
  avoidConsecutive: boolean;
}

export interface ScoredCandidate {
  number: number;
  compositeScore: number;
  hotScore: number;
  gapScore: number;
  markovScore: number;
  antiShareScore: number;
  frequency: number;
  currentGap: number;
}

export interface GeneratedGrid {
  id: number;
  balls: [number, number, number, number, number];
  stars: [number, number];
  sum: number;
  evenCount: number;
  lowCount: number;
  above31Count: number;
  compositeScore: number;
  antiShareRating: 'Élevé' | 'Standard' | 'Populaire';
}

export interface WheelResult {
  ballPool: number[];
  starPool: number[];
  grids: Array<{
    balls: [number, number, number, number, number];
    stars: [number, number];
  }>;
  fullCombinationsCount: number;
  reducedGridsCount: number;
  totalCostEur: number;
  guaranteeLabel: string;
  rank2CoverageNote: string;
}

function parseFrenchFloat(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  const v = Number.parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
}

function parseFrenchInt(raw: string | undefined): number {
  if (!raw) return 0;
  const v = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(v) ? v : 0;
}

function parseFrenchDate(dateStr: string): number {
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return 0;
  const day = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10);
  const year = Number.parseInt(parts[2], 10);
  return Date.UTC(year, month - 1, day);
}

// Log-Gamma via Lanczos approximation for accurate chi-square p-values
function logGamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const zz = z - 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (zz + i);
  }
  const t = zz + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
}

// Regularized upper incomplete gamma Q(a, x) = p-value for chi2 with df = 2a, x = chi2 / 2
function upperIncompleteGamma(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    // Series representation for P(a, x), return 1 - P(a, x)
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    const p = sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    return Math.max(0, Math.min(1, 1 - p));
  }
  // Continued fraction for Q(a, x)
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.max(0, Math.min(1, h * Math.exp(-x + a * Math.log(x) - logGamma(a))));
}

export function chiSquarePValue(chi2: number, df: number): number {
  return upperIncompleteGamma(df / 2, chi2 / 2);
}

export function parseEuroMillionsCsv(csvText: string): EuroMillionsDraw[] {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(';').map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const iId = col('annee_numero_de_tirage');
  const iJour = col('jour_de_tirage');
  const iDate = col('date_de_tirage');
  const iCycle = col('numéro_de_tirage_dans_le_cycle');
  const iB = [1, 2, 3, 4, 5].map((k) => col(`boule_${k}`));
  const iE = [1, 2].map((k) => col(`etoile_${k}`));
  const iW1Fr = col('nombre_de_gagnant_au_rang1_Euro_Millions_en_france');
  const iW1Eu = col('nombre_de_gagnant_au_rang1_Euro_Millions_en_europe');
  const iR1 = col('rapport_du_rang1_Euro_Millions');
  const iW2Fr = col('nombre_de_gagnant_au_rang2_Euro_Millions_en_france');
  const iW2Eu = col('nombre_de_gagnant_au_rang2_Euro_Millions_en_europe');
  const iR2 = col('rapport_du_rang2_Euro_Millions');
  const iW3Eu = col('nombre_de_gagnant_au_rang3_Euro_Millions_en_europe');
  const iR3 = col('rapport_du_rang3_Euro_Millions');
  const iMyMillion = col('numero_My_Million');

  const parsed: EuroMillionsDraw[] = [];

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r].trim();
    if (!line) continue;
    const cells = line.split(';');

    const rawBalls = iB.map((idx) => parseFrenchInt(cells[idx])).sort((a, b) => a - b);
    const rawStars = iE.map((idx) => parseFrenchInt(cells[idx])).sort((a, b) => a - b);
    if (rawBalls.some((b) => b < 1 || b > 50) || rawStars.some((s) => s < 1 || s > 12)) {
      continue;
    }

    const balls = rawBalls as [number, number, number, number, number];
    const stars = rawStars as [number, number];
    const sum = balls.reduce((acc, x) => acc + x, 0);
    const evenCount = balls.filter((x) => x % 2 === 0).length;
    const lowCount = balls.filter((x) => x <= 25).length;
    const above31Count = balls.filter((x) => x > 31).length;
    let hasConsecutive = false;
    for (let k = 0; k < balls.length - 1; k++) {
      if (balls[k + 1] - balls[k] === 1) {
        hasConsecutive = true;
        break;
      }
    }

    const date = (cells[iDate] || '').trim();
    const cycleStr = (cells[iCycle] || '').trim();

    parsed.push({
      id: (cells[iId] || '').trim(),
      jour: (cells[iJour] || '').trim(),
      date,
      timestamp: parseFrenchDate(date),
      cycleDrawNumber: cycleStr ? parseFrenchInt(cycleStr) : null,
      balls,
      stars,
      sum,
      evenCount,
      lowCount,
      above31Count,
      hasConsecutive,
      winnersRank1Fr: parseFrenchInt(cells[iW1Fr]),
      winnersRank1Eu: parseFrenchInt(cells[iW1Eu]),
      payoutRank1: parseFrenchFloat(cells[iR1]),
      winnersRank2Fr: parseFrenchInt(cells[iW2Fr]),
      winnersRank2Eu: parseFrenchInt(cells[iW2Eu]),
      payoutRank2: parseFrenchFloat(cells[iR2]),
      winnersRank3Eu: parseFrenchInt(cells[iW3Eu]),
      payoutRank3: parseFrenchFloat(cells[iR3]),
      myMillion: (cells[iMyMillion] || '').trim(),
    });
  }

  // Chronological oldest -> newest
  parsed.sort((a, b) => a.timestamp - b.timestamp);
  return parsed;
}

export function computeNumberStats(
  draws: EuroMillionsDraw[],
  allDrawsForLatestContext?: EuroMillionsDraw[]
): {
  ballStats: NumberStat[];
  starStats: NumberStat[];
  ballChi2: ChiSquareResult;
  starChi2: ChiSquareResult;
  topBallPairs: Array<{ pair: [number, number]; count: number }>;
  topStarPairs: Array<{ pair: [number, number]; count: number }>;
} {
  const n = draws.length;
  const refDraws = allDrawsForLatestContext && allDrawsForLatestContext.length > 0 ? allDrawsForLatestContext : draws;
  const lastDraw = refDraws[refDraws.length - 1];

  const bOcc: number[][] = Array.from({ length: 51 }, () => []);
  const eOcc: number[][] = Array.from({ length: 13 }, () => []);
  const bRecent50 = new Array<number>(51).fill(0);
  const bRecent100 = new Array<number>(51).fill(0);
  const eRecent50 = new Array<number>(13).fill(0);
  const eRecent100 = new Array<number>(13).fill(0);

  const bPairs = new Map<string, number>();
  const ePairs = new Map<string, number>();

  // Markov transition counts: given ball u at draw t-1, count ball v at draw t
  const bTrans = Array.from({ length: 51 }, () => new Array<number>(51).fill(0));
  const bPrevCount = new Array<number>(51).fill(0);
  const eTrans = Array.from({ length: 13 }, () => new Array<number>(13).fill(0));
  const ePrevCount = new Array<number>(13).fill(0);

  draws.forEach((d, idx) => {
    const isR50 = idx >= n - 50;
    const isR100 = idx >= n - 100;

    for (const b of d.balls) {
      bOcc[b].push(idx);
      if (isR50) bRecent50[b]++;
      if (isR100) bRecent100[b]++;
    }
    for (const e of d.stars) {
      eOcc[e].push(idx);
      if (isR50) eRecent50[e]++;
      if (isR100) eRecent100[e]++;
    }

    for (let i = 0; i < d.balls.length; i++) {
      for (let j = i + 1; j < d.balls.length; j++) {
        const key = `${d.balls[i]}-${d.balls[j]}`;
        bPairs.set(key, (bPairs.get(key) || 0) + 1);
      }
    }
    const sKey = `${d.stars[0]}-${d.stars[1]}`;
    ePairs.set(sKey, (ePairs.get(sKey) || 0) + 1);

    if (idx > 0) {
      const prev = draws[idx - 1];
      for (const u of prev.balls) {
        bPrevCount[u]++;
        for (const v of d.balls) {
          bTrans[u][v]++;
        }
      }
      for (const u of prev.stars) {
        ePrevCount[u]++;
        for (const v of d.stars) {
          eTrans[u][v]++;
        }
      }
    }
  });

  const expB = n * (5 / 50);
  const stdB = Math.sqrt(n * 0.1 * 0.9);
  let chi2B = 0;

  const ballStats: NumberStat[] = [];
  for (let num = 1; num <= 50; num++) {
    const occ = bOcc[num];
    const freq = occ.length;
    chi2B += Math.pow(freq - expB, 2) / (expB * 0.9);

    const currentGap = occ.length > 0 ? n - 1 - occ[occ.length - 1] : n;
    let maxGap = occ.length > 0 ? occ[0] : n;
    let gapSum = occ.length > 0 ? occ[0] : n;
    for (let k = 1; k < occ.length; k++) {
      const g = occ[k] - occ[k - 1] - 1;
      if (g > maxGap) maxGap = g;
      gapSum += g;
    }
    if (currentGap > maxGap) maxGap = currentGap;
    const avgGap = occ.length > 0 ? gapSum / occ.length : n;

    // Markov lift given lastDraw.balls
    let condProbSum = 0;
    let condDrivers = 0;
    for (const u of lastDraw.balls) {
      if (bPrevCount[u] > 0) {
        condProbSum += bTrans[u][num] / bPrevCount[u];
        condDrivers++;
      }
    }
    const avgCondProb = condDrivers > 0 ? condProbSum / condDrivers : 0.1;
    const markovLift = ((avgCondProb - 0.1) / 0.1) * 100;

    const partners: Array<{ number: number; count: number }> = [];
    for (let other = 1; other <= 50; other++) {
      if (other === num) continue;
      const a = Math.min(num, other);
      const b = Math.max(num, other);
      const c = bPairs.get(`${a}-${b}`) || 0;
      if (c > 0) partners.push({ number: other, count: c });
    }
    partners.sort((x, y) => y.count - x.count);

    ballStats.push({
      number: num,
      frequency: freq,
      expected: expB,
      pct: n > 0 ? (freq / n) * 100 : 0,
      zScore: stdB > 0 ? (freq - expB) / stdB : 0,
      recent50: bRecent50[num],
      recent100: bRecent100[num],
      currentGap,
      maxGap,
      avgGap,
      markovLift,
      topPartners: partners.slice(0, 4),
    });
  }

  const expE = n * (2 / 12);
  const stdE = Math.sqrt(n * (2 / 12) * (10 / 12));
  let chi2E = 0;

  const starStats: NumberStat[] = [];
  for (let num = 1; num <= 12; num++) {
    const occ = eOcc[num];
    const freq = occ.length;
    chi2E += Math.pow(freq - expE, 2) / (expE * (10 / 12));

    const currentGap = occ.length > 0 ? n - 1 - occ[occ.length - 1] : n;
    let maxGap = occ.length > 0 ? occ[0] : n;
    let gapSum = occ.length > 0 ? occ[0] : n;
    for (let k = 1; k < occ.length; k++) {
      const g = occ[k] - occ[k - 1] - 1;
      if (g > maxGap) maxGap = g;
      gapSum += g;
    }
    if (currentGap > maxGap) maxGap = currentGap;
    const avgGap = occ.length > 0 ? gapSum / occ.length : n;

    let condProbSum = 0;
    let condDrivers = 0;
    for (const u of lastDraw.stars) {
      if (ePrevCount[u] > 0) {
        condProbSum += eTrans[u][num] / ePrevCount[u];
        condDrivers++;
      }
    }
    const baseStarProb = 2 / 12;
    const avgCondProb = condDrivers > 0 ? condProbSum / condDrivers : baseStarProb;
    const markovLift = ((avgCondProb - baseStarProb) / baseStarProb) * 100;

    const partners: Array<{ number: number; count: number }> = [];
    for (let other = 1; other <= 12; other++) {
      if (other === num) continue;
      const a = Math.min(num, other);
      const b = Math.max(num, other);
      const c = ePairs.get(`${a}-${b}`) || 0;
      if (c > 0) partners.push({ number: other, count: c });
    }
    partners.sort((x, y) => y.count - x.count);

    starStats.push({
      number: num,
      frequency: freq,
      expected: expE,
      pct: n > 0 ? (freq / n) * 100 : 0,
      zScore: stdE > 0 ? (freq - expE) / stdE : 0,
      recent50: eRecent50[num],
      recent100: eRecent100[num],
      currentGap,
      maxGap,
      avgGap,
      markovLift,
      topPartners: partners.slice(0, 4),
    });
  }

  const pValB = chiSquarePValue(chi2B, 49);
  const pValE = chiSquarePValue(chi2E, 11);

  const topBallPairs = [...bPairs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, count]) => {
      const [a, b] = k.split('-').map(Number);
      return { pair: [a, b] as [number, number], count };
    });

  const topStarPairs = [...ePairs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, count]) => {
      const [a, b] = k.split('-').map(Number);
      return { pair: [a, b] as [number, number], count };
    });

  return {
    ballStats,
    starStats,
    ballChi2: {
      chi2: chi2B,
      df: 49,
      pValue: pValB,
      expectedPerNumber: expB,
      isConsistentWithUniform: pValB >= 0.05,
    },
    starChi2: {
      chi2: chi2E,
      df: 11,
      pValue: pValE,
      expectedPerNumber: expE,
      isConsistentWithUniform: pValE >= 0.05,
    },
    topBallPairs,
    topStarPairs,
  };
}

function evaluateEuroMillionsRank(ballHits: number, starHits: number): { paying: boolean; rank: number } {
  if (ballHits === 5 && starHits === 2) return { paying: true, rank: 1 };
  if (ballHits === 5 && starHits === 1) return { paying: true, rank: 2 };
  if (ballHits === 5 && starHits === 0) return { paying: true, rank: 3 };
  if (ballHits === 4 && starHits === 2) return { paying: true, rank: 4 };
  if (ballHits === 4 && starHits === 1) return { paying: true, rank: 5 };
  if (ballHits === 3 && starHits === 2) return { paying: true, rank: 6 };
  if (ballHits === 4 && starHits === 0) return { paying: true, rank: 7 };
  if (ballHits === 2 && starHits === 2) return { paying: true, rank: 8 };
  if (ballHits === 3 && starHits === 1) return { paying: true, rank: 9 };
  if (ballHits === 3 && starHits === 0) return { paying: true, rank: 10 };
  if (ballHits === 1 && starHits === 2) return { paying: true, rank: 11 };
  if (ballHits === 2 && starHits === 1) return { paying: true, rank: 12 };
  if (ballHits === 2 && starHits === 0) return { paying: true, rank: 13 };
  return { paying: false, rank: 99 };
}

function runWalkForwardBacktest(draws: EuroMillionsDraw[]): BacktestStrategyResult[] {
  const warmup = Math.min(100, Math.floor(draws.length / 3));
  if (draws.length <= warmup + 10) return [];

  const bFreq = new Array<number>(51).fill(0);
  const eFreq = new Array<number>(13).fill(0);
  const bLastSeen = new Array<number>(51).fill(-1);
  const eLastSeen = new Array<number>(13).fill(-1);
  const bTrans = Array.from({ length: 51 }, () => new Array<number>(51).fill(0));
  const eTrans = Array.from({ length: 13 }, () => new Array<number>(13).fill(0));

  for (let t = 0; t < warmup; t++) {
    const d = draws[t];
    d.balls.forEach((b) => {
      bFreq[b]++;
      bLastSeen[b] = t;
    });
    d.stars.forEach((e) => {
      eFreq[e]++;
      eLastSeen[e] = t;
    });
    if (t > 0) {
      const prev = draws[t - 1];
      prev.balls.forEach((u) => d.balls.forEach((v) => bTrans[u][v]++));
      prev.stars.forEach((u) => d.stars.forEach((v) => eTrans[u][v]++));
    }
  }

  type Acc = {
    ballsSum: number;
    starsSum: number;
    b2Plus: number;
    b3Plus: number;
    b4Plus: number;
    paying: number;
    bestRank: number;
  };
  const makeAcc = (): Acc => ({
    ballsSum: 0,
    starsSum: 0,
    b2Plus: 0,
    b3Plus: 0,
    b4Plus: 0,
    paying: 0,
    bestRank: 99,
  });

  const accRandom = makeAcc();
  const accHot = makeAcc();
  const accGap = makeAcc();
  const accMarkov = makeAcc();
  const accComposite = makeAcc();

  // Deterministic LCG PRNG for reproducible uniform baseline
  let seed = 20200204;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const pickUniform = (max: number, count: number): number[] => {
    const pool = Array.from({ length: max }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  };

  const evaluatePick = (acc: Acc, predB: number[], predE: number[], actual: EuroMillionsDraw) => {
    const bSet = new Set(actual.balls);
    const eSet = new Set(actual.stars);
    let bh = 0;
    for (const x of predB) if (bSet.has(x)) bh++;
    let eh = 0;
    for (const x of predE) if (eSet.has(x)) eh++;

    acc.ballsSum += bh;
    acc.starsSum += eh;
    if (bh >= 2) acc.b2Plus++;
    if (bh >= 3) acc.b3Plus++;
    if (bh >= 4) acc.b4Plus++;
    const res = evaluateEuroMillionsRank(bh, eh);
    if (res.paying) {
      acc.paying++;
      if (res.rank < acc.bestRank) acc.bestRank = res.rank;
    }
  };

  const evaluated = draws.length - warmup;

  for (let t = warmup; t < draws.length; t++) {
    const prev = draws[t - 1];
    const current = draws[t];

    const ballsAll = Array.from({ length: 50 }, (_, i) => i + 1);
    const starsAll = Array.from({ length: 12 }, (_, i) => i + 1);

    // 1. Uniform random
    evaluatePick(accRandom, pickUniform(50, 5), pickUniform(12, 2), current);

    // 2. Hot (highest cumulative frequency)
    const hotB = [...ballsAll].sort((a, b) => bFreq[b] - bFreq[a] || a - b).slice(0, 5);
    const hotE = [...starsAll].sort((a, b) => eFreq[b] - eFreq[a] || a - b).slice(0, 2);
    evaluatePick(accHot, hotB, hotE, current);

    // 3. Gap / Cold (longest silence)
    const gapB = [...ballsAll].sort((a, b) => bLastSeen[a] - bLastSeen[b] || a - b).slice(0, 5);
    const gapE = [...starsAll].sort((a, b) => eLastSeen[a] - eLastSeen[b] || a - b).slice(0, 2);
    evaluatePick(accGap, gapB, gapE, current);

    // 4. Markov Lag-1
    const markovBallScore = (num: number) =>
      prev.balls.reduce((acc, u) => acc + bTrans[u][num], 0);
    const markovStarScore = (num: number) =>
      prev.stars.reduce((acc, u) => acc + eTrans[u][num], 0);

    const mkB = [...ballsAll].sort((a, b) => markovBallScore(b) - markovBallScore(a) || a - b).slice(0, 5);
    const mkE = [...starsAll].sort((a, b) => markovStarScore(b) - markovStarScore(a) || a - b).slice(0, 2);
    evaluatePick(accMarkov, mkB, mkE, current);

    // 5. Composite balanced + structural sum/parity check from top 10
    const maxBF = Math.max(...bFreq.slice(1), 1);
    const maxEF = Math.max(...eFreq.slice(1), 1);
    const maxMkB = Math.max(...ballsAll.map(markovBallScore), 1);
    const maxMkE = Math.max(...starsAll.map(markovStarScore), 1);

    const compRankedB = [...ballsAll].sort((a, b) => {
      const sa = 0.4 * (bFreq[a] / maxBF) + 0.35 * ((t - bLastSeen[a]) / 40) + 0.25 * (markovBallScore(a) / maxMkB);
      const sb = 0.4 * (bFreq[b] / maxBF) + 0.35 * ((t - bLastSeen[b]) / 40) + 0.25 * (markovBallScore(b) / maxMkB);
      return sb - sa;
    });
    // Pick 5 from top 10 satisfying balanced sum 95..160
    let compB = compRankedB.slice(0, 5);
    const top10 = compRankedB.slice(0, 10);
    outer: for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 7; j++) {
        for (let k = j + 1; k < 8; k++) {
          for (let l = k + 1; l < 9; l++) {
            for (let m = l + 1; m < 10; m++) {
              const cand = [top10[i], top10[j], top10[k], top10[l], top10[m]];
              const s = cand.reduce((p, c) => p + c, 0);
              const ev = cand.filter((x) => x % 2 === 0).length;
              if (s >= 95 && s <= 160 && (ev === 2 || ev === 3)) {
                compB = cand;
                break outer;
              }
            }
          }
        }
      }
    }
    const compE = [...starsAll]
      .sort((a, b) => {
        const sa = 0.45 * (eFreq[a] / maxEF) + 0.35 * ((t - eLastSeen[a]) / 15) + 0.2 * (markovStarScore(a) / maxMkE);
        const sb = 0.45 * (eFreq[b] / maxEF) + 0.35 * ((t - eLastSeen[b]) / 15) + 0.2 * (markovStarScore(b) / maxMkE);
        return sb - sa;
      })
      .slice(0, 2);
    evaluatePick(accComposite, compB, compE, current);

    // Update rolling state with actual draw t
    current.balls.forEach((b) => {
      bFreq[b]++;
      bLastSeen[b] = t;
    });
    current.stars.forEach((e) => {
      eFreq[e]++;
      eLastSeen[e] = t;
    });
    prev.balls.forEach((u) => current.balls.forEach((v) => bTrans[u][v]++));
    prev.stars.forEach((u) => current.stars.forEach((v) => eTrans[u][v]++));
  }

  const formatRow = (id: string, name: string, description: string, acc: Acc): BacktestStrategyResult => ({
    id,
    name,
    description,
    evaluatedDraws: evaluated,
    avgBallsMatched: acc.ballsSum / evaluated,
    avgStarsMatched: acc.starsSum / evaluated,
    drawsWith2PlusBalls: acc.b2Plus,
    drawsWith3PlusBalls: acc.b3Plus,
    drawsWith4PlusBalls: acc.b4Plus,
    payingRankHits: acc.paying,
    bestRankLabel: acc.bestRank < 99 ? `Rang ${acc.bestRank}` : 'Aucun',
  });

  return [
    formatRow(
      'uniform',
      'Aléatoire uniforme (référence)',
      'Tirage équiprobable 5/50 + 2/12 sans mémoire (espérance théorique : 0,500 boule et 0,333 étoile)',
      accRandom
    ),
    formatRow(
      'hot',
      'Fréquence chaude (Hot)',
      'Sélection des 5 boules et 2 étoiles les plus fréquentes jusqu’au tirage t−1',
      accHot
    ),
    formatRow(
      'gap',
      'Rattrapage / Écart maximal (Cold)',
      'Sélection des 5 boules et 2 étoiles absentes depuis le plus grand nombre de tirages',
      accGap
    ),
    formatRow(
      'markov',
      'Transitions Markov (Lag-1)',
      'Numéros présentant le plus fort taux de succession après les numéros du tirage t−1',
      accMarkov
    ),
    formatRow(
      'composite',
      'Score composite + Filtre structurel',
      'Combinaison pondérée (Chaud + Écart + Markov) filtrée sur somme [95–160] et parité 2/3',
      accComposite
    ),
  ];
}

export function analyzeDataset(draws: EuroMillionsDraw[]): DatasetAnalysis {
  const n = draws.length;
  const drawsDescending = [...draws].reverse();
  const latestDraw = draws[n - 1];

  const statsRes = computeNumberStats(draws, draws);

  // Structural metrics
  const sumBucketDefs = [
    { label: '< 75', test: (s: number) => s < 75 },
    { label: '75–99', test: (s: number) => s >= 75 && s <= 99 },
    { label: '100–124', test: (s: number) => s >= 100 && s <= 124 },
    { label: '125–149', test: (s: number) => s >= 125 && s <= 149 },
    { label: '150–174', test: (s: number) => s >= 150 && s <= 174 },
    { label: '≥ 175', test: (s: number) => s >= 175 },
  ];
  const sumCounts = sumBucketDefs.map((b) => ({ label: b.label, count: 0, pct: 0 }));

  const parityCounts = [0, 1, 2, 3, 4, 5].map((ev) => ({
    label: `${ev}P / ${5 - ev}I`,
    count: 0,
    pct: 0,
  }));
  const lowHighCounts = [0, 1, 2, 3, 4, 5].map((lw) => ({
    label: `${lw}B / ${5 - lw}H`,
    count: 0,
    pct: 0,
  }));
  const above31Counts = [0, 1, 2, 3, 4, 5].map((c) => ({
    label: `${c} num. >31`,
    count: 0,
    pct: 0,
  }));

  let totalSum = 0;
  let totalStarSum = 0;
  let repeatCount = 0;
  let consecutiveCount = 0;

  draws.forEach((d, idx) => {
    totalSum += d.sum;
    totalStarSum += d.stars[0] + d.stars[1];
    if (d.hasConsecutive) consecutiveCount++;

    const sbIdx = sumBucketDefs.findIndex((b) => b.test(d.sum));
    if (sbIdx >= 0) sumCounts[sbIdx].count++;

    parityCounts[d.evenCount].count++;
    lowHighCounts[d.lowCount].count++;
    above31Counts[d.above31Count].count++;

    if (idx > 0) {
      const prevSet = new Set(draws[idx - 1].balls);
      d.balls.forEach((x) => {
        if (prevSet.has(x)) repeatCount++;
      });
    }
  });

  sumCounts.forEach((x) => (x.pct = n > 0 ? (x.count / n) * 100 : 0));
  parityCounts.forEach((x) => (x.pct = n > 0 ? (x.count / n) * 100 : 0));
  lowHighCounts.forEach((x) => (x.pct = n > 0 ? (x.count / n) * 100 : 0));
  above31Counts.forEach((x) => (x.pct = n > 0 ? (x.count / n) * 100 : 0));

  // Payouts analysis (especially Rank 2 calendar bias!)
  const r2Valid = draws.filter((d) => d.payoutRank2 > 0);
  const r2Sorted = [...r2Valid].map((d) => d.payoutRank2).sort((a, b) => a - b);
  const r1Valid = draws.filter((d) => d.payoutRank1 > 0 && d.winnersRank1Eu > 0);
  const r1Sorted = [...r1Valid].map((d) => d.payoutRank1).sort((a, b) => a - b);
  const r3Valid = draws.filter((d) => d.payoutRank3 > 0);

  const r2CalendarOnly = r2Valid.filter((d) => d.above31Count === 0);
  const r2HighNums = r2Valid.filter((d) => d.above31Count >= 2);

  const mean = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const median = (sorted: number[]) =>
    sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  return {
    draws,
    drawsDescending,
    totalDraws: n,
    firstDate: draws[0]?.date || '',
    lastDate: latestDraw?.date || '',
    latestDraw,
    ballStats: statsRes.ballStats,
    starStats: statsRes.starStats,
    ballChi2: statsRes.ballChi2,
    starChi2: statsRes.starChi2,
    structure: {
      sumBins: sumCounts,
      parityDistribution: parityCounts,
      lowHighDistribution: lowHighCounts,
      above31Distribution: above31Counts,
      avgSum: n > 0 ? totalSum / n : 0,
      avgStarSum: n > 0 ? totalStarSum / n : 0,
      repeatRatePerDraw: n > 1 ? repeatCount / (n - 1) : 0,
      consecutiveDrawPct: n > 0 ? (consecutiveCount / n) * 100 : 0,
    },
    payouts: {
      rank2DrawsWithWinners: r2Valid.length,
      rank2Mean: mean(r2Valid.map((d) => d.payoutRank2)),
      rank2Median: median(r2Sorted),
      rank2Min: r2Sorted[0] || 0,
      rank2Max: r2Sorted[r2Sorted.length - 1] || 0,
      rank1DrawsWithWinners: r1Valid.length,
      rank1Mean: mean(r1Valid.map((d) => d.payoutRank1)),
      rank1Median: median(r1Sorted),
      rank2CalendarOnlyMean: mean(r2CalendarOnly.map((d) => d.payoutRank2)),
      rank2CalendarOnlyCount: r2CalendarOnly.length,
      rank2HighNumbersMean: mean(r2HighNums.map((d) => d.payoutRank2)),
      rank2HighNumbersCount: r2HighNums.length,
      rank3Mean: mean(r3Valid.map((d) => d.payoutRank3)),
    },
    topBallPairs: statsRes.topBallPairs,
    topStarPairs: statsRes.topStarPairs,
    backtest: runWalkForwardBacktest(draws),
  };
}

export function scoreCandidates(
  stats: NumberStat[],
  weights: PredictionWeights,
  isStar: boolean
): ScoredCandidate[] {
  const maxFreq = Math.max(...stats.map((s) => s.frequency), 1);
  const minFreq = Math.min(...stats.map((s) => s.frequency), 0);
  const freqSpan = Math.max(maxFreq - minFreq, 1);

  const maxGap = Math.max(...stats.map((s) => s.currentGap), 1);
  const maxLift = Math.max(...stats.map((s) => Math.abs(s.markovLift)), 1);

  const weightSum =
    weights.wHot + weights.wGap + weights.wMarkov + (isStar ? 0 : weights.wAntiShare) || 1;

  return stats
    .map((s) => {
      const hotScore = ((s.frequency - minFreq) / freqSpan) * 100;
      const gapScore = (s.currentGap / maxGap) * 100;
      const markovScore = ((s.markovLift + maxLift) / (2 * maxLift)) * 100;
      // Anti-share bonus: >31 (never dates), and avoid round multiples of 5/10 slightly
      const antiShareScore = isStar
        ? 50
        : (s.number > 31 ? 85 : s.number > 12 ? 35 : 15) + (s.number % 5 !== 0 ? 15 : 0);

      const compositeScore =
        (weights.wHot * hotScore +
          weights.wGap * gapScore +
          weights.wMarkov * markovScore +
          (isStar ? 0 : weights.wAntiShare * antiShareScore)) /
        weightSum;

      return {
        number: s.number,
        compositeScore,
        hotScore,
        gapScore,
        markovScore,
        antiShareScore,
        frequency: s.frequency,
        currentGap: s.currentGap,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);
}

export function generateOptimizedGrids(
  scoredBalls: ScoredCandidate[],
  scoredStars: ScoredCandidate[],
  weights: PredictionWeights,
  gridCount = 5
): GeneratedGrid[] {
  const topBallPool = scoredBalls.slice(0, 16);
  const topStarPool = scoredStars.slice(0, 6);

  const grids: GeneratedGrid[] = [];
  const usedSignatures = new Set<string>();

  // Deterministic variation seed derived from top scores
  let attempt = 0;
  while (grids.length < gridCount && attempt < 1500) {
    attempt++;
    // Weighted sampling without replacement from top 16 balls
    const pool = [...topBallPool];
    const pickedBalls: number[] = [];
    for (let k = 0; k < 5; k++) {
      const totalW = pool.reduce(
        (acc, c, idx) => acc + Math.pow(Math.max(c.compositeScore, 5) + (attempt % 7 === 0 ? 10 : 0), 1.4) / (idx * 0.12 + 1),
        0
      );
      // Quasi-deterministic hash step using attempt & k
      const pseudo = Math.abs(Math.sin((attempt + 1) * 9301 + k * 49297)) % 1;
      let target = pseudo * totalW;
      let chosenIdx = 0;
      for (let idx = 0; idx < pool.length; idx++) {
        const w =
          Math.pow(Math.max(pool[idx].compositeScore, 5) + (attempt % 7 === 0 ? 10 : 0), 1.4) /
          (idx * 0.12 + 1);
        target -= w;
        if (target <= 0) {
          chosenIdx = idx;
          break;
        }
      }
      pickedBalls.push(pool[chosenIdx].number);
      pool.splice(chosenIdx, 1);
    }
    pickedBalls.sort((a, b) => a - b);

    const sum = pickedBalls.reduce((a, b) => a + b, 0);
    const evenCount = pickedBalls.filter((x) => x % 2 === 0).length;
    const lowCount = pickedBalls.filter((x) => x <= 25).length;
    const above31Count = pickedBalls.filter((x) => x > 31).length;

    let hasConsec = false;
    for (let i = 0; i < 4; i++) {
      if (pickedBalls[i + 1] - pickedBalls[i] === 1) hasConsec = true;
    }

    if (weights.enforceStructure) {
      if (sum < 95 || sum > 165) continue;
      if (evenCount < 2 || evenCount > 3) continue;
      if (lowCount < 2 || lowCount > 3) continue;
    }
    if (weights.avoidConsecutive && hasConsec) continue;

    // Pick 2 stars from top 6
    const starIdx1 = attempt % Math.min(3, topStarPool.length);
    const starIdx2 = (starIdx1 + 1 + (Math.floor(attempt / 3) % (topStarPool.length - 1))) % topStarPool.length;
    const pickedStars = [topStarPool[starIdx1].number, topStarPool[starIdx2].number].sort(
      (a, b) => a - b
    ) as [number, number];

    const sig = `${pickedBalls.join('-')}|${pickedStars.join('-')}`;
    if (usedSignatures.has(sig)) continue;
    usedSignatures.add(sig);

    const ballScoreMap = new Map(scoredBalls.map((c) => [c.number, c.compositeScore]));
    const starScoreMap = new Map(scoredStars.map((c) => [c.number, c.compositeScore]));
    const avgScore =
      (pickedBalls.reduce((a, b) => a + (ballScoreMap.get(b) || 0), 0) +
        pickedStars.reduce((a, s) => a + (starScoreMap.get(s) || 0), 0)) /
      7;

    const antiShareRating: GeneratedGrid['antiShareRating'] =
      above31Count >= 2 ? 'Élevé' : above31Count === 1 ? 'Standard' : 'Populaire';

    grids.push({
      id: grids.length + 1,
      balls: pickedBalls as [number, number, number, number, number],
      stars: pickedStars,
      sum,
      evenCount,
      lowCount,
      above31Count,
      compositeScore: avgScore,
      antiShareRating,
    });
  }

  return grids;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const helper = (start: number, curr: T[]) => {
    if (curr.length === k) {
      res.push([...curr]);
      return;
    }
    for (let i = start; i <= arr.length - (k - curr.length); i++) {
      curr.push(arr[i]);
      helper(i + 1, curr);
      curr.pop();
    }
  };
  helper(0, []);
  return res;
}

// Builds a covering wheel guaranteeing 4/5 balls when 5 winning balls fall in ballPool (plus optimal star pairing)
export function generateRank2Wheel(
  ballPool: number[],
  starPool: number[],
  fullMode = false
): WheelResult {
  const sortedBalls = [...new Set(ballPool)].sort((a, b) => a - b);
  const sortedStars = [...new Set(starPool)].sort((a, b) => a - b);

  const all5Balls = combinations(sortedBalls, 5);
  const all2Stars = combinations(sortedStars, 2);
  const fullCombinationsCount = all5Balls.length * Math.max(all2Stars.length, 1);

  let selected5Balls: number[][] = [];
  if (fullMode || sortedBalls.length <= 6) {
    selected5Balls = all5Balls;
  } else {
    // Greedy Set Cover over all 4-subsets of sortedBalls so any 5 winning balls in pool hit >=4/5
    const all4Subsets = combinations(sortedBalls, 4);
    const uncovered = new Set(all4Subsets.map((s) => s.join('-')));
    const candidates = all5Balls.map((five) => ({
      five,
      covers: combinations(five, 4).map((f) => f.join('-')),
    }));

    while (uncovered.size > 0) {
      let bestIdx = 0;
      let bestGain = -1;
      for (let i = 0; i < candidates.length; i++) {
        let gain = 0;
        for (const c of candidates[i].covers) {
          if (uncovered.has(c)) gain++;
        }
        if (gain > bestGain) {
          bestGain = gain;
          bestIdx = i;
        }
      }
      if (bestGain <= 0) break;
      const chosen = candidates[bestIdx];
      selected5Balls.push(chosen.five);
      for (const c of chosen.covers) uncovered.delete(c);
    }
  }

  // Pair 5-ball lines with star pairs cleanly:
  // In fullMode: cartesian product; in reduced mode: rotate star pairs evenly so each star appears maximally
  const grids: WheelResult['grids'] = [];
  const starPairsToUse = all2Stars.length > 0 ? all2Stars : [[sortedStars[0] || 1, sortedStars[1] || 2]];

  if (fullMode) {
    for (const b of selected5Balls) {
      for (const st of starPairsToUse) {
        grids.push({
          balls: b as [number, number, number, number, number],
          stars: st as [number, number],
        });
      }
    }
  } else {
    selected5Balls.forEach((b, idx) => {
      const st = starPairsToUse[idx % starPairsToUse.length];
      grids.push({
        balls: b as [number, number, number, number, number],
        stars: st as [number, number],
      });
    });
  }

  return {
    ballPool: sortedBalls,
    starPool: sortedStars,
    grids,
    fullCombinationsCount,
    reducedGridsCount: grids.length,
    totalCostEur: grids.length * 2.5,
    guaranteeLabel:
      fullMode || sortedBalls.length <= 6
        ? 'Système complet : Rang 1 ou Rang 2 garanti si les 5 boules + 1 ou 2 étoiles sont dans la sélection'
        : `Système réducteur (couverture 4/5 garantie sur ${sortedBalls.length} boules, réduction de ${fullCombinationsCount} à ${grids.length} grilles)`,
    rank2CoverageNote:
      `Pour le Rang 2 (5+1), il suffit qu’UNE seule des 2 étoiles tirées figure parmi vos ${sortedStars.length} étoiles. La rotation des paires d’étoiles réduit drastiquement le coût tout en couvrant chaque étoile de la sélection.`,
  };
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function mergeEuroMillionsDraws(
  existing: EuroMillionsDraw[],
  incoming: EuroMillionsDraw[]
): { merged: EuroMillionsDraw[]; addedCount: number } {
  const keyOf = (d: EuroMillionsDraw) =>
    `${d.date}|${d.balls.join('-')}|${d.stars.join('-')}`;

  const map = new Map<string, EuroMillionsDraw>();
  for (const d of existing) {
    map.set(keyOf(d), d);
  }
  let addedCount = 0;
  for (const d of incoming) {
    const k = keyOf(d);
    if (!map.has(k)) {
      addedCount++;
    }
    map.set(k, d);
  }

  const merged = [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
  return { merged, addedCount };
}

export function getNextDrawLabel(latestDraw: EuroMillionsDraw): {
  jour: string;
  dateStr: string;
} {
  const isTuesday = latestDraw.jour.toUpperCase().includes('MARDI');
  const nextJour = isTuesday ? 'Vendredi' : 'Mardi';
  const offsetDays = isTuesday ? 3 : 4;
  const nextTs = latestDraw.timestamp + offsetDays * 86400000;
  const dt = new Date(nextTs);
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return { jour: nextJour, dateStr: `${dd}/${mm}/${yyyy}` };
}

export interface NextDrawProposalGrid {
  balls: [number, number, number, number, number];
  stars: [number, number];
  sum: number;
  evenCount: number;
  lowCount: number;
  above31Count: number;
  rationale: string;
}

export interface NextDrawProposals {
  nextDraw: { jour: string; dateStr: string };
  rank1Primary: NextDrawProposalGrid;
  rank1Alternate: NextDrawProposalGrid;
  rank2Pack: {
    baseBalls: [number, number, number, number, number];
    rotatingStars: [number, number, number];
    grids: Array<{
      balls: [number, number, number, number, number];
      stars: [number, number];
      sum: number;
      above31Count: number;
    }>;
    costEur: number;
    coverageNote: string;
  };
}

function findBestBalancedCombinations(
  scoredBalls: ScoredCandidate[],
  avoidConsecutive: boolean,
  minSum: number,
  maxSum: number,
  minAbove31: number
): number[][] {
  const topLow = scoredBalls.filter((c) => c.number <= 25).slice(0, 8);
  const topMid = scoredBalls.filter((c) => c.number > 25 && c.number <= 31).slice(0, 4);
  const topHigh = scoredBalls.filter((c) => c.number > 31).slice(0, 10);

  const poolMap = new Map<number, ScoredCandidate>();
  [...topLow, ...topMid, ...topHigh].forEach((c) => poolMap.set(c.number, c));
  const pool = [...poolMap.values()].sort((a, b) => b.compositeScore - a.compositeScore);

  const valid: Array<{ balls: number[]; score: number }> = [];
  const scoreMap = new Map(scoredBalls.map((c) => [c.number, c.compositeScore]));

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        for (let l = k + 1; l < pool.length; l++) {
          for (let m = l + 1; m < pool.length; m++) {
            const cand = [
              pool[i].number,
              pool[j].number,
              pool[k].number,
              pool[l].number,
              pool[m].number,
            ].sort((a, b) => a - b);

            const sum = cand.reduce((a, b) => a + b, 0);
            if (sum < minSum || sum > maxSum) continue;

            const ev = cand.filter((x) => x % 2 === 0).length;
            if (ev !== 2 && ev !== 3) continue;

            const lw = cand.filter((x) => x <= 25).length;
            if (lw !== 2 && lw !== 3) continue;

            const a31 = cand.filter((x) => x > 31).length;
            if (a31 < minAbove31) continue;

            if (avoidConsecutive) {
              let hasConsec = false;
              for (let z = 0; z < 4; z++) {
                if (cand[z + 1] - cand[z] === 1) {
                  hasConsec = true;
                  break;
                }
              }
              if (hasConsec) continue;
            }

            const totalScore = cand.reduce((acc, n) => acc + (scoreMap.get(n) || 0), 0);
            valid.push({ balls: cand, score: totalScore });
          }
        }
      }
    }
  }

  valid.sort((a, b) => b.score - a.score);
  if (valid.length === 0) {
    return [scoredBalls.slice(0, 5).map((x) => x.number).sort((a, b) => a - b)];
  }
  const best = valid[0].balls;
  const distinctAlt =
    valid.find((v) => {
      const overlap = v.balls.filter((x) => best.includes(x)).length;
      return overlap <= 3;
    })?.balls || valid[Math.min(1, valid.length - 1)].balls;

  return [best, distinctAlt];
}

export function buildNextDrawProposals(analysis: DatasetAnalysis): NextDrawProposals {
  const nextDraw = getNextDrawLabel(analysis.latestDraw);

  // Rank 1 scoring: balanced Hot + Gap + Markov + Anti-Share (>31) to maximize unshared payout
  const r1Weights: PredictionWeights = {
    wHot: 35,
    wGap: 35,
    wMarkov: 20,
    wAntiShare: 50,
    enforceStructure: true,
    avoidConsecutive: true,
  };
  const r1ScoredBalls = scoreCandidates(analysis.ballStats, r1Weights, false);
  const r1ScoredStars = scoreCandidates(analysis.starStats, r1Weights, true);

  const [bestR1, altR1] = findBestBalancedCombinations(r1ScoredBalls, true, 105, 155, 2);

  const topStarsR1: [number, number] = [r1ScoredStars[0].number, r1ScoredStars[1].number].sort(
    (a, b) => a - b
  ) as [number, number];
  const altStarsR1: [number, number] = [r1ScoredStars[0].number, r1ScoredStars[2].number].sort(
    (a, b) => a - b
  ) as [number, number];

  const makeGridInfo = (
    balls: number[],
    stars: [number, number],
    rationale: string
  ): NextDrawProposalGrid => ({
    balls: balls as [number, number, number, number, number],
    stars,
    sum: balls.reduce((a, b) => a + b, 0),
    evenCount: balls.filter((x) => x % 2 === 0).length,
    lowCount: balls.filter((x) => x <= 25).length,
    above31Count: balls.filter((x) => x > 31).length,
    rationale,
  });

  // Rank 2 Pack: focus on balanced Hot + Gap + Markov + Anti-Share with 3 rotating stars (3 grids = 7.50 €)
  const r2Weights: PredictionWeights = {
    wHot: 40,
    wGap: 40,
    wMarkov: 20,
    wAntiShare: 35,
    enforceStructure: true,
    avoidConsecutive: false,
  };
  const r2ScoredBalls = scoreCandidates(analysis.ballStats, r2Weights, false);
  const r2ScoredStars = scoreCandidates(analysis.starStats, r2Weights, true);

  const [bestR2] = findBestBalancedCombinations(r2ScoredBalls, false, 100, 158, 2);

  const r2Stars3 = [r2ScoredStars[0].number, r2ScoredStars[1].number, r2ScoredStars[2].number].sort(
    (a, b) => a - b
  ) as [number, number, number];
  const starPairs3: Array<[number, number]> = [
    [r2Stars3[0], r2Stars3[1]],
    [r2Stars3[0], r2Stars3[2]],
    [r2Stars3[1], r2Stars3[2]],
  ];

  const r2Sum = bestR2.reduce((a, b) => a + b, 0);
  const r2Above31 = bestR2.filter((x) => x > 31).length;

  return {
    nextDraw,
    rank1Primary: makeGridInfo(
      bestR1,
      topStarsR1,
      'Équilibre structurel (somme 105–155, 2B/3H ou 3B/2H, parité 2/3) + anti-partage (≥ 2 boules > 31) et zéro suite consécutive.'
    ),
    rank1Alternate: makeGridInfo(
      altR1,
      altStarsR1,
      'Variante complémentaire renouvelant au moins 2 boules et la 2e étoile tout en conservant les contraintes structurelles.'
    ),
    rank2Pack: {
      baseBalls: bestR2 as [number, number, number, number, number],
      rotatingStars: r2Stars3,
      grids: starPairs3.map((st) => ({
        balls: bestR2 as [number, number, number, number, number],
        stars: st,
        sum: r2Sum,
        above31Count: r2Above31,
      })),
      costEur: 7.5,
      coverageNote:
        'En jouant ces 3 grilles (7,50 €), si les 5 boules sortent et qu’une seule des 3 étoiles est tirée (45,5 % de probabilité), vous touchez 2× le Rang 2 (5+1) + 1× le Rang 3 (5+0). Si 2 des 3 étoiles sortent, vous décrochez le Rang 1 (5+2).',
    },
  };
}


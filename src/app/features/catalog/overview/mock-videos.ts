import { VideoSummary } from './video-summary';

const HOUR = 3_600_000;

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR);
}

// Platzhalter-Daten, bis die OpenAPI-Spec des Backends existiert (siehe CLAUDE.md Abschnitt 12).
export const MOCK_VIDEOS: VideoSummary[] = [
  {
    id: 'harbor-lights-s2e4',
    title: 'Harbor Lights — S2 E4',
    genre: 'SERIES',
    uploadedAt: hoursAgo(2),
    views: 18_400,
    durationSeconds: 2892,
    progress: 62,
  },
  {
    id: 'the-salt-road',
    title: 'The Salt Road',
    genre: 'DOCUMENTARY',
    uploadedAt: hoursAgo(5),
    views: 9_100,
    durationSeconds: 6760,
    progress: 0,
  },
  {
    id: 'neon-verdict',
    title: 'Neon Verdict',
    genre: 'FILM',
    uploadedAt: hoursAgo(9),
    views: 44_200,
    durationSeconds: 8045,
    progress: 18,
  },
  {
    id: 'quiet-machines',
    title: 'Quiet Machines',
    genre: 'SHORT',
    uploadedAt: hoursAgo(14),
    views: 3_700,
    durationSeconds: 1351,
    progress: 0,
  },
  {
    id: 'ronda-live-at-palau',
    title: 'Ronda — Live at Palau',
    genre: 'CONCERT',
    uploadedAt: hoursAgo(28),
    views: 27_900,
    durationSeconds: 6078,
    progress: 0,
  },
  {
    id: 'ash-and-ember-s1e1',
    title: 'Ash & Ember — S1 E1',
    genre: 'THRILLER',
    uploadedAt: hoursAgo(30),
    views: 61_500,
    durationSeconds: 3064,
    progress: 88,
  },
  {
    id: 'deep-field',
    title: 'Deep Field',
    genre: 'SCIENCE',
    uploadedAt: hoursAgo(48),
    views: 12_800,
    durationSeconds: 3506,
    progress: 0,
  },
  {
    id: 'midnight-circuit-round-4',
    title: 'Midnight Circuit — Round 4',
    genre: 'SPORT',
    uploadedAt: hoursAgo(50),
    views: 33_000,
    durationSeconds: 767,
    progress: 0,
  },
  {
    id: 'the-understudy',
    title: 'The Understudy',
    genre: 'COMEDY',
    uploadedAt: hoursAgo(72),
    views: 7_400,
    durationSeconds: 5782,
    progress: 34,
  },
  {
    id: 'glasshouse',
    title: 'Glasshouse',
    genre: 'DRAMA',
    uploadedAt: hoursAgo(74),
    views: 15_600,
    durationSeconds: 7089,
    progress: 0,
  },
  {
    id: 'third-shift',
    title: 'Third Shift',
    genre: 'SHORT',
    uploadedAt: hoursAgo(96),
    views: 2_200,
    durationSeconds: 892,
    progress: 0,
  },
  {
    id: 'continental-drift-s3e7',
    title: 'Continental Drift — S3 E7',
    genre: 'SERIES',
    uploadedAt: hoursAgo(98),
    views: 21_300,
    durationSeconds: 2670,
    progress: 7,
  },
];

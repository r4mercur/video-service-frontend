export interface VideoDetailData {
  title: string;
  views: number;
  uploadedAt: Date;
  durationSeconds: number;
  playbackPositionSeconds: number;
  description: string;
  tags: string[];
  genre: string;
  season: string;
  language: string;
  quality: string;
}

export interface RecommendedVideo {
  id: string;
  title: string;
  sub: string;
  durationSeconds: number;
}

// Platzhalter-Daten, bis die OpenAPI-Spec des Backends existiert (siehe CLAUDE.md Abschnitt 12).
// Die Detailseite zeigt aktuell unabhängig von der Routen-:id denselben Datensatz.
export const VIDEO_DETAIL: VideoDetailData = {
  title: 'Harbor Lights — Season 2, Episode 4',
  views: 18_412,
  uploadedAt: new Date('2026-08-21'),
  durationSeconds: 2892,
  playbackPositionSeconds: 898,
  description:
    'The harbour council votes on the salvage contract while Ilse tracks down the last ' +
    'surviving crew member of the Aurelia. Shot on location in Bergen over three weeks, this ' +
    'episode closes the salvage arc that opened the season and sets up the inquiry in episode ' +
    'five.',
  tags: ['Drama', 'Series', 'Norway', 'Season 2', 'Subtitled', '1080p'],
  genre: 'Drama series',
  season: '2 of 3',
  language: 'Norwegian · EN subs',
  quality: '1080p',
};

export const RECOMMENDED: RecommendedVideo[] = [
  {
    id: 'harbor-lights-s2e3',
    title: 'Harbor Lights — S2 E3',
    sub: 'Previous episode',
    durationSeconds: 2818,
  },
  { id: 'the-salt-road', title: 'The Salt Road', sub: 'Documentary', durationSeconds: 6760 },
  { id: 'glasshouse', title: 'Glasshouse', sub: 'Drama', durationSeconds: 7089 },
  {
    id: 'ash-and-ember-s1e1',
    title: 'Ash & Ember — S1 E1',
    sub: 'Thriller',
    durationSeconds: 3064,
  },
];

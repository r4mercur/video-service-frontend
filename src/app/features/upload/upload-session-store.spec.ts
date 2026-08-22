import { TestBed } from '@angular/core/testing';
import { StorageService } from '@core/storage/storage';
import {
  PendingUploadSession,
  UploadSessionStore,
  isSessionExpired,
  sessionMatchesFile,
} from './upload-session-store';

function makeSession(overrides: Partial<PendingUploadSession> = {}): PendingUploadSession {
  return {
    videoId: 'video-1',
    fileName: 'clip.mp4',
    fileSizeBytes: 12_345,
    contentType: 'video/mp4',
    parts: [{ partNumber: 1, url: 'https://storage.example/part-1' }],
    partSizeBytes: 12_345,
    completedParts: [],
    metadata: { title: 'Clip', categoryId: 1, visibility: 'PUBLIC' },
    ...overrides,
  };
}

describe('sessionMatchesFile', () => {
  it('matches when name and size are identical', () => {
    const session = makeSession();
    const file = new File(['x'.repeat(12_345)], 'clip.mp4', { type: 'video/mp4' });
    expect(sessionMatchesFile(session, file)).toBe(true);
  });

  it('rejects a different file name', () => {
    const session = makeSession();
    const file = new File(['x'.repeat(12_345)], 'other.mp4', { type: 'video/mp4' });
    expect(sessionMatchesFile(session, file)).toBe(false);
  });

  it('rejects a different file size', () => {
    const session = makeSession();
    const file = new File(['short'], 'clip.mp4', { type: 'video/mp4' });
    expect(sessionMatchesFile(session, file)).toBe(false);
  });
});

describe('isSessionExpired', () => {
  it('is false when there is no expiresAt', () => {
    expect(isSessionExpired(makeSession({ expiresAt: undefined }))).toBe(false);
  });

  it('is false for a future expiry', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isSessionExpired(makeSession({ expiresAt: future }))).toBe(false);
  });

  it('is true for a past expiry', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isSessionExpired(makeSession({ expiresAt: past }))).toBe(true);
  });
});

describe('UploadSessionStore', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('returns null when nothing is stored', () => {
    const store = TestBed.inject(UploadSessionStore);
    expect(store.load()).toBeNull();
  });

  it('round-trips a saved session', () => {
    const store = TestBed.inject(UploadSessionStore);
    const session = makeSession();
    store.save(session);
    expect(store.load()).toEqual(session);
  });

  it('clears a stored session', () => {
    const store = TestBed.inject(UploadSessionStore);
    store.save(makeSession());
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('ignores corrupted JSON instead of throwing', () => {
    const store = TestBed.inject(UploadSessionStore);
    TestBed.inject(StorageService).setItem('pending-upload', '{not json');
    expect(store.load()).toBeNull();
  });
});

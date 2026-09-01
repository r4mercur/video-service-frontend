import { TestBed } from '@angular/core/testing';
import { StorageService } from '@core/storage/storage';
import { AdultContentPreferenceService } from './adult-content-preference';

const STORAGE_KEY = 'adult-content-preference';

describe('AdultContentPreferenceService', () => {
  function freshStorage(): StorageService {
    const storage = TestBed.inject(StorageService);
    storage.removeItem(STORAGE_KEY);
    return storage;
  }

  it('is unanswered when nothing is stored', () => {
    freshStorage();
    const service = TestBed.inject(AdultContentPreferenceService);
    expect(service.answered()).toBe(false);
    expect(service.includeAdultContent()).toBe(false);
  });

  it('reflects a prior "yes" answer', () => {
    freshStorage().setItem(STORAGE_KEY, 'true');
    const service = TestBed.inject(AdultContentPreferenceService);
    expect(service.answered()).toBe(true);
    expect(service.includeAdultContent()).toBe(true);
  });

  it('reflects a prior "no" answer', () => {
    freshStorage().setItem(STORAGE_KEY, 'false');
    const service = TestBed.inject(AdultContentPreferenceService);
    expect(service.answered()).toBe(true);
    expect(service.includeAdultContent()).toBe(false);
  });

  it('persists setPreference(true) and flips both signals', () => {
    freshStorage();
    const service = TestBed.inject(AdultContentPreferenceService);

    service.setPreference(true);

    expect(service.answered()).toBe(true);
    expect(service.includeAdultContent()).toBe(true);
    expect(TestBed.inject(StorageService).getItem(STORAGE_KEY)).toBe('true');
  });

  it('persists setPreference(false) and flips both signals', () => {
    freshStorage();
    const service = TestBed.inject(AdultContentPreferenceService);

    service.setPreference(false);

    expect(service.answered()).toBe(true);
    expect(service.includeAdultContent()).toBe(false);
    expect(TestBed.inject(StorageService).getItem(STORAGE_KEY)).toBe('false');
  });
});

import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { StorageService } from '@core/storage/storage';
import { AgeGateService } from './age-gate';

const STORAGE_KEY = 'age-gate-confirmed';

describe('AgeGateService', () => {
  function freshStorage(): StorageService {
    const storage = TestBed.inject(StorageService);
    storage.removeItem(STORAGE_KEY);
    return storage;
  }

  it('is not confirmed when nothing is stored', () => {
    freshStorage();
    const service = TestBed.inject(AgeGateService);
    expect(service.confirmed()).toBe(false);
  });

  it('is confirmed when a prior confirmation was persisted', () => {
    freshStorage().setItem(STORAGE_KEY, 'true');
    const service = TestBed.inject(AgeGateService);
    expect(service.confirmed()).toBe(true);
  });

  it('persists confirmation and flips the signal', () => {
    freshStorage();
    const service = TestBed.inject(AgeGateService);
    service.confirm();
    expect(service.confirmed()).toBe(true);
    expect(TestBed.inject(StorageService).getItem(STORAGE_KEY)).toBe('true');
  });

  it('redirects to the decline URL via the DOCUMENT token', () => {
    const assign = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: { location: { assign } } } }],
    });
    freshStorage();
    const service = TestBed.inject(AgeGateService);

    service.decline();

    expect(assign).toHaveBeenCalledWith('https://www.google.com');
  });
});

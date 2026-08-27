import { Injectable, inject } from '@angular/core';
import { StorageService } from '@core/storage/storage';

interface StoredProgress {
  positionSeconds: number;
  durationSeconds: number;
}

const STORAGE_KEY = 'watch-progress';

/**
 * Client-local playback tracking (localStorage), since there's no backend API for this yet
 * (see CLAUDE.md section 12). Written by the player on throttled `timeupdate` as well as
 * `beforeunload` (`player-frame.ts`).
 */
@Injectable({ providedIn: 'root' })
export class WatchProgressService {
  private readonly storage = inject(StorageService);

  getProgress(videoId: string): StoredProgress | null {
    const all = this.readAll();
    return all[videoId] ?? null;
  }

  percentFor(videoId: string): number {
    const progress = this.getProgress(videoId);
    if (!progress || progress.durationSeconds <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100));
  }

  setProgress(videoId: string, positionSeconds: number, durationSeconds: number): void {
    const all = this.readAll();
    all[videoId] = { positionSeconds, durationSeconds };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  private readAll(): Record<string, StoredProgress> {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, StoredProgress>;
    } catch {
      return {};
    }
  }
}

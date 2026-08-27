import { Injectable, inject } from '@angular/core';
import { StorageService } from '@core/storage/storage';
import { CompletedPartDto, UploadPartUrl } from './upload-transport';

export interface PendingUploadMetadata {
  title: string;
  categoryId: number;
  visibility: 'PUBLIC' | 'PRIVATE';
  description?: string;
}

export interface PendingUploadSession {
  videoId: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  parts: UploadPartUrl[];
  partSizeBytes: number;
  expiresAt?: string;
  completedParts: CompletedPartDto[];
  metadata: PendingUploadMetadata;
}

const STORAGE_KEY = 'pending-upload';

export function sessionMatchesFile(session: PendingUploadSession, file: File): boolean {
  return session.fileName === file.name && session.fileSizeBytes === file.size;
}

export function isSessionExpired(session: PendingUploadSession): boolean {
  return session.expiresAt !== undefined && Date.parse(session.expiresAt) <= Date.now();
}

/**
 * Persists an in-progress upload session so a reload/connection drop can be resumed
 * (CLAUDE.md section 4.3, "client-side resume"). The file handle itself can't be
 * persisted — after a reload the user has to pick the same file again; name/size are
 * then checked against the stored session (sessionMatchesFile).
 */
@Injectable({ providedIn: 'root' })
export class UploadSessionStore {
  private readonly storage = inject(StorageService);

  load(): PendingUploadSession | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PendingUploadSession;
    } catch {
      return null;
    }
  }

  save(session: PendingUploadSession): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }
}

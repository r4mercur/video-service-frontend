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
 * Persistiert eine laufende Upload-Session, damit ein Reload/Verbindungsabbruch fortgesetzt
 * werden kann (CLAUDE.md Abschnitt 4.3, "Client-seitiges Resume"). Das File-Handle selbst lässt
 * sich nicht persistieren — nach einem Reload muss der Nutzer dieselbe Datei erneut auswählen;
 * Name/Größe werden dann gegen die gespeicherte Session geprüft (sessionMatchesFile).
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

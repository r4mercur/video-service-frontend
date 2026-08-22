import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { components } from '@core/api/schema';
import { Observable, firstValueFrom } from 'rxjs';

export type InitiateUploadRequest = components['schemas']['InitiateUploadRequest'];
export type InitiateUploadResponse = components['schemas']['InitiateUploadResponse'];
export type UploadPartUrl = components['schemas']['UploadPartUrl'];
export type CompletedPartDto = components['schemas']['CompletedPartDto'];
export type VideoStatusResponse = components['schemas']['VideoStatusResponse'];

/** Signals a deliberate abort (Pause/Cancel) — callers must not treat this as a failed upload. */
export class UploadAbortedError extends Error {
  constructor() {
    super('Part upload was aborted.');
    this.name = 'UploadAbortedError';
  }
}

export type PartUploadEvent =
  { kind: 'progress'; loadedBytes: number } | { kind: 'completed'; part: CompletedPartDto };

/**
 * Abstracts the byte transport away from the upload wizard so the confirmed presigned
 * Direct-Upload variant (CLAUDE.md Abschnitt 12) could later be swapped for another
 * transport without touching the UI layer (CLAUDE.md Abschnitt 4.3).
 */
export interface UploadTransport {
  initiate(request: InitiateUploadRequest): Promise<InitiateUploadResponse>;
  uploadPart(url: string, contentType: string, blob: Blob): Observable<PartUploadEvent>;
  complete(videoId: string, parts: CompletedPartDto[]): Promise<void>;
  status(videoId: string): Promise<VideoStatusResponse>;
}

/**
 * Presigned-URL-Parts gehen direkt an den Object Store, nicht durchs Backend — deshalb hier
 * bewusst rohes XMLHttpRequest statt HttpClient: XHR liefert echte upload-progress-Events und
 * lässt sich per unsubscribe/abort() sofort abbrechen (Pause/Cancel), ohne dass Angulars
 * Interceptor-Kette (Bearer-Token, XSRF) an einer fremden Origin mitschreiben könnte.
 */
@Injectable({ providedIn: 'root' })
export class PresignedUploadTransport implements UploadTransport {
  private readonly http = inject(HttpClient);

  async initiate(request: InitiateUploadRequest): Promise<InitiateUploadResponse> {
    return firstValueFrom(this.http.post<InitiateUploadResponse>('/api/videos', request));
  }

  uploadPart(url: string, contentType: string, blob: Blob): Observable<PartUploadEvent> {
    return new Observable<PartUploadEvent>((subscriber) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          subscriber.next({ kind: 'progress', loadedBytes: event.loaded });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          subscriber.error(new Error(`Part upload failed with HTTP ${xhr.status}.`));
          return;
        }
        const eTag = xhr.getResponseHeader('ETag');
        if (!eTag) {
          subscriber.error(
            new Error(
              'Upload succeeded but no ETag header was returned (check Access-Control-Expose-Headers on the object store).',
            ),
          );
          return;
        }
        subscriber.next({ kind: 'completed', part: { eTag } });
        subscriber.complete();
      });

      xhr.addEventListener('error', () =>
        subscriber.error(new Error('Network error during part upload.')),
      );
      xhr.addEventListener('abort', () => subscriber.error(new UploadAbortedError()));

      xhr.send(blob);

      return () => xhr.abort();
    });
  }

  async complete(videoId: string, parts: CompletedPartDto[]): Promise<void> {
    await firstValueFrom(this.http.post(`/api/videos/${videoId}/complete`, { parts }));
  }

  async status(videoId: string): Promise<VideoStatusResponse> {
    return firstValueFrom(this.http.get<VideoStatusResponse>(`/api/videos/${videoId}/status`));
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { components } from '@core/api/schema';
import { Observable, firstValueFrom } from 'rxjs';

export type InitiateUploadRequest = components['schemas']['InitiateUploadRequest'];
export type InitiateUploadResponse = components['schemas']['InitiateUploadResponse'];
export type UploadPartUrl = components['schemas']['UploadPartUrl'];
export type CompletedPartDto = components['schemas']['CompletedPartDto'];
export type VideoStatusResponse = components['schemas']['VideoStatusResponse'];
export type CursorPageVideoDetailDto = components['schemas']['CursorPageVideoDetailDto'];
export type VideoDetailDto = components['schemas']['VideoDetailDto'];

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
 * direct-upload variant (CLAUDE.md section 12) could later be swapped for another
 * transport without touching the UI layer (CLAUDE.md section 4.3).
 */
export interface UploadTransport {
  initiate(request: InitiateUploadRequest): Promise<InitiateUploadResponse>;
  uploadPart(url: string, contentType: string, blob: Blob): Observable<PartUploadEvent>;
  complete(videoId: string, parts: CompletedPartDto[]): Promise<void>;
  status(videoId: string): Promise<VideoStatusResponse>;
  /** VideoStatusResponse doesn't return a slug — for the link to the finished video it's resolved here via the own video list. */
  resolvePublishedSlug(videoId: string): Promise<string | null>;
  /**
   * Needs the videoId from `initiate()` — can therefore only be called after the metadata
   * step, not before. Despite `application/json` in the OpenAPI spec (a Springdoc artifact for
   * `MultipartFile` parameters), the real request is `multipart/form-data` with field name `file`.
   */
  setThumbnail(videoId: string, file: File): Promise<VideoDetailDto>;
}

/**
 * Presigned-URL parts go straight to the object store, not through the backend — hence the
 * deliberate use of raw XMLHttpRequest instead of HttpClient here: XHR delivers real
 * upload-progress events and can be aborted immediately via unsubscribe/abort() (pause/cancel),
 * without Angular's interceptor chain (bearer token, XSRF) writing along to a foreign origin.
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

  async resolvePublishedSlug(videoId: string): Promise<string | null> {
    const page = await firstValueFrom(this.http.get<CursorPageVideoDetailDto>('/api/me/videos'));
    return page.items?.find((video) => video.id === videoId)?.slug ?? null;
  }

  async setThumbnail(videoId: string, file: File): Promise<VideoDetailDto> {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(
      this.http.put<VideoDetailDto>(`/api/videos/${videoId}/thumbnail`, formData),
    );
  }
}

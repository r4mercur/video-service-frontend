import { Component, DestroyRef, inject, signal } from '@angular/core';
import { isApiProblem } from '@core/http/api-problem';
import { Subscription } from 'rxjs';
import { DropZone } from './drop-zone/drop-zone';
import { MetadataForm, UploadMetadata } from './metadata-form/metadata-form';
import {
  PendingUploadSession,
  UploadSessionStore,
  isSessionExpired,
  sessionMatchesFile,
} from './upload-session-store';
import {
  CompletedPartDto,
  PresignedUploadTransport,
  UploadAbortedError,
  UploadPartUrl,
  UploadTransport,
} from './upload-transport';
import { bytesPerSecond, partByteSize } from './upload-progress-math';
import { UploadProgress } from './upload-progress/upload-progress';

type Stage = 'empty' | 'metadata' | 'uploading' | 'processing' | 'done' | 'error';

interface ActiveUpload {
  videoId: string;
  file: File;
  parts: UploadPartUrl[];
  partSizeBytes: number;
  totalBytes: number;
  contentType: string;
  expiresAt?: string;
  completedParts: Map<number, CompletedPartDto>;
  metadata: UploadMetadata;
}

const STATUS_POLL_INTERVAL_MS = 5000;

@Component({
  selector: 'app-upload',
  imports: [DropZone, MetadataForm, UploadProgress],
  templateUrl: './upload.html',
  styleUrl: './upload.scss',
})
export class Upload {
  private readonly transport: UploadTransport = inject(PresignedUploadTransport);
  private readonly sessionStore = inject(UploadSessionStore);

  private uploadState: ActiveUpload | null = null;
  private currentSubscription: Subscription | null = null;
  private speedSamples: { atMs: number; loadedBytes: number }[] = [];
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly stage = signal<Stage>('empty');
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingResumeSession = signal<PendingUploadSession | null>(null);
  protected readonly dropError = signal<string | null>(null);

  protected readonly submittingMetadata = signal(false);
  protected readonly metadataError = signal<string | null>(null);

  protected readonly loadedBytes = signal(0);
  protected readonly speedBytesPerSecond = signal(0);
  protected readonly paused = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  protected readonly processingFailed = signal<string | null>(null);

  constructor() {
    const pending = this.sessionStore.load();
    if (pending && !isSessionExpired(pending)) {
      this.pendingResumeSession.set(pending);
    } else if (pending) {
      this.sessionStore.clear();
    }

    inject(DestroyRef).onDestroy(() => {
      this.currentSubscription?.unsubscribe();
      if (this.pollTimer !== null) {
        clearTimeout(this.pollTimer);
      }
    });
  }

  protected uploadFileName(): string {
    return this.uploadState?.file.name ?? this.pendingFile()?.name ?? '';
  }

  protected uploadTotalBytes(): number {
    return this.uploadState?.totalBytes ?? 0;
  }

  protected resumePercent(session: PendingUploadSession): number {
    const total = session.parts.length || 1;
    return Math.round((session.completedParts.length / total) * 100);
  }

  protected discardResumeSession(): void {
    this.sessionStore.clear();
    this.pendingResumeSession.set(null);
  }

  protected onFileSelected(file: File): void {
    this.dropError.set(null);
    const pending = this.pendingResumeSession();
    if (pending) {
      this.pendingResumeSession.set(null);
      if (sessionMatchesFile(pending, file) && !isSessionExpired(pending)) {
        this.resumeSession(pending, file);
        return;
      }
      this.sessionStore.clear();
    }

    this.pendingFile.set(file);
    this.stage.set('metadata');
  }

  protected async onMetadataSubmitted(metadata: UploadMetadata): Promise<void> {
    const file = this.pendingFile();
    if (!file) {
      return;
    }

    this.submittingMetadata.set(true);
    this.metadataError.set(null);
    try {
      const response = await this.transport.initiate({
        title: metadata.title,
        description: metadata.description,
        categoryId: metadata.categoryId,
        visibility: metadata.visibility,
        filename: file.name,
        sizeBytes: file.size,
        contentType: file.type,
      });
      if (!response.videoId || !response.parts || !response.partSizeBytes) {
        throw new Error('Upload could not be started: incomplete response from the server.');
      }

      this.uploadState = {
        videoId: response.videoId,
        file,
        parts: response.parts,
        partSizeBytes: response.partSizeBytes,
        totalBytes: file.size,
        contentType: file.type,
        expiresAt: response.expiresAt,
        completedParts: new Map(),
        metadata,
      };
      this.persistSession();
      this.loadedBytes.set(0);
      this.speedSamples = [];
      this.paused.set(false);
      this.uploadError.set(null);
      this.stage.set('uploading');
      this.uploadNextPart();
    } catch (error) {
      this.metadataError.set(this.describeError(error));
    } finally {
      this.submittingMetadata.set(false);
    }
  }

  protected togglePause(): void {
    if (this.paused()) {
      this.paused.set(false);
      this.uploadNextPart();
      return;
    }

    this.paused.set(true);
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = null;
  }

  protected cancelUpload(): void {
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = null;
    this.uploadState = null;
    this.sessionStore.clear();
    this.resetToEmpty();
  }

  protected uploadAnother(): void {
    this.resetToEmpty();
  }

  private resumeSession(session: PendingUploadSession, file: File): void {
    const completedParts = new Map<number, CompletedPartDto>();
    for (const part of session.completedParts) {
      if (part.partNumber !== undefined) {
        completedParts.set(part.partNumber, part);
      }
    }

    this.uploadState = {
      videoId: session.videoId,
      file,
      parts: session.parts,
      partSizeBytes: session.partSizeBytes,
      totalBytes: session.fileSizeBytes,
      contentType: session.contentType,
      expiresAt: session.expiresAt,
      completedParts,
      metadata: session.metadata,
    };
    this.pendingFile.set(file);
    this.loadedBytes.set(this.sumCompletedBytes(this.uploadState));
    this.speedSamples = [];
    this.paused.set(false);
    this.uploadError.set(null);
    this.stage.set('uploading');
    this.uploadNextPart();
  }

  private uploadNextPart(): void {
    const state = this.uploadState;
    if (!state) {
      return;
    }

    const next = state.parts.find(
      (part) => part.partNumber !== undefined && !state.completedParts.has(part.partNumber),
    );
    if (!next || next.partNumber === undefined || !next.url) {
      void this.finishUpload();
      return;
    }

    const partNumber = next.partNumber;
    const start = (partNumber - 1) * state.partSizeBytes;
    const size = partByteSize(
      partNumber,
      state.parts.length,
      state.partSizeBytes,
      state.totalBytes,
    );
    const blob = state.file.slice(start, start + size);
    const baseline = this.sumCompletedBytes(state);
    this.speedSamples = [];

    this.currentSubscription = this.transport
      .uploadPart(next.url, state.contentType, blob)
      .subscribe({
        next: (event) => {
          if (event.kind === 'progress') {
            const loaded = baseline + event.loadedBytes;
            this.loadedBytes.set(loaded);
            this.recordSpeedSample(loaded);
          } else {
            state.completedParts.set(partNumber, { partNumber, eTag: event.part.eTag });
            this.persistSession();
            this.uploadNextPart();
          }
        },
        error: (error: unknown) => {
          if (error instanceof UploadAbortedError) {
            // Pause/Cancel hat den Abbruch selbst ausgelöst — kein Fehlerzustand.
            return;
          }
          this.uploadError.set(this.describeError(error));
        },
      });
  }

  private async finishUpload(): Promise<void> {
    const state = this.uploadState;
    if (!state) {
      return;
    }

    const parts = [...state.completedParts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([partNumber, part]) => ({ partNumber, eTag: part.eTag }));

    try {
      await this.transport.complete(state.videoId, parts);
    } catch (error) {
      this.uploadError.set(this.describeError(error));
      return;
    }

    this.sessionStore.clear();
    this.stage.set('processing');
    this.startStatusPolling(state.videoId);
  }

  private startStatusPolling(videoId: string): void {
    const poll = async () => {
      try {
        const response = await this.transport.status(videoId);
        if (response.status === 'READY') {
          this.stage.set('done');
          return;
        }
        if (response.status === 'FAILED' || response.status === 'BLOCKED') {
          this.processingFailed.set(response.lastError ?? 'Processing failed.');
          this.stage.set('error');
          return;
        }
      } catch {
        // Netzwerk-Hänger beim Polling sind kein Grund abzubrechen — einfach erneut versuchen.
      }
      this.pollTimer = setTimeout(() => void poll(), STATUS_POLL_INTERVAL_MS);
    };
    void poll();
  }

  private persistSession(): void {
    const state = this.uploadState;
    if (!state) {
      return;
    }
    this.sessionStore.save({
      videoId: state.videoId,
      fileName: state.file.name,
      fileSizeBytes: state.totalBytes,
      contentType: state.contentType,
      parts: state.parts,
      partSizeBytes: state.partSizeBytes,
      expiresAt: state.expiresAt,
      completedParts: [...state.completedParts.values()],
      metadata: state.metadata,
    });
  }

  private sumCompletedBytes(state: ActiveUpload): number {
    let sum = 0;
    for (const partNumber of state.completedParts.keys()) {
      sum += partByteSize(partNumber, state.parts.length, state.partSizeBytes, state.totalBytes);
    }
    return sum;
  }

  private recordSpeedSample(loadedTotal: number): void {
    const now = Date.now();
    this.speedSamples.push({ atMs: now, loadedBytes: loadedTotal });
    if (this.speedSamples.length > 20) {
      this.speedSamples.shift();
    }
    this.speedBytesPerSecond.set(bytesPerSecond(this.speedSamples));
  }

  private resetToEmpty(): void {
    this.uploadState = null;
    this.pendingFile.set(null);
    this.loadedBytes.set(0);
    this.speedBytesPerSecond.set(0);
    this.paused.set(false);
    this.uploadError.set(null);
    this.metadataError.set(null);
    this.processingFailed.set(null);
    this.stage.set('empty');
  }

  private describeError(error: unknown): string {
    if (isApiProblem(error)) {
      return error.detail ?? error.title;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  }
}

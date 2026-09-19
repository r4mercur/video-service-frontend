import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AuthService, UserResponse } from '@core/auth/auth';
import { isApiProblem } from '@core/http/api-problem';
import { Avatar } from '@shared/avatar/avatar';
import { ProfileApi } from '../profile-api';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
/**
 * Matches the backend default app.avatar.max-size-bytes (5 MiB). Checked here because an upload
 * far above the server's multipart limit is not answered with a 413 - Tomcat just closes the
 * connection (backend CLAUDE.md 9.8). Not available via config.json, so a backend change has to
 * be mirrored here by hand.
 */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Returns an error message, or null when the file is acceptable. */
export function validateAvatarFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return $localize`Please choose a JPEG, PNG, WebP or GIF image.`;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return $localize`This image is larger than 5 MB.`;
  }
  return null;
}

@Component({
  selector: 'app-profile-photo-dialog',
  imports: [Avatar],
  templateUrl: './profile-photo-dialog.html',
  styleUrl: './profile-photo-dialog.scss',
})
export class ProfilePhotoDialog {
  private readonly auth = inject(AuthService);
  private readonly profileApi = inject(ProfileApi);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly dialogElement = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly username = computed(() => this.auth.currentUser()?.username ?? '');
  protected readonly currentAvatarUrl = computed(() => this.auth.currentUser()?.avatarUrl ?? null);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly displayedUrl = computed(() => this.previewUrl() ?? this.currentAvatarUrl());

  constructor() {
    effect(() => {
      const dialog = this.dialogElement()?.nativeElement;
      if (!dialog) {
        return;
      }
      if (this.open()) {
        // untracked: reset() reads previewUrl, which would otherwise re-run this effect on every
        // file selection and immediately wipe the selection again.
        untracked(() => this.reset());
        if (!dialog.open) {
          dialog.showModal();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    });
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected openPicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectFile(file);
    }
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.selectFile(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected async save(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.pending()) {
      return;
    }
    await this.run(() => this.profileApi.uploadAvatar(file));
  }

  protected async remove(): Promise<void> {
    if (this.pending()) {
      return;
    }
    await this.run(() => this.profileApi.removeAvatar());
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogElement()?.nativeElement) {
      this.close();
    }
  }

  protected close(): void {
    if (!this.pending()) {
      this.closed.emit();
    }
  }

  private async run(request: () => Promise<UserResponse>): Promise<void> {
    this.pending.set(true);
    this.error.set(null);
    try {
      this.auth.updateCurrentUser(await request());
      this.pending.set(false);
      this.closed.emit();
    } catch (error) {
      this.error.set(describeError(error));
      this.pending.set(false);
    }
  }

  private selectFile(file: File): void {
    const problem = validateAvatarFile(file);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.error.set(null);
    this.revokePreview();
    this.previewUrl.set(URL.createObjectURL(file));
    this.selectedFile.set(file);
  }

  private reset(): void {
    this.revokePreview();
    this.selectedFile.set(null);
    this.error.set(null);
    this.pending.set(false);
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.previewUrl.set(null);
    }
  }
}

function describeError(error: unknown): string {
  if (isApiProblem(error)) {
    if (error.status === 413) {
      return $localize`This image is too large.`;
    }
    return error.detail ?? error.title;
  }
  return $localize`Could not update your profile photo. Please try again.`;
}

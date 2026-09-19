import { Component, computed, input, signal } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

/**
 * Profile photo with the user's initials as fallback - both when no photo is set and when the
 * image fails to load (deleted object, storage hiccup), so a broken-image icon never shows.
 */
@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
})
export class Avatar {
  readonly name = input.required<string>();
  readonly src = input<string | null | undefined>(null);
  readonly size = input<AvatarSize>('sm');

  protected readonly initials = computed(() => this.name().slice(0, 2).toUpperCase());

  /**
   * Remembers which URL failed rather than a boolean: every upload produces a new URL
   * (backend CLAUDE.md 9.8), which then automatically gets a fresh attempt.
   */
  private readonly failedSrc = signal<string | null>(null);
  protected readonly imageSrc = computed(() => {
    const src = this.src();
    return src && src !== this.failedSrc() ? src : null;
  });

  protected onImageError(): void {
    this.failedSrc.set(this.src() ?? null);
  }
}

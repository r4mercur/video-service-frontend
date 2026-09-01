import { Component, input, output, signal } from '@angular/core';
import { form, FormField, maxLength, required, schema } from '@angular/forms/signals';
import { Button } from '@shared/button/button';
import { CategorySelect } from '../category-select/category-select';
import { ThumbnailPicker } from '../thumbnail-picker/thumbnail-picker';

export type VideoVisibility = 'PUBLIC' | 'PRIVATE';

export interface UploadMetadata {
  title: string;
  categoryId: number;
  visibility: VideoVisibility;
  description?: string;
  thumbnailFile?: File;
}

export interface MetadataFormValue {
  title: string;
  categoryId: number | null;
  visibility: VideoVisibility;
  description: string;
}

/** Reused as-is by Studio's `EditMetadataDialog` — same fields, same rules, just a different submit target. */
export const metadataSchema = schema<MetadataFormValue>((path) => {
  required(path.title, { message: 'Title is required.' });
  maxLength(path.title, 200, { message: 'Keep the title under 200 characters.' });
  required(path.categoryId, { message: 'Select a genre.' });
  maxLength(path.description, 2000, { message: 'Keep the description under 2000 characters.' });
});

/**
 * Metadata must be locked in before `initiate` can be called — there's no way to change it
 * mid-upload (see implementation plan). Once the video exists, `PATCH /api/videos/{id}` does
 * support updating title/description/categoryId/visibility afterward — see Studio's
 * `EditMetadataDialog`. Visibility isn't shown in the mockup but is required by the backend;
 * the default is "Public".
 */
@Component({
  selector: 'app-metadata-form',
  imports: [FormField, CategorySelect, ThumbnailPicker, Button],
  templateUrl: './metadata-form.html',
  styleUrl: './metadata-form.scss',
})
export class MetadataForm {
  readonly fileName = input.required<string>();
  readonly submitting = input(false);
  readonly submitted = output<UploadMetadata>();

  protected readonly formValue = signal<MetadataFormValue>({
    title: '',
    categoryId: null,
    visibility: 'PUBLIC',
    description: '',
  });
  protected readonly metadataForm = form(this.formValue, metadataSchema);

  protected readonly thumbnailFile = signal<File | null>(null);
  protected readonly thumbnailError = signal<string | null>(null);

  protected setVisibility(visibility: VideoVisibility): void {
    this.metadataForm.visibility().value.set(visibility);
  }

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.metadataForm().markAsTouched();
    if (!this.metadataForm().valid() || this.submitting()) {
      return;
    }

    const { title, categoryId, visibility, description } = this.formValue();
    this.submitted.emit({
      title,
      categoryId: categoryId as number,
      visibility,
      description: description || undefined,
      thumbnailFile: this.thumbnailFile() ?? undefined,
    });
  }
}

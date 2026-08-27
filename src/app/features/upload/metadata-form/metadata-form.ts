import { Component, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, schema } from '@angular/forms/signals';
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

interface MetadataFormValue {
  title: string;
  categoryId: number | null;
  visibility: VideoVisibility;
  description: string;
}

const metadataSchema = schema<MetadataFormValue>((path) => {
  required(path.title, { message: 'Title is required.' });
  maxLength(path.title, 200, { message: 'Keep the title under 200 characters.' });
  required(path.categoryId, { message: 'Select a genre.' });
  maxLength(path.description, 2000, { message: 'Keep the description under 2000 characters.' });
});

/**
 * Metadata must be locked in before `initiate` can be called — the contract has no
 * update-afterward path (see implementation plan). Visibility isn't shown in the mockup
 * but is required by the backend; the default is "Public".
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

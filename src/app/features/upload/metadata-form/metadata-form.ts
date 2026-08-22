import { Component, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, schema } from '@angular/forms/signals';
import { Button } from '@shared/button/button';
import { CategorySelect } from '../category-select/category-select';

export type VideoVisibility = 'PUBLIC' | 'PRIVATE';

export interface UploadMetadata {
  title: string;
  categoryId: number;
  visibility: VideoVisibility;
  description?: string;
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
 * Metadaten müssen feststehen, bevor `initiate` aufgerufen werden kann — der Contract kennt
 * kein nachträgliches Update (siehe Implementierungsplan). Sichtbarkeit ist im Mockup nicht
 * dargestellt, aber vom Backend zwingend gefordert; Default ist "Public".
 */
@Component({
  selector: 'app-metadata-form',
  imports: [FormField, CategorySelect, Button],
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
    });
  }
}

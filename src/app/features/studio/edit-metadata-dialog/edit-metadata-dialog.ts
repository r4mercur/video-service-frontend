import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { components } from '@core/api/schema';
import { CategoriesService } from '@core/catalog/categories';
import { CategorySelect } from '@features/upload/category-select/category-select';
import {
  MetadataFormValue,
  metadataSchema,
  VideoVisibility,
} from '@features/upload/metadata-form/metadata-form';

type VideoDetailDto = components['schemas']['VideoDetailDto'];
type UpdateVideoRequest = components['schemas']['UpdateVideoRequest'];

@Component({
  selector: 'app-edit-metadata-dialog',
  imports: [FormField, CategorySelect],
  templateUrl: './edit-metadata-dialog.html',
  styleUrl: './edit-metadata-dialog.scss',
})
export class EditMetadataDialog {
  private readonly categories = inject(CategoriesService);

  readonly open = input.required<boolean>();
  readonly video = input<VideoDetailDto | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);

  readonly saved = output<UpdateVideoRequest>();
  readonly closed = output<void>();

  protected readonly formValue = signal<MetadataFormValue>({
    title: '',
    categoryId: null,
    visibility: 'PUBLIC',
    description: '',
  });
  protected readonly metadataForm = form(this.formValue, metadataSchema);

  private readonly dialogElement = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    // Re-fills the form whenever a (possibly different) video is handed in — Studio only sets
    // `video` while the dialog is open, so a new reference here always means "just opened".
    effect(() => {
      const video = this.video();
      if (!video) {
        return;
      }
      this.formValue.set({
        title: video.title ?? '',
        categoryId: this.categories.idForSlug(video.categorySlug),
        visibility: video.visibility ?? 'PUBLIC',
        description: video.description ?? '',
      });
    });

    effect(() => {
      const dialog = this.dialogElement()?.nativeElement;
      if (!dialog) {
        return;
      }
      if (this.open()) {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected setVisibility(visibility: VideoVisibility): void {
    this.metadataForm.visibility().value.set(visibility);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogElement()?.nativeElement) {
      this.closed.emit();
    }
  }

  protected onCancel(): void {
    this.closed.emit();
  }

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.metadataForm().markAsTouched();
    if (!this.metadataForm().valid() || this.saving()) {
      return;
    }

    const { title, categoryId, visibility, description } = this.formValue();
    // Unlike the upload form, an empty description here must be sent as `''`, not omitted —
    // this is a partial-update PATCH, so an omitted field means "leave the existing value alone",
    // which would silently keep a stale description around after the user clears it.
    this.saved.emit({
      title,
      categoryId: categoryId as number,
      visibility,
      description,
    });
  }
}

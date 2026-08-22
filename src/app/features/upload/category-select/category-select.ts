import { Listbox, Option } from '@angular/aria/listbox';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { CategoriesService } from '@core/catalog/categories';

interface SelectableCategory {
  id: number;
  name: string;
}

/**
 * Genre-Auswahl als Button + Popup-Listbox (Angular Aria `ngListbox`/`ngOption`), damit die
 * Optik zu 100% eigenes SCSS bleibt und nur das a11y-Verhalten (Tastatur-Navigation,
 * Fokus-Handling, ARIA-Attribute) von Aria kommt — siehe CLAUDE.md Abschnitt 4.2/12.
 * Implementiert `FormValueControl`, damit `[formField]` direkt wie bei nativen Inputs greift.
 */
@Component({
  selector: 'app-category-select',
  imports: [Listbox, Option],
  templateUrl: './category-select.html',
  styleUrl: './category-select.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class CategorySelect implements FormValueControl<number | null> {
  private readonly categoriesService = inject(CategoriesService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly id = input<string>();
  readonly value = model.required<number | null>();
  readonly disabled = input(false);
  readonly touch = output<void>();

  protected readonly categories = computed<SelectableCategory[]>(() =>
    this.categoriesService
      .categories()
      .filter(
        (category): category is SelectableCategory => category.id != null && category.name != null,
      ),
  );
  protected readonly open = signal(false);

  protected readonly selectedIds = computed<number[]>(() =>
    this.value() != null ? [this.value() as number] : [],
  );

  protected readonly selectedName = computed(() => {
    const id = this.value();
    if (id == null) {
      return null;
    }
    return this.categories().find((category) => category.id === id)?.name ?? null;
  });

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly listbox = viewChild<ElementRef<HTMLElement>>('listbox');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.listbox()?.nativeElement.focus();
      }
    });
  }

  protected toggle(): void {
    if (this.disabled()) {
      return;
    }
    this.open.update((value) => !value);
  }

  protected onSelectedIdsChange(ids: readonly number[]): void {
    const id = ids[0];
    if (id !== undefined) {
      this.value.set(id);
    }
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.close();
    }
  }

  protected onTriggerBlur(): void {
    if (!this.open()) {
      this.touch.emit();
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  focus(options?: FocusOptions): void {
    this.trigger()?.nativeElement.focus(options);
  }

  private close(): void {
    this.open.set(false);
    this.touch.emit();
    this.trigger()?.nativeElement.focus();
  }
}

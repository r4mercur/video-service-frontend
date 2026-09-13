import { Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField, maxLength, schema } from '@angular/forms/signals';

interface SearchBoxValue {
  query: string;
}

/** Mirrors the backend's upper bound for `q` (CatalogService.search). */
const MAX_QUERY_LENGTH = 100;

const searchBoxSchema = schema<SearchBoxValue>((path) => {
  maxLength(path.query, MAX_QUERY_LENGTH);
});

/**
 * Dumb search field: emits the trimmed query on submit, navigation is the host's job. Too-short
 * queries are deliberately still emitted — the search page explains the minimum length, which
 * reads better than an error bubble squeezed into the header.
 */
@Component({
  selector: 'app-search-box',
  imports: [FormField],
  templateUrl: './search-box.html',
  styleUrl: './search-box.scss',
})
export class SearchBox {
  /** Must be unique per page — the header and the search page can both render a box. */
  readonly inputId = input.required<string>();
  /** Prefill, typically the query currently in the URL. Re-syncs whenever it changes. */
  readonly query = input('');
  readonly searched = output<string>();

  protected readonly formValue = linkedSignal<SearchBoxValue>(() => ({ query: this.query() }));
  protected readonly searchForm = form(this.formValue, searchBoxSchema);

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.searched.emit(this.formValue().query.trim());
  }
}

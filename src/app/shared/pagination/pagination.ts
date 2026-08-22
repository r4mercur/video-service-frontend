import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { Button } from '../button/button';

type PageItem = number | 'ellipsis';

function buildPageItems(current: number, total: number): PageItem[] {
  const pages = new Set<number>([1, total]);
  for (let page = current - 2; page <= current + 2; page++) {
    if (page >= 1 && page <= total) {
      pages.add(page);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageItem[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) {
      items.push('ellipsis');
    }
    items.push(page);
    previous = page;
  }
  return items;
}

@Component({
  selector: 'app-pagination',
  imports: [Button],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class Pagination {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly pageItems = computed(() =>
    buildPageItems(this.currentPage(), this.totalPages()),
  );
  protected readonly jumpValue = linkedSignal(() => String(this.currentPage()));

  protected goTo(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.pageChange.emit(page);
  }

  protected jump(): void {
    const page = Number(this.jumpValue());
    if (Number.isInteger(page)) {
      this.goTo(page);
    }
  }
}

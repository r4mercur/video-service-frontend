import { httpResource } from '@angular/common/http';
import { computed, Injectable } from '@angular/core';
import { components } from '@core/api/schema';

export type CategoryDto = components['schemas']['CategoryDto'];

/**
 * Categories change rarely — one shared resource fetch instead of one per feature.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly resource = httpResource<CategoryDto[]>(() => ({ url: '/api/categories' }), {
    defaultValue: [],
  });

  readonly categories = this.resource.value;
  readonly isLoading = this.resource.isLoading;

  private readonly bySlug = computed(() => {
    const map = new Map<string, string>();
    for (const category of this.categories()) {
      if (category.slug && category.name) {
        map.set(category.slug, category.name);
      }
    }
    return map;
  });

  private readonly idBySlug = computed(() => {
    const map = new Map<string, number>();
    for (const category of this.categories()) {
      if (category.slug && category.id != null) {
        map.set(category.slug, category.id);
      }
    }
    return map;
  });

  nameForSlug(slug: string | undefined): string {
    if (!slug) {
      return 'Uncategorized';
    }
    return this.bySlug().get(slug) ?? slug;
  }

  idForSlug(slug: string | undefined): number | null {
    if (!slug) {
      return null;
    }
    return this.idBySlug().get(slug) ?? null;
  }
}

import { httpResource } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';
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

  nameForSlug(slug: string | undefined): string {
    if (!slug) {
      return 'Uncategorized';
    }
    return this.bySlug().get(slug) ?? slug;
  }
}

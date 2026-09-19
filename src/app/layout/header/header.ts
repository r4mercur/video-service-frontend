import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/auth';
import { ProfilePhotoDialog } from '@features/auth/profile-photo-dialog/profile-photo-dialog';
import { Avatar } from '@shared/avatar/avatar';
import { SearchBox } from '@shared/search-box/search-box';
import { filter } from 'rxjs';

const SEARCH_PATH = '/catalog/search';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, Avatar, SearchBox, ProfilePhotoDialog],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly username = computed(() => this.auth.currentUser()?.username ?? '');
  protected readonly avatarUrl = computed(() => this.auth.currentUser()?.avatarUrl ?? null);
  protected readonly photoDialogOpen = signal(false);

  /** Keeps the header field in sync with the search page's URL; empty on every other page. */
  protected readonly searchQuery = computed(() => {
    this.navigationEnd();
    const tree = this.router.parseUrl(this.router.url);
    const query = tree.queryParams['q'];
    return this.router.url.startsWith(SEARCH_PATH) && typeof query === 'string' ? query : '';
  });

  protected search(query: string): void {
    void this.router.navigate([SEARCH_PATH], { queryParams: { q: query || null } });
  }

  protected openPhotoDialog(): void {
    this.photoDialogOpen.set(true);
  }

  protected closePhotoDialog(): void {
    this.photoDialogOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth');
  }
}

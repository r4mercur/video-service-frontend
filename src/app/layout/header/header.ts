import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/auth';
import { Avatar } from '@shared/avatar/avatar';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, Avatar],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly initials = computed(() => {
    const username = this.auth.currentUser()?.username ?? '';
    return username.slice(0, 2).toUpperCase();
  });

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth');
  }
}

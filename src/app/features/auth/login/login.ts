import { Component, inject, input, signal } from '@angular/core';
import {
  FormField,
  email as emailValidator,
  form,
  minLength,
  required,
  schema,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth';
import { isApiProblem } from '@core/http/api-problem';
import { Button } from '@shared/button/button';

interface LoginCredentials {
  identifier: string;
  password: string;
}

interface SignupCredentials {
  email: string;
  username: string;
  password: string;
}

type AuthMode = 'login' | 'signup';

const loginSchema = schema<LoginCredentials>((path) => {
  required(path.identifier, { message: 'Email or username is required.' });
  required(path.password, { message: 'Password is required.' });
});

const signupSchema = schema<SignupCredentials>((path) => {
  required(path.email, { message: 'Email is required.' });
  emailValidator(path.email, { message: 'Enter a valid email address.' });
  required(path.username, { message: 'Username is required.' });
  minLength(path.username, 3, { message: 'Use at least 3 characters.' });
  required(path.password, { message: 'Password is required.' });
  minLength(path.password, 8, { message: 'Use at least 8 characters.' });
});

@Component({
  selector: 'app-login',
  imports: [FormField, Button],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Von authGuard beim Redirect gesetzt (siehe core/auth/auth-guard.ts); ohne Query-Param
  // greift der Default.
  readonly returnUrl = input<string>('/catalog');

  protected readonly mode = signal<AuthMode>('login');
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly loginCredentials = signal<LoginCredentials>({ identifier: '', password: '' });
  protected readonly loginForm = form(this.loginCredentials, loginSchema);

  protected readonly signupCredentials = signal<SignupCredentials>({
    email: '',
    username: '',
    password: '',
  });
  protected readonly signupForm = form(this.signupCredentials, signupSchema);

  protected switchMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.serverError.set(null);
  }

  protected onSubmitLogin(event: SubmitEvent): void {
    event.preventDefault();
    this.loginForm().markAsTouched();
    if (!this.loginForm().valid() || this.submitting()) {
      return;
    }
    const { identifier, password } = this.loginCredentials();
    void this.submit(() => this.auth.login(identifier, password));
  }

  protected onSubmitSignup(event: SubmitEvent): void {
    event.preventDefault();
    this.signupForm().markAsTouched();
    if (!this.signupForm().valid() || this.submitting()) {
      return;
    }
    const { email, username, password } = this.signupCredentials();
    void this.submit(() => this.auth.register(email, username, password));
  }

  private async submit(action: () => Promise<void>): Promise<void> {
    this.submitting.set(true);
    this.serverError.set(null);
    try {
      await action();
      await this.router.navigateByUrl(this.returnUrl());
    } catch (error) {
      this.serverError.set(this.describeError(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private describeError(error: unknown): string {
    if (isApiProblem(error)) {
      return error.detail ?? error.title;
    }
    return 'Something went wrong. Please try again.';
  }
}

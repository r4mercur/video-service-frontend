import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AuthService } from '@core/auth/auth';
import { ConfigService } from '@core/config/config';
import { apiBaseUrlInterceptor } from '@core/http/api-base-url';
import { authRefreshInterceptor } from '@core/http/auth-refresh';
import { bearerTokenInterceptor } from '@core/http/bearer-token';
import { errorInterceptor } from '@core/http/error';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withXsrfConfiguration({}),
      // Order is deliberate: authRefresh needs to see the raw HttpErrorResponse BEFORE
      // errorInterceptor, otherwise it only gets the normalized ApiProblem.
      withInterceptors([
        apiBaseUrlInterceptor,
        errorInterceptor,
        bearerTokenInterceptor,
        authRefreshInterceptor,
      ]),
    ),
    // Sequential instead of two parallel initializers: Auth needs the loaded apiBaseUrl.
    // inject() must happen synchronously BEFORE the first await (NG0203), so both services
    // are resolved first and only then the async chain is kicked off.
    provideAppInitializer(() => {
      const config = inject(ConfigService);
      const auth = inject(AuthService);
      return config.load().then(() => auth.restoreSession());
    }),
  ],
};

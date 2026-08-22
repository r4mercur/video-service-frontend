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
      // Reihenfolge ist bewusst: authRefresh muss den rohen HttpErrorResponse VOR dem
      // errorInterceptor sehen, sonst hat er nur noch das normalisierte ApiProblem.
      withInterceptors([
        apiBaseUrlInterceptor,
        errorInterceptor,
        bearerTokenInterceptor,
        authRefreshInterceptor,
      ]),
    ),
    // Sequenziell statt zwei parallele Initializer: Auth braucht die geladene apiBaseUrl.
    provideAppInitializer(async () => {
      await inject(ConfigService).load();
      await inject(AuthService).restoreSession();
    }),
  ],
};

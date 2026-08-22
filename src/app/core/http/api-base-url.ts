import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ConfigService } from '@core/config/config';

/**
 * Prefixt relative /api/*-Requests mit der zur Laufzeit konfigurierten apiBaseUrl
 * (leer = same-origin, siehe public/config.json und proxy.conf.json).
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const apiBaseUrl = inject(ConfigService).apiBaseUrl;
  if (!apiBaseUrl) {
    return next(req);
  }

  return next(req.clone({ url: `${apiBaseUrl}${req.url}` }));
};

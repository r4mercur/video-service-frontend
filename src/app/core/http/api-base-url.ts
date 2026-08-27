import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ConfigService } from '@core/config/config';

/**
 * Prefixes relative /api/* requests with the runtime-configured apiBaseUrl
 * (empty = same-origin, see public/config.json and proxy.conf.json).
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

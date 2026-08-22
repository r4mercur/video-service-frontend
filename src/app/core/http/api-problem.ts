/**
 * RFC 7807 (application/problem+json), wie vom Backend ausgeliefert
 * (verifiziert gegen GET /v3/api-docs und echte 400/401-Antworten, 2026-08-22).
 */
export interface ApiProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export function isApiProblem(value: unknown): value is ApiProblem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'status' in value &&
    typeof (value as { title: unknown }).title === 'string'
  );
}

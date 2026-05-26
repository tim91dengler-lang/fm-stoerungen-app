/** Empty-String → null, getrimmt. Vermeidet 422 bei `EmailStr` & Co. */
export function nullIfEmpty(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Schwacher E-Mail-Check (leer ist ok). Verhindert die häufigsten 422-Fälle
 *  ohne Pydantic-Strenge — Backend validiert final via `EmailStr`. */
export function isValidEmailOrEmpty(v: string | null | undefined): boolean {
  if (!v || v.trim().length === 0) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Axios-Mutation-Error → lesbarer Text (für inline Fehler-Banner). */
export function extractMutationError(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const axiosErr = err as {
    response?: { data?: { detail?: unknown; message?: string } };
    message?: string;
  };
  const detail = axiosErr.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: string[]; msg?: string }) => {
        const field = d.loc?.filter((x) => x !== 'body').join('.') ?? '?';
        return `${field}: ${d.msg ?? '?'}`;
      })
      .join('; ');
  }
  if (typeof detail === 'string') return detail;
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message;
  return axiosErr.message ?? null;
}

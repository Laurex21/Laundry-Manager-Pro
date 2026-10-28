import type { TFunction } from 'i18next';
/** Never expose arbitrary server text or English fallbacks in an authentication screen. */
export function authErrorMessage(message: unknown, status: number, retryAfter: string | null, t: TFunction): string {
  const keys: Record<string, string> = {
    AUTH_NETWORK_ERROR: 'network_error_retry', AUTH_EMAIL_REQUIRED: 'auth_email_required', AUTH_INVALID_CREDENTIALS: 'auth_invalid_credentials',
    AUTH_USE_STAFF_LOGIN: 'auth_use_staff', AUTH_USE_OWNER_LOGIN: 'auth_use_owner', AUTH_UNAVAILABLE: 'auth_unavailable',
    'Invalid credentials': 'auth_invalid_credentials',
    'An account with this email already exists': 'auth_email_exists',
    'Invalid or expired reset link': 'auth_reset_invalid',
    'Staff accounts must use the staff login page': 'auth_use_staff',
    'Owner accounts must use the owner login page': 'auth_use_owner',
    'Password must be at least 10 characters long': 'registration_password_rule',
    'Password must be at least 10 characters': 'registration_password_rule',
    'Password is too common': 'auth_password_common',
    'You must accept the current Terms, Privacy Policy, and Cookie Policy to create an account.': 'auth_legal_required',
  };
  if (status === 429) {
    const seconds = Number(retryAfter);
    return String(t('auth_try_later', {minutes: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 15}));
  }
  return String(t(keys[String(message)] ?? (status === 401 ? 'auth_invalid_credentials' : status >= 500 ? 'auth_unavailable' : 'auth_failed')));
}

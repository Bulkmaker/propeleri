const LOGIN_EMAIL_DOMAIN = "player-login.local";
const TECHNICAL_EMAIL_DOMAIN = "no-login.local";
const LOGIN_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

export function isValidLogin(value: string) {
  return LOGIN_PATTERN.test(value);
}

export function loginToEmail(login: string) {
  return `${normalizeLogin(login)}@${LOGIN_EMAIL_DOMAIN}`;
}

export function isTechnicalPlayerEmail(email: string) {
  return email.endsWith(`@${TECHNICAL_EMAIL_DOMAIN}`);
}

export function isSyntheticLoginEmail(email: string) {
  return email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`);
}

export function extractLoginFromEmail(email: string) {
  if (!isSyntheticLoginEmail(email)) {
    return null;
  }

  return email.slice(0, email.indexOf("@"));
}

export function buildTechnicalEmail() {
  return `player-${crypto.randomUUID()}@${TECHNICAL_EMAIL_DOMAIN}`;
}

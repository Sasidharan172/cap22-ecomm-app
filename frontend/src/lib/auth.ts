const KEY = "lc_auth";
export function getAuth(): string | null {
    return localStorage.getItem(KEY);
}
export function setAuth(user: string, pass: string) {
    localStorage.setItem(KEY, btoa(`${user}:${pass}`));
}
export function clearAuth() {
    localStorage.removeItem(KEY);
}
export function authHeader(): Record<string, string> {
    const v = getAuth();
    return v ? { Authorization: `Basic ${v}` } : {};
}

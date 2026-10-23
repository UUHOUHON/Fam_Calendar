const TAB_TOKEN = "fam_tab_token";
const TAB_USER = "fam_tab_user";

export function setTabToken(token: string) {
  sessionStorage.setItem(TAB_TOKEN, token);
}

export function getTabToken() {
  return sessionStorage.getItem(TAB_TOKEN);
}

export function bindTabUser(id: string) {
  sessionStorage.setItem(TAB_USER, id);
}

export function tabUserId() {
  return sessionStorage.getItem(TAB_USER);
}

export function clearTabSession() {
  sessionStorage.removeItem(TAB_TOKEN);
  sessionStorage.removeItem(TAB_USER);
}

/** @deprecated use clearTabSession */
export function clearTabUser() {
  clearTabSession();
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = typeof window !== "undefined" ? getTabToken() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  return fetch(input, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
}

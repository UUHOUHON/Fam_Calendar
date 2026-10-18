const TAB_USER = "fam_tab_user";

export function bindTabUser(id: string) {
  sessionStorage.setItem(TAB_USER, id);
}

export function tabUserId() {
  return sessionStorage.getItem(TAB_USER);
}

export function clearTabUser() {
  sessionStorage.removeItem(TAB_USER);
}

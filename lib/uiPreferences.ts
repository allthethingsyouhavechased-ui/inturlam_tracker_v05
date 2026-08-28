export type WorkspaceView = "pano" | "liste";

export interface ViewPreferenceKey {
  cookie: string;
  storage: string;
}

export const PANOM_VIEW_PREFERENCE: ViewPreferenceKey = {
  cookie: "inturlam_panom_view",
  storage: "inturlam.ui.panomView",
};

export const TASKS_VIEW_PREFERENCE: ViewPreferenceKey = {
  cookie: "inturlam_tasks_view",
  storage: "inturlam.ui.tasksView",
};

export function parseWorkspaceView(
  value: string | null | undefined,
  fallback: WorkspaceView = "pano",
): WorkspaceView {
  return value === "pano" || value === "liste" ? value : fallback;
}

// Cookie sunucu render'ının doğru görünümle başlamasını, localStorage ise
// tercihin uygulamadaki diğer istemci parçaları tarafından da okunabilmesini
// sağlar. Depolama kapalıysa seçim yine o oturum boyunca React state'inde kalır.
export function rememberWorkspaceView(
  preference: ViewPreferenceKey,
  view: WorkspaceView,
): void {
  if (typeof document !== "undefined") {
    document.cookie = `${preference.cookie}=${view}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  try {
    window.localStorage.setItem(preference.storage, view);
  } catch {
    // Gizli sekme veya kapalı depolama kalıcılığı engelleyebilir; etkileşim sürer.
  }
}

export const TEAM_WORKSTREAM_PREFERENCE = "inturlam.ui.teamWorkstream";

/**
 * Ekip ekranındaki departman filtresi. Eskiden her açılışta kullanıcının KENDİ
 * departmanına sıfırlanıyordu: "Tümü"ye geçen biri sayfadan çıkıp döndüğünde
 * yine kendi departmanını görüyor ve neden değiştiğini anlamıyordu.
 *
 * Cookie DEĞİL localStorage: bu tercihin sunucu render'ına etkisi yok (filtre
 * tamamen istemcide uygulanıyor), yani cookie her isteğe boşuna binerdi.
 */
export function readTeamWorkstream(): string | null {
  try {
    return window.localStorage.getItem(TEAM_WORKSTREAM_PREFERENCE);
  } catch {
    return null;
  }
}

export function rememberTeamWorkstream(value: string): void {
  try {
    window.localStorage.setItem(TEAM_WORKSTREAM_PREFERENCE, value);
  } catch {
    // Gizli sekmede tercih o oturum boyunca React state'inde kalır.
  }
}

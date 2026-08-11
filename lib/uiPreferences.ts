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

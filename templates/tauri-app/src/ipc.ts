import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export type ProjectManifest = {
  id: string;
  name: string;
  path: string;
  flagship: "rubric-studio" | "robotics-studio" | "agent-studio" | "platform-template";
  openedAt: string;
};

export type RecentProject = {
  name: string;
  path: string;
  lastOpenedAt: string;
};

export type DeepLinkPayload = {
  flagship: string;
  action: string;
  params: Record<string, string>;
  installUrl?: string;
};

export async function openProjectFolder(path: string): Promise<ProjectManifest> {
  return invoke<ProjectManifest>("open_project_folder", { path });
}

export async function listRecentProjects(): Promise<RecentProject[]> {
  return invoke<RecentProject[]>("list_recent_projects");
}

export async function readProjectTree(path: string): Promise<Array<{ name: string; path: string; kind: "file" | "folder" }>> {
  return invoke("read_project_tree", { path });
}

export async function onDeepLink(handler: (payload: DeepLinkPayload) => void): Promise<() => void> {
  const unlisten = await listen<DeepLinkPayload>("auraone://deep-link", (event) => handler(event.payload));
  return unlisten;
}

export async function onProjectOpened(handler: (payload: ProjectManifest) => void): Promise<() => void> {
  const unlisten = await listen<ProjectManifest>("project://opened", (event) => handler(event.payload));
  return unlisten;
}

export async function onDragDropProject(handler: (path: string) => void | Promise<void>): Promise<() => void> {
  const webview = getCurrentWebview();
  const unlisten = await webview.onDragDropEvent((event) => {
    const payload = event.payload as { type: string; paths?: string[] };
    const path = payload.type === "drop" ? payload.paths?.[0] : undefined;
    if (path) {
      void handler(path);
    }
  });
  return unlisten;
}

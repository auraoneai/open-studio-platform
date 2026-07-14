import {
  AuraEmptyState,
  AuraIdeAppFrame,
  AuraInspector,
  AuraIntakePacketPreview,
  AuraProblemsPanel,
  AuraProjectTree,
  AuraSettingsPanel,
  AuraStatusBar,
  AuraTabbedShell,
  createDefaultIdeCommands,
  type AuraTab,
  type AuraTreeNode,
} from "@auraone/aura-ide-kit";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listRecentProjects,
  onDeepLink,
  onDragDropProject,
  onProjectOpened,
  openProjectFolder,
  type ProjectManifest,
  type RecentProject,
} from "./ipc";

const starterTree: AuraTreeNode[] = [
  {
    id: "root",
    name: "open-studio-template",
    kind: "folder",
    path: "/template",
    expanded: true,
    children: [
      { id: "manifest", name: "rubric.toml", kind: "file", path: "/template/rubric.toml", dirty: true },
      { id: "criteria", name: "criteria", kind: "folder", path: "/template/criteria", badge: "2" },
      { id: "samples", name: "samples", kind: "folder", path: "/template/samples" },
    ],
  },
];

export function App() {
  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTabId, setActiveTabId] = useState("welcome");
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark" | "high-contrast">("system");
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [crashReportsEnabled, setCrashReportsEnabled] = useState(false);

  const refreshRecentProjects = useCallback(async () => {
    setRecentProjects(await listRecentProjects());
  }, []);

  const openFolderPath = useCallback(
    async (path: string) => {
      const manifest = await openProjectFolder(path);
      setProject(manifest);
      await refreshRecentProjects();
    },
    [refreshRecentProjects],
  );

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false, title: "Open AuraOne project folder" });
    if (typeof selected === "string") {
      await openFolderPath(selected);
    }
  }, [openFolderPath]);

  useEffect(() => {
    void refreshRecentProjects();
    const unsubscribers: Array<() => void> = [];

    void onProjectOpened((manifest) => {
      setProject(manifest);
      void refreshRecentProjects();
    }).then((unlisten) => unsubscribers.push(unlisten));

    void onDragDropProject(openFolderPath).then((unlisten) => unsubscribers.push(unlisten));

    void onDeepLink((payload) => {
      if (payload.installUrl) {
        window.open(payload.installUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const projectPath = payload.params.path;
      if (payload.action === "open-project" && projectPath) {
        void openFolderPath(projectPath);
      }
    }).then((unlisten) => unsubscribers.push(unlisten));

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [openFolderPath, refreshRecentProjects]);

  const commands = useMemo(() => {
    const registry = createDefaultIdeCommands(openFolder, () => setSettingsOpen(true));
    for (const recent of recentProjects.slice(0, 5)) {
      registry.register({
        id: `project.open-recent.${recent.path}`,
        title: `Open Recent: ${recent.name}`,
        group: "Project",
        keywords: ["recent", recent.path],
        handler: () => openFolderPath(recent.path),
      });
    }
    return registry;
  }, [openFolder, openFolderPath, recentProjects]);

  const tabs: AuraTab[] = [
    {
      id: "welcome",
      title: project ? project.name : "Welcome",
      content: project ? (
        <AuraIntakePacketPreview
          packet={{
            packetId: `local-${project.id}`,
            flagship: project.flagship === "platform-template" ? "rubric-studio" : project.flagship,
            schemaVersion: "1.0.0",
            payloadRoles: ["manifest", "project-preview"],
            includedFiles: [{ path: ".auraone/project.json", role: "manifest", bytes: 512 }],
            excludedPatterns: ["**/.env", "**/secrets/**", "**/.git/**"],
            warnings: telemetryEnabled ? [] : ["Telemetry is off. Events remain in the local event log."],
          }}
        />
      ) : (
        <AuraEmptyState title="Open a project folder" description="Use Cmd/Ctrl-K and run Open Folder, or drop a folder onto the app window." />
      ),
    },
  ];

  return (
    <AuraIdeAppFrame
      productName="AuraOne Open Studio"
      projectName={project?.name}
      commands={commands}
      themeMode={themeMode}
      onThemeModeChange={setThemeMode}
      sidebar={<AuraProjectTree nodes={starterTree} selectedId="manifest" />}
      main={<AuraTabbedShell tabs={tabs} activeTabId={activeTabId} onActiveTabChange={setActiveTabId} />}
      inspector={
        settingsOpen ? (
          <AuraSettingsPanel
            productName="AuraOne Open Studio"
            telemetryEnabled={telemetryEnabled}
            crashReportsEnabled={crashReportsEnabled}
            onTelemetryChange={setTelemetryEnabled}
            onCrashReportsChange={setCrashReportsEnabled}
          />
        ) : (
          <AuraInspector title="Project">
            {project ? project.path : "No folder selected."}
            {recentProjects.length ? (
              <ul>
                {recentProjects.slice(0, 5).map((recent) => (
                  <li key={recent.path}>{recent.name}</li>
                ))}
              </ul>
            ) : null}
          </AuraInspector>
        )
      }
      bottomPanel={<AuraProblemsPanel problems={[]} />}
      statusBar={
        <AuraStatusBar
          items={[
            { id: "mode", label: "Theme", value: themeMode },
            { id: "telemetry", label: "Telemetry", value: telemetryEnabled ? "on" : "off", tone: telemetryEnabled ? "warning" : "success" },
            { id: "scheme", label: "Scheme", value: "auraone://" },
          ]}
        />
      }
    />
  );
}

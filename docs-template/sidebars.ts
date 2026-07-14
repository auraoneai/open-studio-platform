type SidebarItem = string | { type: string; label: string; link?: unknown; items: SidebarItem[] };
type SidebarsConfig = Record<string, SidebarItem[]>;

const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    "install",
    "quickstart",
    {
      type: "category",
      label: "Concepts",
      link: { type: "doc", id: "concepts/project-as-folder" },
      items: ["concepts/project-as-folder", "concepts/intake-packets", "concepts/privacy"],
    },
    {
      type: "category",
      label: "Features",
      link: { type: "doc", id: "features/shell" },
      items: ["features/shell", "features/command-palette", "features/theme"],
    },
    {
      type: "category",
      label: "API",
      link: { type: "doc", id: "api/ipc" },
      items: ["api/ipc", "api/url-scheme"],
    },
    {
      type: "category",
      label: "Cookbook",
      link: { type: "doc", id: "cookbook/deep-links" },
      items: ["cookbook/deep-links", "cookbook/project-template"],
    },
    "maintainers",
    "changelog",
  ],
};

export default sidebars;

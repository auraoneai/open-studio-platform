---
id: command-palette
title: Command Palette
---

# Command Palette

All flagship commands register through the platform command registry:

```ts
registry.register({
  id: "project.open-folder",
  title: "Open Folder",
  group: "Project",
  keybinding: "Mod+O",
  handler: openFolder,
});
```

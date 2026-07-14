# Build Matrix

The release workflow template owned by the Platform publishes the following matrix for each flagship.

| OS | Arch | Artifact |
| --- | --- | --- |
| macOS 12+ | x86_64 | `.dmg`, `.app.tar.gz` |
| macOS 12+ | aarch64 | `.dmg`, `.app.tar.gz` |
| macOS 12+ | universal | `.dmg` |
| Windows 10+ | x86_64 | `.msi`, portable `.exe` |
| Windows 10+ | aarch64 | `.msi` advisory |
| Linux glibc 2.31+ | x86_64 | `.AppImage`, `.deb`, `.rpm` |
| Linux glibc 2.31+ | aarch64 | `.AppImage`, `.deb` |

External signing certificates, notarization credentials, Windows EV/HSM setup, DNS, and marketplace publication remain Platform-owned release tasks. This template contains only local build and packaging config.

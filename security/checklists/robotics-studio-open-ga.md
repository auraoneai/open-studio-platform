# Robotics Studio Open GA Security Checklist

Date: 2026-05-13

## Required Before GA

- [ ] External review complete for PyO3 embedding, ROS bag parsing, video
  decoder inputs, installer scripts, updater, and `.auraonepkg` intake export.
- [ ] No critical or high CVEs in shipped Python, Rust, Node, or OS package
  dependencies.
- [ ] SBOM generated and attached to GitHub release.
- [ ] License scan verifies no GPL/AGPL/LGPL/unknown licenses in shipped binary.
- [ ] Secret scan passes against full repository history.
- [ ] macOS DMG is signed and notarized.
- [ ] Windows MSI is signed with AuraOne EV cert.
- [ ] Linux AppImage/deb/rpm and tarballs have detached GPG signatures.
- [ ] Update manifest is signed and verifies in the app.
- [ ] Homebrew cask checksum matches signed DMG.
- [ ] winget installer checksum matches signed MSI.
- [ ] Install scripts verify checksum before install.
- [ ] Telemetry is off by default and event registry excludes dataset content,
  filenames, labels, identifiers, and episode IDs.
- [ ] Crash reporting is off by default and scrubs paths/arguments.
- [ ] Intake export privacy preview lists every file and redaction rule before
  packaging.
- [ ] Accessibility audit covers keyboard-only and screen reader flows.
- [ ] Performance baseline meets PRD targets on M2 Pro, Linux x86_64, and
  Windows 11 or remains unchecked with a blocker.

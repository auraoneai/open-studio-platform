# Open Studio Platform Compliance

This directory owns the automated checks and release evidence used by Platform Security.

## Local Checks

```bash
node opensource/open-studio-platform/compliance/scripts/check-security-configs.mjs
node opensource/open-studio-platform/compliance/scripts/check-telemetry-forbidden-fields.mjs --self-test
node opensource/open-studio-platform/compliance/scripts/check-intake-privacy-exclusions.mjs --self-test
node opensource/open-studio-platform/compliance/scripts/check-npm-licenses.mjs --input=opensource/open-studio-platform/compliance/tests/fixtures/npm-license-valid.json
```

Negative fixture check:

```bash
node opensource/open-studio-platform/compliance/scripts/check-npm-licenses.mjs --input=opensource/open-studio-platform/compliance/tests/fixtures/npm-license-invalid.json
```

The negative fixture must fail because GPL-family licenses are denied.

## CI Checks

The reusable workflow template is in `.github-templates/workflows/security.yml`. Flagship repos copy or symlink it and keep these jobs enabled:

- DCO sign-off.
- Security artifact integrity.
- `cargo-deny`.
- `cargo-audit`.
- npm license check.
- Package-manager dependency vulnerability scan.
- gitleaks secret scan.
- OSV dependency vulnerability scan.
- Semgrep security rules.
- SBOM generation.
- Forbidden telemetry field checks.
- Intake privacy exclusion checks.

# Open Studio Platform Context Dossier

**Analysis date:** 2026-07-18 (UTC)
**Repository:** [`auraoneai/open-studio-platform`](https://github.com/auraoneai/open-studio-platform)
**Branch inspected:** `vorflux/openstudio-sota-20260718`
**Repository snapshot:** `31623cc414a1d8efcbce1cfffe6aa3b8c5864ac6` (2026-07-14)
**Document role:** portfolio context, not a scored SOTA declaration
**Validation state:** documentation checks only; full source, hosted, hardware, release, and external-service validation is pending
**Remediation state:** none; this change documents current evidence and does not remediate source or operations

## Executive context

Open Studio Platform is best categorized as an **open-source, reusable secure application substrate and release-governance control plane for desktop/browser/CLI studio products**. It combines a Tauri 2 template, React component systems, runtime-neutral contracts, Rust native-capability crates, Cloudflare-oriented edge services, schemas, release tooling, package/distribution metadata, security controls, and governance procedures. It explicitly leaves product workflows to consuming Studio repositories ([root README](../../README.md)).

That category is narrower than an AI workflow builder and broader than a UI library. The closest reference points are Eclipse Theia and VS Code OSS for extensible workbench foundations, Tauri for native shell/security primitives, and Backstage for platform-governance/scaffolding patterns. Dify, Langflow, Flowise, OpenHands, and the six audited portfolio products are adjacent at the application/runtime layer rather than direct substrate equivalents.

**Portfolio status:** unscored context. The canonical portfolio index says Open Studio has no verdict and is excluded from technical scores. No SOTA verdict is issued here; the repository remains contextual and unscored.

## Scope and method

The assessment used the tracked repository tree, manifests, source surfaces, tests, workflows, governance files, implementation claims, blocker records, and readiness JSON at the snapshot above. The scan covered all 452 tracked files, including 12 Rust crates, three TypeScript/React packages, five edge services, the Tauri template, Docusaurus template, registries, schemas, release/distribution metadata, scripts, and 48 test files identified by repository naming conventions.

The six portfolio identities and intended dossier paths come from the structured portfolio evidence in `gchahal1982/agentgraph`. Their current repository checkouts and top-level manifests/READMEs were inspected for category and explicit Open Studio/AuraOne dependencies. No such dependency or integration reference was found in the six product trees outside portfolio evidence. This proves **no visible repository-level integration at inspection time**; it does not prove no private, deployed, or future integration exists.

Evidence rules used here:

- Tracked implementation and executable tests outrank prose.
- A declared contract, manifest, workflow, or runbook is not proof that a hosted/native path ran.
- Contradictory evidence is reported, not reconciled by assumption.
- Current external capabilities use official project documentation or release pages where possible; anything not exercised locally is labeled **unverified**.
- Dynamic ecosystem, release, and hosted-service facts are snapshots, not durable guarantees.

## Repository evidence snapshot

| Surface | Current repository evidence | Contextual significance | Evidence limit |
| --- | --- | --- | --- |
| Product boundary | The [README](../../README.md) calls the repository a product-neutral substrate and says product workflows remain in Studio trees. | A useful separation of shared trust/release concerns from domain products. | Consumer adoption beyond the three named AuraOne flagships is not demonstrated here. |
| Public packages | `@auraone/proofline-oss@0.1.1`, `@auraone/aura-ide-kit@0.2.1`, and `@auraone/platform-contracts@0.3.0` are declared in package manifests and described as published in package READMEs. | Reusable UI/evidence and trust contracts can be consumed without the full monorepo. | Registry readback was not repeated for this dossier; publication claims are **unverified in this run**. |
| Native substrate | The [Cargo workspace](../../Cargo.toml) contains keychain, intake, updater, telemetry, crash, sidecar, video, dataset-stream, ROS bag, MCP, OTLP, and LLM-gateway crates. | Broad shared native/security and AI/robotics extension seams. | Presence and unit tests do not establish production portability or target-hardware behavior. |
| Workbench UI | [`aura-ide-kit`](../../packages/aura-ide-kit/README.md) declares project tree, split panes, Monaco, timeline, inspector, palette, status, problems, settings, telemetry, intake, and shell components. Proofline adds accessible evidence/data primitives. | Credible reusable Studio UX layer with explicit SSR posture and accessibility tests. | It is not a complete extensible IDE host, extension marketplace, collaborative editor, or product workflow. |
| Runtime contracts | [`platform-contracts`](../../packages/platform-contracts/README.md) defines telemetry, crash, intake, keychain, updater, and extension types/helpers while explicitly not providing transport or persistence. | Strong boundary clarity; consumers can share policy without hidden networking. | A contract package does not prove consumer conformance. |
| Desktop template | `templates/tauri-app` contains Tauri 2 configuration, capabilities, IPC, deep-link handling, and sidecar conventions. | A repeatable secure desktop starting point. | The repository records hosted macOS/Windows/Linux matrix work as pending or externally blocked. |
| Services | Five Worker-style services cover updates, intake, import consumption, install scripts, and telemetry. | Shows an end-to-end distribution/consent architecture, not only local libraries. | Live deployment claims in May documents were not re-probed in this run and are **unverified/stale-prone**. |
| Release/security controls | Signing wrappers, updater manifests, release evidence schemas, SBOM config, license/privacy checks, gitleaks, cargo-audit policy, DCO, CODEOWNERS, disclosure and incident runbooks are present. | More release-governance depth than most component libraries. | Some controls are templates or local verifiers; hosted custody, Windows signing, and independent review remain incomplete. |
| CI | The tracked [CI workflow](../../.github/workflows/ci.yml) runs DCO, TypeScript package checks, Rust workspace tests, and full-history gitleaks. | A meaningful baseline for repository changes. | It does not run the full release, docs, Tauri host matrix, edge-service, security-license, or artifact-readiness command set on every change. |
| Documentation | Root docs, package READMEs, Docusaurus scaffold, governance, support, compliance and implementation matrices exist. | Strong policy and onboarding breadth. | Several implementation records refer to `docs/evidence/...` paths not tracked in this repository snapshot; those references are not self-contained proof. |

### Evidence-quality findings

1. **Implementation breadth is real.** Source exists across shared React packages, Rust capability crates, five services, schemas, release tooling, registries, installers, and a Tauri application template.
2. **The trust boundary is unusually explicit.** Package documentation repeatedly distinguishes declarations/validators from network, storage, authentication, signature, and consent responsibilities.
3. **Release evidence is split across versions, staged configuration, and unavailable external artifacts.** [`BLOCKERS.md`](../../BLOCKERS.md) and [`IMPLEMENTATION_MATRIX.md`](../../IMPLEMENTATION_MATRIX.md) include May 2026 closure claims, while tracked machine-readable records describe different versions/scopes or intentionally await external verifier inputs. These records are not direct contradictions, but this snapshot cannot derive one current release state from them. For example:
   - [`distribution/windows/windows-package-identity-readiness.json`](../../distribution/windows/windows-package-identity-readiness.json) says `evidence-packet-prepared-external-registration-pending` and `requires-external-evidence`.
   - [`distribution/linux/linux-artifact-readiness.json`](../../distribution/linux/linux-artifact-readiness.json) says `metadata-prepared-artifacts-and-signatures-pending` for version `0.2.0`.
   - [`distribution/robotics/robotics-hosted-hardware-readiness.json`](../../distribution/robotics/robotics-hosted-hardware-readiness.json) says hardware execution is pending.
4. **Some proof references are unavailable in this snapshot.** The README refers to `distribution/release-evidence/index.json`, and implementation documents refer extensively to `docs/evidence/product/...`; neither evidence corpus is tracked at this snapshot. Claims dependent on those paths are **unverified** here.
5. **Standalone command portability needs proof.** Several root security scripts change to `../..` and invoke `opensource/open-studio-platform/...`, a former/outer monorepo path. Their success from this standalone checkout is **unverified** and likely environment-dependent.
6. **Historical results are not current validation.** The implementation matrix records passes from 2026-05-13 through 2026-05-20. They are useful provenance but are not a substitute for a 2026-07-18 clean rerun.

## Relationship to the six audited portfolio projects

### Portfolio context matrix

| Audited project | Audited category | Verified current relationship | Open Studio relevance | Boundary / unverified opportunity |
| --- | --- | --- | --- | --- |
| [AgentGraph](https://github.com/gchahal1982/agentgraph) | Agent orchestration runtime | No Open Studio/AuraOne import or reference found outside portfolio evidence. | MCP, OTLP, LLM-gateway contracts, keychain, telemetry, updater, IDE shell, and release controls could host or inspect AgentGraph-powered workflows. | No adapter, graph editor, trace mapping, packaging contract, or conformance test is present. Integration is **unverified**. |
| [PixelJury](https://github.com/gchahal1982/pixeljury) | Local-first visual QA CLI | No Open Studio/AuraOne import or reference found. | PixelJury could test Studio/docs visual quality; Proofline/Aura IDE Kit could provide accessible result/evidence surfaces for a future GUI. | No CI invocation, component adapter, result schema mapping, or packaged UI exists. Integration is **unverified**. |
| [AgentFlow (`agentfree`)](https://github.com/gchahal1982/agentfree) *(access-restricted; anonymous access returned 404 on 2026-07-18)* | Enterprise visual AI workflow automation | No Open Studio/AuraOne import or reference found. | It has the strongest product-layer Studio adjacency: its visual workflow frontend could consume IDE/evidence components and use Tauri, keychain, updater, telemetry, intake, and release controls for desktop delivery. | AgentFlow already has an independent frontend/backend architecture. Open Studio does not supply its workflow engine, approvals, evals, budgets, RAG, or deployment plane. Integration is **unverified**. |
| [DocOS](https://github.com/gchahal1982/DocOS) *(access-restricted; anonymous access returned 404 on 2026-07-18)* | Regulated document intelligence | No Open Studio/AuraOne import or reference found. | Evidence primitives, secure desktop shell, keychain, privacy-safe telemetry, signed updates, intake packets, and release governance are relevant to a local/desktop DocOS client. | Open Studio does not implement DocOS retrieval, citations, parsers, obligations, auth, tenancy, or regulated deployment controls. Integration is **unverified**. |
| [memlayer](https://github.com/gchahal1982/memlayer) *(access-restricted; anonymous access returned 404 on 2026-07-18)* | Governed agent memory | No Open Studio/AuraOne import or reference found. | A future Agent Studio could reach memlayer through MCP/HTTP and display audit/governance evidence using shared UI; keychain and LLM-gateway contracts could protect credentials. | Open Studio has no memory model, retention engine, graph retrieval, tenancy, or memlayer connector. Protocol compatibility is **unverified**. |
| [sigcrawl](https://github.com/gchahal1982/sigcrawl) *(access-restricted; anonymous access returned 404 on 2026-07-18)* | Crawl, research, and public-web intelligence | No Open Studio/AuraOne import or reference found. | sigcrawl’s MCP/API tools could become an Agent Studio tool source; OTLP, keychain, gateway, evidence UI, and desktop release paths are adjacent. | Open Studio does not crawl, scrape, search, enforce robots policy, manage distributed jobs, or implement sigcrawl schemas. MCP/tool compatibility is **unverified**. |

### What the relationship is—and is not

Open Studio can reduce duplicated shell, accessibility, consent, native-secret, update, intake, packaging, and release-control work across portfolio applications. That is **architectural relevance**, not inherited product capability. AgentGraph’s runtime does not become an Open Studio feature; PixelJury’s visual analysis does not validate Open Studio unless invoked; AgentFlow’s canvas is not supplied by Aura IDE Kit; DocOS’s regulated controls are not covered by generic platform policy; memlayer’s governance is not the platform keychain; and sigcrawl’s MCP server is not proven compatible merely because the platform has an MCP crate.

A defensible portfolio integration claim requires, per product: a pinned dependency or versioned protocol, a maintained adapter, contract/conformance tests, consent and threat-model review, end-to-end release evidence, and a named owner. None is visible for these six at the inspected snapshot.

## Current studio/platform landscape

External facts below were checked on 2026-07-18 against official documentation or official repositories where available. They were not installed or benchmarked in this run. “Unverified” means the capability was not independently exercised here.

The GitHub `releases/latest` API returned this dated primary-source snapshot on 2026-07-18: [Theia `v1.73.1`](https://github.com/eclipse-theia/theia/releases/tag/v1.73.1) (published 2026-07-01), [VS Code `1.129.1`](https://github.com/microsoft/vscode/releases/tag/1.129.1) (2026-07-17), [Tauri `2.11.5`](https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.11.5) (2026-07-01), [Backstage `v1.53.0`](https://github.com/backstage/backstage/releases/tag/v1.53.0) (2026-07-14), [Dify `1.16.0`](https://github.com/langgenius/dify/releases/tag/1.16.0) (2026-07-17), [Langflow `v1.10.2`](https://github.com/langflow-ai/langflow/releases/tag/v1.10.2) (2026-07-07), [Flowise `3.1.3`](https://github.com/FlowiseAI/Flowise/releases/tag/flowise%403.1.3) (2026-06-25), and [OpenHands `cloud-1.46.2`](https://github.com/OpenHands/OpenHands/releases/tag/cloud-1.46.2) (2026-07-15). The OpenHands tag is explicitly a cloud-channel release and must not be represented as OSS-version parity. “Latest” is API-selected and can change at any time.

| Reference platform | Category and current primary-source context | Relevance to Open Studio | Directness | Verification note |
| --- | --- | --- | --- | --- |
| [Eclipse Theia](https://theia-ide.org/releases/) | Extensible browser/desktop IDE platform with official monthly release records; Theia AI is documented as a framework for AI-native tooling. | Strongest architectural comparator for reusable workbench, extensions, browser/desktop parity, and AI-tooling composition. | Direct for IDE substrate; less direct for signed product release governance. | Official release page checked 2026-07-18; capability depth not benchmarked (**unverified**). |
| [VS Code](https://code.visualstudio.com/updates/) / [Code - OSS](https://github.com/microsoft/vscode) | Mature editor/workbench and extension platform with official monthly release notes. | Baseline for editor ergonomics, extension APIs, remote workflows, accessibility, agent UX, and ecosystem expectations. | Direct for workbench expectations; the Microsoft distribution and marketplace have separate licensing/operational boundaries. | Official updates/repository checked 2026-07-18; no head-to-head test (**unverified**). |
| [Tauri 2](https://v2.tauri.app/blog/tauri-20/) | Native application framework with capability/permission boundaries, CSP support, plugins, and signed updater support. | Open Studio builds on this rather than replacing it; differentiation must come from reusable Studio contracts, UI, governance, and evidence. | Upstream dependency/reference, not a competitor in product workflows. | Official Tauri 2 announcement and [capabilities docs](https://v2.tauri.app/security/capabilities/) checked 2026-07-18. |
| [Backstage](https://backstage.io/docs/overview/what-is-backstage/) | Extensible developer portal with software catalog, templates, TechDocs, and plugin architecture. | Relevant benchmark for platform ownership, golden paths, plugin governance, cataloging, and organizational adoption. | Adjacent: web developer portal versus desktop/browser Studio substrate. | Official docs checked 2026-07-18; current scale claims not independently verified. |
| [Dify](https://github.com/langgenius/dify/releases) | Self-hostable visual AI application/workflow, RAG, agent, and plugin platform with active official releases. | Product-layer benchmark for AgentFlow/Agent Studio UX, deployment, plugins, collaboration, and operational completeness. | Not a direct replacement for shared Tauri/signing substrate. | Official releases checked 2026-07-18; feature parity not tested (**unverified**). |
| [Langflow](https://github.com/langflow-ai/langflow/releases) and [Flowise](https://github.com/FlowiseAI/Flowise/releases) | Visual AI flow builders with official open-source release streams. | Establish expectations for node catalogs, templates, run/debug UX, provider integrations, and one-command deployment. | Product-layer comparators, especially for AgentFlow; indirect for Open Studio itself. | Release pages cited; current capabilities and licensing details are **unverified** in this run. |
| [OpenHands](https://github.com/OpenHands/OpenHands/releases) | Software-development agent platform with official release history and interactive agent execution surfaces. | Benchmark for agent sessions, tool execution, sandboxing, repository workflows, and operator UX. | Adjacent product/runtime, not general release substrate. | Official releases checked 2026-07-18; OSS/cloud differences and runtime behavior are **unverified**. |

### Context comparison matrix

Legend: **present** = tracked implementation surface; **partial** = some relevant surface but not equivalent breadth; **external** = primarily delegated to consumers/upstream; **unverified** = not demonstrated in this assessment; **N/A** = outside primary purpose.

| Dimension | Open Studio | Theia | VS Code / Code - OSS | Tauri 2 | Backstage | Dify / visual AI builders | OpenHands |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reusable IDE/workbench shell | Present, smaller component surface | Core purpose | Core purpose | External | Partial web shell | Product-specific canvas | Product-specific agent UI |
| Desktop and browser strategy | Present in architecture; cross-target proof partial | Core purpose | Present | Desktop/mobile native shell | Browser-first | Browser-first | Web/CLI oriented; exact current breadth unverified |
| Native capability isolation | Tauri capabilities plus Rust boundary | Framework-dependent | Mature host boundary | Core purpose | N/A | N/A/browser controls | Sandbox/runtime controls; not equivalent |
| Shared evidence/accessibility UI | Present and tested locally | General UI framework | General workbench accessibility | N/A | Plugin/UI ecosystem | Product-specific | Product-specific |
| Product-neutral trust contracts | Present for telemetry, crash, intake, updater, keychain | Extension/platform APIs | Extension/platform APIs | Permission/plugin APIs | Catalog/template contracts | Workflow/app contracts | Agent/runtime contracts |
| Extension/plugin ecosystem | Contract seams only; no marketplace/host proof | Mature architecture | Mature ecosystem | Plugin ecosystem | Mature plugin model | Plugin/node ecosystems | Agent/tool extension model |
| Signed cross-OS release control | Extensive tooling; evidence is split by version/scope and external inputs | Consumer-owned | Upstream product pipeline | Updater/signing primitives | Deployment-owned | Deployment-owned | Project-owned |
| Visual AI workflow runtime | N/A by design | Optional AI framework, not domain runtime | Agent/editor integrations | N/A | N/A | Core purpose | Agent runtime, not visual workflow parity |
| Portfolio product adapters | None found for the six audited projects | Unverified | Unverified | N/A | Unverified | Product-specific | Product-specific |
| Reproducible comparative benchmarks | Absent | Unverified here | Unverified here | Security audits/docs available | Unverified here | Unverified here | Unverified here |

## Thirteen contextual dimensions

These dimensions describe platform context only; they are not weighted or scored.

| Dimension | Verified context | Material unknown or gap |
| --- | --- | --- |
| Architecture | Product-neutral TypeScript contracts, React packages, Rust crates, edge services, and a Tauri template are tracked. | Cross-package consumer conformance and a stable third-party extension lifecycle are unverified. |
| APIs | Platform contracts, schemas, MCP, OTLP, LLM-gateway, updater, intake, and telemetry surfaces exist. | Compatibility guarantees, generated API references, and external consumer tests are incomplete. |
| Auth and security | Capability policies, keychain boundaries, signing tools, disclosure policy, secret scanning, and threat material exist. | Independent assessment, hosted key custody, native-boundary penetration testing, and end-to-end attestation remain unverified. |
| Reliability | Smoke scripts, readiness records, rollback guidance, and service status material exist. | Current SLO history, fault injection, restore drills, and retained cross-platform evidence are absent. |
| Performance | Package and native implementations are available for measurement. | No frozen startup, memory, bundle, update, extension-load, or CI benchmark establishes non-inferiority. |
| Observability | Telemetry, crash, and OTLP contracts/crates plus a telemetry edge service are tracked. | Production dashboards, alerts, trace completeness, privacy verification, and current service evidence are unverified. |
| Developer experience | IDE components, templates, package READMEs, schemas, and scripts provide reusable starting points. | A clean standalone onboarding run, versioned API site, extension kit, and migration policy are not proven. |
| Deployment and operations | Release tooling, installers, updater paths, package metadata, Worker services, and runbooks exist. | Signed cross-OS install/update/rollback proof and one coherent current release-evidence index are missing. |
| Connectors and integrations | MCP, OTLP, LLM-gateway, robotics, intake, sidecar, and dataset seams are present. | No maintained adapter or conformance test connects the six audited portfolio products. |
| Agent UX | Aura IDE Kit includes workbench primitives relevant to agent and evidence experiences. | No complete agent session, graph debugging, tool approval, or trace-to-evidence workflow is delivered here. |
| Human-in-the-loop | Proofline and IDE components can present evidence, status, problems, and consent surfaces. | Product-level review queues, adjudication, escalation, and audit closure remain consumer responsibilities and are unverified. |
| Evaluation | Unit tests, CI, schemas, verifier scripts, and readiness JSON provide local checks. | Full clean reruns, hosted matrices, comparative benchmarks, and immutable retained evidence are incomplete. |
| Domain workflows | Robotics and AI extension seams support specialized products without embedding their logic. | Domain workflows belong to consumers; no end-to-end portfolio integration is currently proven. |

## Scoring posture

No weighted score is applied. Weighting would imply Open Studio is competing as the same product category as the six audited applications or the visual AI builders, while the portfolio contract explicitly treats it as context. A future scored assessment should first freeze a category such as “open-source secure multi-surface studio substrate,” select eligible comparators, define hard gates, and gather the same benchmark evidence for every comparator. Until then, weighted criteria would be false precision.

Minimum hard gates for any future SOTA evaluation should include: reproducible clean build/test from the standalone repository; macOS/Windows/Linux hosted native matrix; signed install/update/rollback proof; independent security review; extension/adopter conformance; accessibility and performance benchmarks; versioned machine-readable evidence without contradictions; and at least two independently maintained non-flagship adopters.

## Standardized gap analysis

| Dimension | Current State | SOTA Target | Gap | Effort (S/M/L/XL) | Priority (P0-P3) |
| --- | --- | --- | --- | --- | --- |
| Evidence coherence | Versioned prose, staged readiness JSON, verifier inputs, and unavailable external artifacts are split across records. | One generated, versioned evidence index whose claims resolve to immutable artifacts and current machine states. | No single current release-truth view or stale-claim failure gate. | M | P0 |
| Standalone reproducibility | Package/test scripts exist, but some security commands retain outer-monorepo paths; no clean rerun was performed here. | Fresh clone executes documented build, test, security, docs, and dry-run release gates without ambient parent layout. | Environment-dependent commands and unverified setup. | M | P0 |
| Portfolio integration | No dependency, adapter, or conformance evidence for the six audited products. | Versioned adapters/contracts with end-to-end tests for selected product integrations. | Relevance is architectural only. | L | P0 |
| Hosted native matrix | Tauri/native keychain/crash/GPU workflows and runbooks exist; tracked records say execution remains pending or blocked. | Required macOS, Windows, Linux, architecture, native-store, crash, and hardware jobs green and branch-protected. | Cross-platform behavior is not continuously proven. | XL | P0 |
| CI coverage | Root CI covers packages, Rust, DCO, and gitleaks. | Pull-request CI runs all portable release/security/service/schema/docs gates with artifact retention. | Many critical verifiers are optional/manual. | L | P0 |
| Windows distribution | Manifests and signer support exist; machine evidence requires external identity, EV/managed signing, real hashes/ProductCodes, and clean installs. | Reproducible signed MSI/MSIX, winget validation/publication, install/upgrade/uninstall proof. | Public Windows trust chain is incomplete. | XL | P1 |
| Supply-chain assurance | SBOM, audit, license, signing and secret-scan controls exist; historical findings and hosted custody remain open in prose. | SLSA-style provenance/attestation, protected custody, current dependency gates, resolved/baselined history findings. | End-to-end provenance and custody proof are incomplete. | L | P1 |
| Extension architecture | MCP/OTLP/LLM and robotics hooks exist as crates/contracts. | Stable extension SDK, lifecycle/permissions model, compatibility suite, catalog and migration policy. | Hooks are not a demonstrated third-party extension platform. | XL | P1 |
| Operational reliability | Worker services, status files, smoke scripts and support SLA exist. | SLOs, synthetic tests, rollback drills, incident evidence and retained production telemetry for every critical service. | Historical deployment prose is not current operational proof. | L | P1 |
| Security validation | Threat/runbook/checklist material and local tests are present. | Independent audit, fuzzing, native boundary penetration tests, closure tracking and public advisory process evidence. | Third-party and native-host assurance is incomplete. | L | P1 |
| Accessibility and UX parity | Component tests include semantics/keyboard/axe coverage. | End-to-end screen-reader, keyboard, zoom, high-contrast, performance and usability evidence across products/OSes. | Package-level tests do not prove full Studio experiences. | L | P1 |
| Documentation evidence | Docusaurus scaffold and broad docs exist. | Published, searchable, versioned API/architecture/runbook docs with executable examples and link checks. | Hosted search and current evidence linkage are incomplete. | M | P2 |
| Adoption and ecosystem | Three public packages are claimed; named flagships are documented. | Measured external adoption, maintainers, extension authors, compatibility policy and upgrade success. | No current independent adoption/community dataset. | XL | P2 |
| Comparative performance | No frozen workbench/startup/package/CI benchmarks. | Reproducible cold/warm startup, memory, bundle, build, update and extension-load comparisons. | No non-inferiority evidence against category leaders. | L | P2 |
| Governance enforcement | DCO, CODEOWNERS, RFC and cadence documents exist. | Protected settings and policy checks are machine-verified in every owning repository. | Root/platform enforcement is described as externally unverifiable. | M | P2 |

## Concrete P0/P1 paths

### P0 — establish trustworthy, reproducible platform evidence

1. **Create one evidence truth pipeline.** Generate a tracked index from readiness JSON and immutable artifacts; fail if prose status exceeds machine status, a referenced artifact is missing, dates exceed freshness policy, or a version is mixed across evidence sets.
2. **Make the repository standalone.** Remove parent-layout assumptions from commands, document exact toolchains, and prove `install → build → typecheck → test → security → docs → release dry run` in a clean container or ephemeral runner.
3. **Expand required CI.** Add portable edge-service tests, schema validation, docs build/link checks, package packing/consumer installs, release verifier tests, and readiness consistency checks to protected pull-request workflows.
4. **Run the native matrix.** Execute Tauri template, keychain, crash, updater, deep-link, install/rollback and architecture jobs on real macOS, Windows and Linux runners; retain logs, hashes, environment metadata and artifacts.
5. **Prove one thin portfolio integration before broad claims.** Choose a protocol-bounded path (for example, sigcrawl MCP tools or AgentGraph OTLP traces), pin versions, add an adapter and conformance fixture, threat-model it, and exercise it in a packaged Studio build. Repeat only after the first path is maintainable.

### P1 — close distribution, security and ecosystem gaps

1. **Complete Windows trust and distribution.** Use controlled EV or managed signing, replace manifest placeholders, validate signed artifacts, run clean install/upgrade/uninstall tests, and capture winget submission evidence.
2. **Harden supply-chain custody.** Produce artifact attestations/provenance, test key rotation and revocation, resolve or formally baseline historical secret findings, and enforce dependency/advisory freshness.
3. **Turn extension seams into a platform.** Specify lifecycle, permissions, discovery, version negotiation, isolation, migration and deprecation; publish a reference extension plus compatibility kit.
4. **Commission independent validation.** Audit Tauri IPC/capabilities, updater/signing, intake, telemetry/crash privacy, Worker boundaries, and installer paths; close findings with public references where safe.
5. **Prove complete UX.** Run end-to-end accessibility and performance testing on packaged applications, not only component tests, and publish reproducible baselines.
6. **Operationalize the services.** Define SLOs, alerts, synthetic coverage, restore/rollback drills, retention/privacy controls and incident review artifacts for each edge service.

## Roadmap

| Phase | Exit criteria | Indicative scope |
| --- | --- | --- |
| 0. Evidence reset | Every version/scope is normalized, every claim resolves, and stale evidence fails automatically. | P0 evidence index, freshness policy, missing-path cleanup, version normalization. |
| 1. Reproducible core | A clean standalone clone passes all portable gates in protected CI. | Toolchain/container setup, script portability, broader CI, package consumer tests. |
| 2. Native release proof | Cross-OS native/security matrix and Windows signed distribution pass with retained artifacts. | Real runners, keychain/crash/updater/install tests, signing custody, winget path. |
| 3. Portfolio proof | At least two of the six products consume versioned platform interfaces with conformance tests and named owners. | Thin adapters, threat models, compatibility policy, packaged end-to-end fixtures. |
| 4. Ecosystem and comparison | Extension SDK is stable; independent adopters and frozen comparator benchmarks exist. | Plugin lifecycle/catalog, independent audit, adoption metrics, reproducible benchmarks. |
| 5. Verdict review | Every hard gate passes and critical dimensions lead/tie or show non-inferiority. | Independent evidence review; only then consider a scored SOTA verdict. |

## Provenance, staleness, and explicit unknowns

### Repository provenance

- Open Studio evidence is anchored to commit `31623cc414a1d8efcbce1cfffe6aa3b8c5864ac6`; untracked generated `docs-template/.docusaurus/` and `docs-template/build/` were excluded and preserved.
- The six project identities/categories were taken from the portfolio products manifest in AgentGraph. Observed repository HEADs were: AgentGraph `f4f88b2`, PixelJury `8c8aaa0`, AgentFlow `5791c07`, DocOS `10a23de`, memlayer `b4d9112`, and sigcrawl `3e7db97`.
- Several sibling worktrees had unrelated uncommitted changes. Category statements rely on stable README/manifests where possible; no sibling file was modified.
- All six intended product dossier files were absent from the six pinned HEAD commits. Untracked worktree drafts are not branch content, and AgentGraph’s checked-in index still described Task 3 evidence as pending; completion/publication at those commits is therefore **unverified**.

### Staleness policy

- Repository structure and imports become stale on the next relevant commit.
- Package registry, GitHub release, hosted service, CI, branch protection, marketplace and signing facts should be refreshed within 30 days and at every release candidate.
- Security advisories, dependency audits, service health and signing custody should be refreshed within 7 days for a release decision.
- Comparative feature claims should be rechecked against official sources at scoring freeze and immediately before any verdict.
- Historical May 2026 command results remain provenance only; they must not be represented as current pass results.

### Unverified in this assessment

- Public npm readback and clean external installs.
- Any live Cloudflare, Sentry, GitHub release, Homebrew, winget, schema, installer, update, intake, telemetry or DNS state.
- macOS notarization, Linux signatures, Windows signing, native keychain behavior, crash capture, GPU decode, or clean OS installs.
- Full repository build, tests, security suite, docs build, release dry run, or hosted workflows on 2026-07-18.
- Real usage of Open Studio by any of the six audited projects.
- Comparator feature parity, performance, security posture, community size, or deployment quality beyond cited primary-source descriptions.

## Bottom line

Open Studio Platform is a substantive and unusually policy-aware shared substrate, not an empty umbrella repository. Its strongest evidence is the breadth of tracked implementation and the explicit separation between declarations, native/network effects, consent, and product workflows. Its largest weakness is not a missing feature checklist; it is the absence, in the current snapshot, of one normalized, current, reproducible view across versioned readiness records, external evidence inputs, and cross-platform operation.

Accordingly, this dossier supplies portfolio context only. No source remediation is included, full validation remains pending, and no SOTA claim is supported.

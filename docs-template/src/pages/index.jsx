import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

const links = [
  {
    href: "/next/install",
    label: "Install",
    description: "Choose the browser IDE, desktop app, or CLI companion.",
  },
  {
    href: "/next/quickstart",
    label: "Quickstart",
    description:
      "Open the Helpful Response Evaluation project and score a sample.",
  },
  {
    href: "/next/concepts/project-as-folder",
    label: "Project model",
    description: "Understand the local-first rubric folder and export layout.",
  },
  {
    href: "/next/api/ipc",
    label: "Integrations",
    description: "Review IPC, deep-link, CLI, and framework-adapter contracts.",
  },
];

export default function Home() {
  return (
    <Layout
      title="Rubric Studio Open"
      description="The local-first IDE for criterion-level evaluation rubrics."
    >
      <main className="rubric-docs-home">
        <section className="rubric-docs-hero">
          <div className="rubric-docs-hero__copy">
            <p className="rubric-docs-eyebrow">
              <span className="rubric-docs-mark">a</span>
              AuraOne / Rubric Studio Open
            </p>
            <h1>The local-first IDE for evaluation rubrics.</h1>
            <p className="rubric-docs-lede">
              Author criterion-level rubrics, score sample outputs, calibrate
              judges against gold labels, inspect semantic diffs, and export the
              artifacts your reviewers can defend.
            </p>
            <div className="button-group margin-top--lg">
              <Link
                className="button button--primary button--lg"
                to="/next/quickstart"
              >
                Start quickstart
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="/next/install"
              >
                Install options
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="https://github.com/auraoneai/rubric-studio-open/releases/download/v0.2.0/Rubric.Studio.Open_0.2.0_aarch64.dmg"
              >
                Download macOS DMG
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="https://rubric-studio.auraone.ai"
              >
                Launch browser IDE
              </Link>
            </div>
          </div>
          <div
            className="rubric-docs-preview"
            aria-label="Rubric Studio Open interface preview"
          >
            <div className="rubric-docs-preview__topbar">
              <span className="rubric-docs-mark">a</span>
              <span>AuraOne / Rubric Studio</span>
              <span className="rubric-docs-status">local / synced</span>
            </div>
            <div className="rubric-docs-tabs">
              <span className="active">1 Authoring</span>
              <span>2 Preview</span>
              <span>3 Calibration</span>
              <span>4 Diff</span>
              <span>5 Export</span>
            </div>
            <div className="rubric-docs-preview__body">
              <aside>
                <p className="label">Project</p>
                <h3>Helpful Response Evaluation</h3>
                {["Safety", "Helpfulness", "Evidence quality"].map((group) => (
                  <div className="rubric-docs-tree" key={group}>
                    <strong>{group}</strong>
                    <span>Safe refusal</span>
                    <span>Cites uncertainty</span>
                  </div>
                ))}
              </aside>
              <section>
                <p className="label">
                  Evidence quality / cites-uncertainty.toml
                </p>
                <h2>Cites uncertainty</h2>
                <p className="criterion">
                  The response names uncertainty, missing information, or
                  assumptions when the answer depends on context.
                </p>
                <div className="rubric-docs-metrics">
                  <span>
                    <b>Scale</b>binary
                  </span>
                  <span>
                    <b>Weight</b>0.20
                  </span>
                  <span>
                    <b>Status</b>TODO
                  </span>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="rubric-docs-links">
          {links.map((item) => (
            <article key={item.href}>
              <Link className="card padding--lg" to={item.href}>
                <h2>{item.label}</h2>
                <p>{item.description}</p>
              </Link>
            </article>
          ))}
        </section>
      </main>
    </Layout>
  );
}

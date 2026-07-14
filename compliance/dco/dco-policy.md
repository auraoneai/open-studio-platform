# DCO Policy

AuraOne Open uses the Developer Certificate of Origin for contributions. No CLA is required.

Every commit contributed to the Open Studio Platform or a flagship repository must include a `Signed-off-by:` trailer:

```text
Signed-off-by: Name <email@example.com>
```

Contributors can add the trailer with:

```bash
git commit -s
```

Contributors who want the sign-off to be automatic can add a local Git alias:

```bash
git config --global alias.cs "commit -s"
git cs
```

Maintainers should point contributors to this alias instead of asking them to sign a CLA.

## Enforcement

- The DCO GitHub App must be installed on the platform repo and all three flagship repos.
- The security workflow template includes a local DCO check for pull request commit ranges.
- Maintainers must not squash or rebase in a way that removes sign-off trailers.

## Why DCO

DCO preserves a clear contribution attestation while avoiding CLA friction for researchers, lab engineers, and independent open-source contributors.

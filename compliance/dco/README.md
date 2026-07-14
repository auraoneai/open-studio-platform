# DCO Enforcement

AuraOne Open repositories use Developer Certificate of Origin sign-off trailers.
No CLA is required.

Required contributor command:

```bash
git commit -s
```

Optional local alias:

```bash
git config --global alias.cs "commit -s"
git cs
```

The repository release template includes `.github/workflows/dco.yml`. The
flagship repository settings require the DCO status check before merge.

# Rubric Studio Open Privacy Notes

Date: 2026-05-13

Rubric Studio Open is local-first. Telemetry and crash reporting are default off.
The app does not send rubric content, prompts, samples, calibration data,
criterion text, file paths, hostnames, emails, API keys, tokens, or secrets in
telemetry.

Network destinations:

| Destination                             | Purpose                        | Default                        |
| --------------------------------------- | ------------------------------ | ------------------------------ |
| `https://updates.auraone.ai/`           | Signed update manifest check   | Enabled by app update settings |
| `https://intake.auraone.ai/v1/packets/` | Explicit AuraOne intake export | User click only                |
| Sentry project DSN                      | Crash reports                  | Off until opted in             |
| Telemetry endpoint                      | Anonymous product events       | Off until opted in             |
| User-configured model providers         | BYO scoring                    | User-configured only           |

The browser edition follows the website privacy policy and cannot access local
sidecars or the OS keychain.

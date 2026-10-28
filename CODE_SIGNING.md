# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## What is signed

Only binaries built from this repository's source by the GitHub Actions workflow
[`.github/workflows/release.yml`](.github/workflows/release.yml) on GitHub-hosted runners:

- `Boom.exe` (the application)
- `Boom-Setup-<version>.exe` (the installer, which also installs `Uninstall.exe`)

Every signing request is approved manually by an approver before the release is published.
Third-party components bundled by PyInstaller (Python runtime, boto3, Flask, …) are open source and are not signed by this project.

## Team roles

| Role | Members |
|---|---|
| Committers and reviewers | [Repository members](https://github.com/tsunat10101steam-cyber/boom/graphs/contributors) — [@tsunat10101steam-cyber](https://github.com/tsunat10101steam-cyber) |
| Approvers | Repository owner — [@tsunat10101steam-cyber](https://github.com/tsunat10101steam-cyber) |

All team members use multi-factor authentication for GitHub and SignPath.
Changes from anyone outside the team (pull requests) are reviewed by a reviewer before they are merged.

## Privacy policy

Boom runs entirely on your PC. It has no telemetry and does not send information to the authors or any other system, except:

- **AWS APIs** in your own AWS account, using the credentials you provide, to list, create and delete your resources and to read your costs (Cost Explorer).
- **GitHub** (`api.github.com`, `github.com`) to check for and download new Boom releases. Automatic update checks can be turned off in Settings.

Access keys you choose to remember are stored only on your PC, encrypted with your Windows account (DPAPI).
The privacy policies of [AWS](https://aws.amazon.com/privacy/) and [GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) apply to those connections.

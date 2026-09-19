# Security Policy

## Supported Versions

Only the current release line receives security updates. Fixes are published
as a new patch on that line; older lines are end-of-life and will not be
patched, even for critical advisories.

| Version | Supported          | Notes                           |
| ------- | ------------------ | ------------------------------- |
| 25.9.x  | :white_check_mark: | Current release line            |
| 25.7.x  | :x:                | End-of-life — upgrade to 25.9.x |
| 25.4.x  | :x:                | End-of-life — upgrade to 25.9.x |

Upgrading within the current line is safe: as of 25.9.21 this project follows
[SemVer](https://semver.org/), so patch releases contain no API or behavior
changes. See the [Versioning](README.md#versioning) section for details.

## Reporting a Vulnerability

Disclose vulnerabilities via email — owpz.overreact309@passmail.net

Please include the affected version, a description of the issue, and steps to
reproduce it. Do not open a public issue for an undisclosed vulnerability.

You can expect an acknowledgement of your report. If the issue is confirmed, a
fix will be released on the current supported line and the advisory credited
unless you ask otherwise.

## Automated Scanning

This repository runs automated security checks on every push and pull request,
and weekly on a schedule:

- **npm audit** at `moderate` and above
- **CodeQL** static analysis (GitHub default code scanning setup)
- **Dependency Review** on pull requests
- **OpenSSF Scorecard**
- **Dependabot** for dependency updates

GitHub Actions are pinned to commit SHAs, and CI installs with
`--ignore-scripts` so dependency lifecycle scripts do not execute in the build.

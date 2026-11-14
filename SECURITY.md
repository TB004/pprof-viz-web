# Security Policy

## Supported versions

Only the latest release receives security fixes, both the static site tarball and the
`ghcr.io/tb004/pprof-viz-web` image tagged `latest`. Please update before reporting.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/TB004/pprof-viz-web/security/advisories/new)
instead, with the affected version, steps to reproduce and what an attacker gains.

This is a project maintained by one person in their spare time. You can expect a first
reply within a week; a fix and a published advisory follow once the issue is confirmed,
and you are credited in it unless you prefer not to be.

## Scope

In scope is everything in this repository: the web app, the `.ppvz` and `.ppvzb` file
handling (imported files are untrusted input), the service worker, and the container
image including its Caddy configuration and Content Security Policy.

Issues in the collector embedded in your Go service belong to that project. If you are
unsure which side a problem is on, report it here.

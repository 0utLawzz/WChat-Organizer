# Security Policy

## Supported versions

The `main` branch is the only supported line of development.

## Reporting a vulnerability

Please open a private security advisory on GitHub, or contact the maintainer
via the profile listed on the repository. Do not open public issues for
sensitive reports.

## Secrets

- Never commit Supabase secret keys or Google service-account credentials.
- Publishable / anon keys may be used in the browser; row-level security must
  remain enabled on Supabase tables.

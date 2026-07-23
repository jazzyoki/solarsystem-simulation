# GitHub Actions Static Deployment Design

- **Date:** 2026-07-23
- **Status:** Approved design

## Summary

Deploy the Vite production build to the existing Debian server whenever `main`
changes. GitHub Actions builds and tests the application; the server only serves
the finished static files through Nginx. This replaces the current Nginx proxy
to the Vite development server on port 5173.

## Architecture

The workflow is triggered by pushes to `main` and runs on GitHub-hosted Ubuntu.
It checks out the triggering revision, installs dependencies with `npm ci`, runs
`npm test`, and runs `npm run build`.

After a successful build, the workflow connects to the Debian server over SSH.
It uploads `dist/` to a revision-specific release directory under the existing
repository:

```text
~/dev/solar-system-simulation/.deploy/releases/<commit SHA>/
```

The workflow atomically updates this symlink after the upload completes:

```text
~/dev/solar-system-simulation/.deploy/current
```

Nginx serves the symlink target directly. A failed build or upload never changes
`current`, so the previously deployed version remains available.

## Server Configuration

The repository includes an Nginx site template. During deployment, the workflow
installs it with passwordless `sudo`, enables it, validates the full Nginx
configuration, and reloads Nginx only when validation succeeds.
It temporarily moves the current Vite-proxy site symlink at
`/etc/nginx/sites-enabled/solar` during validation and restores it if the new
site is invalid.

The site configuration:

- Listens on port `5199`, preserving the existing externally routed port.
- Uses `solar.yokicloud.net` as `server_name`.
- Sets `root` to `~/dev/solar-system-simulation/.deploy/current`.
- Serves static Vite assets and falls back to `/index.html` for application
  routes.
- Replaces the old upstream proxy to Vite on port 5173.

Node.js, npm, and a Vite process are not required on the server after this
change. The deployment user must be able to traverse the project path, and Nginx
must be able to read it.

## Workflow Contract

The workflow uses these GitHub Actions repository secrets:

- `DEPLOY_HOST`: Debian server hostname or IP address.
- `DEPLOY_USER`: SSH account that owns `~/dev/solar-system-simulation` and has
  passwordless `sudo`.
- `DEPLOY_SSH_KEY`: private key authorized for that account.
- `DEPLOY_KNOWN_HOSTS`: the deploy server's pinned OpenSSH `known_hosts` entry.

SSH uses port 22. The workflow pins the target repository path to
`~/dev/solar-system-simulation`; it does not pull or modify the server-side Git
checkout. The GitHub runner is the source of the production build, ensuring the
published assets correspond exactly to the triggering commit.

## Error Handling

- Dependency, test, or build failures stop before SSH is attempted.
- Upload failures leave the existing `current` symlink unchanged.
- The release directory is only promoted after its upload completes.
- `nginx -t` must succeed before reloading Nginx; a configuration error keeps the
  existing Nginx process configuration active.
- The workflow serializes deployments so overlapping pushes cannot race to update
  `current`.

## Verification

- Add workflow-focused checks for its trigger, build commands, deploy paths, and
  required secrets.
- Run `npm test` and `npm run build` locally.
- On a server test deployment, confirm `nginx -t` succeeds and the Vite process
  is no longer needed.
- Confirm `http://solar.yokicloud.net:5199/` serves the new revision.
- Confirm a deliberately failed build leaves the prior release being served.

## Non-Goals

- HTTPS certificate provisioning or renewal.
- Server-side source builds, dependency installation, or process supervision.
- Automatic pruning of older release directories.
- Deployment previews for pull requests.

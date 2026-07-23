# GitHub Actions Static Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy tested Vite static builds from `main` to the Debian server and serve them through Nginx instead of the Vite development server.

**Architecture:** GitHub Actions builds the exact pushed revision and transfers its `dist/` directory over SSH to a SHA-named release directory below the remote checkout. A symlink swap promotes the release atomically; an Nginx template is rendered remotely with the deploy user's absolute home directory and serves the current release on port 5199.

**Tech Stack:** GitHub Actions, OpenSSH, GNU tar/coreutils, Nginx, Node.js/npm, Vite, Vitest

## Global Constraints

- Trigger production deployment only for pushes to `main`.
- Build only on the GitHub-hosted runner with `npm ci`, `npm test`, and `npm run build`; do not run Node.js, npm, or Vite on the server.
- Use `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS` GitHub repository secrets; use SSH port 22.
- Deploy to `~/dev/solar-system-simulation/.deploy/releases/<commit SHA>` and atomically point `~/dev/solar-system-simulation/.deploy/current` at the fully uploaded release.
- Serve `solar.yokicloud.net` on port 5199 from the `current` release symlink, replacing the existing proxy to port 5173.
- Validate Nginx with `nginx -t` before reloading it through passwordless `sudo`.
- Replace the existing Nginx site symlink at `/etc/nginx/sites-enabled/solar`, restoring it if the new site fails validation.
- Do not add HTTPS provisioning, server-side builds, deployment previews, release pruning, or dependencies.

## File Structure

- Create `.github/workflows/deploy.yml`: serial production build, test, transfer, release promotion, and Nginx activation workflow.
- Create `deploy/nginx/solar-system-simulation.conf`: Nginx static-site template containing an absolute-path placeholder rendered by the remote shell.
- Create `tests/deployment.test.mjs`: Vitest regression checks for the workflow and Nginx template contract.
- Modify `README.md`: replace development-proxy instructions with server prerequisites, GitHub secrets, and static deployment behavior.

---

### Task 1: Add The Static Deployment Contract And Automation

**Files:**
- Create: `tests/deployment.test.mjs`
- Create: `deploy/nginx/solar-system-simulation.conf`
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md:34-72`

**Interfaces:**
- Consumes: `package.json` commands `npm test` and `npm run build`; repository secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`; the remote checkout at `~/dev/solar-system-simulation`; passwordless `sudo` for `DEPLOY_USER`.
- Produces: a `main`-only GitHub Actions deployment workflow, a parameterized Nginx static-site configuration, and a deployment guide.

- [ ] **Step 1: Write the failing deployment-contract test**

Create `tests/deployment.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('production deployment configuration', () => {
  it('builds and atomically deploys main through SSH', () => {
    const workflow = readProjectFile('.github/workflows/deploy.yml');

    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('DEPLOY_HOST');
    expect(workflow).toContain('DEPLOY_USER');
    expect(workflow).toContain('DEPLOY_SSH_KEY');
    expect(workflow).toContain('DEPLOY_KNOWN_HOSTS');
    expect(workflow).toContain('releases/${{ github.sha }}');
    expect(workflow).toContain('mv -Tf');
    expect(workflow).toContain('nginx -t');
    expect(workflow).toContain('systemctl reload nginx');
    expect(workflow).toContain('concurrency:');
  });

  it('serves the current static release through Nginx', () => {
    const nginxConfig = readProjectFile('deploy/nginx/solar-system-simulation.conf');

    expect(nginxConfig).toContain('listen 5199;');
    expect(nginxConfig).toContain('server_name solar.yokicloud.net;');
    expect(nginxConfig).toContain('root __PROJECT_ROOT__/.deploy/current;');
    expect(nginxConfig).toContain('try_files $uri $uri/ /index.html;');
  });
});
```

- [ ] **Step 2: Run the deployment-contract test to verify it fails**

Run: `npm test -- tests/deployment.test.mjs`

Expected: FAIL with `ENOENT` because `.github/workflows/deploy.yml` does not yet exist.

- [ ] **Step 3: Add the Nginx template**

Create `deploy/nginx/solar-system-simulation.conf`:

```nginx
server {
    listen 5199;
    server_name solar.yokicloud.net;

    root __PROJECT_ROOT__/.deploy/current;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

`__PROJECT_ROOT__` is intentionally not an Nginx variable. The remote deployment command replaces it with `$HOME/dev/solar-system-simulation`, because Nginx does not expand `~` in a `root` directive.

- [ ] **Step 4: Add the deployment workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: production-deployment
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Configure SSH
        env:
          DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          install -d -m 700 ~/.ssh
          install -m 600 /dev/null ~/.ssh/id_ed25519
          printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/id_ed25519
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 600 ~/.ssh/known_hosts

      - name: Upload and promote release
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
        run: |
          PROJECT_DIR="dev/solar-system-simulation"
          RELEASE_DIR="$PROJECT_DIR/.deploy/releases/${{ github.sha }}"
          ssh -o StrictHostKeyChecking=yes "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p ~/$PROJECT_DIR/.deploy/releases"
          ssh -o StrictHostKeyChecking=yes "$DEPLOY_USER@$DEPLOY_HOST" "rm -rf ~/$RELEASE_DIR.tmp && mkdir -p ~/$RELEASE_DIR.tmp"
          tar -C dist -czf - . | ssh -o StrictHostKeyChecking=yes "$DEPLOY_USER@$DEPLOY_HOST" "tar -xzf - -C ~/$RELEASE_DIR.tmp"
          ssh -o StrictHostKeyChecking=yes "$DEPLOY_USER@$DEPLOY_HOST" "rm -rf ~/$RELEASE_DIR && mv ~/$RELEASE_DIR.tmp ~/$RELEASE_DIR && ln -sfn releases/${{ github.sha }} ~/$PROJECT_DIR/.deploy/next && mv -Tf ~/$PROJECT_DIR/.deploy/next ~/$PROJECT_DIR/.deploy/current"

      - name: Activate Nginx site
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
        run: |
          scp -o StrictHostKeyChecking=yes deploy/nginx/solar-system-simulation.conf "$DEPLOY_USER@$DEPLOY_HOST:/tmp/solar-system-simulation.conf"
          ssh -o StrictHostKeyChecking=yes "$DEPLOY_USER@$DEPLOY_HOST" 'set -eu; PROJECT_ROOT="$HOME/dev/solar-system-simulation"; sed "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" /tmp/solar-system-simulation.conf | sudo tee /etc/nginx/sites-available/solar-system-simulation >/dev/null; if [ -e /etc/nginx/sites-enabled/solar ]; then sudo mv /etc/nginx/sites-enabled/solar /etc/nginx/sites-enabled/solar.previous; fi; sudo ln -sfn /etc/nginx/sites-available/solar-system-simulation /etc/nginx/sites-enabled/solar-system-simulation; if ! sudo nginx -t; then sudo rm -f /etc/nginx/sites-enabled/solar-system-simulation; if [ -e /etc/nginx/sites-enabled/solar.previous ]; then sudo mv /etc/nginx/sites-enabled/solar.previous /etc/nginx/sites-enabled/solar; fi; exit 1; fi; sudo rm -f /etc/nginx/sites-enabled/solar.previous; sudo systemctl reload nginx'
```

The workflow intentionally completes the upload before updating `current`. The `mv -Tf` rename is atomic when both symlinks are on the same filesystem. `cancel-in-progress: false` makes concurrent pushes wait rather than interrupt a release that has started publishing.
The Nginx activation temporarily moves `/etc/nginx/sites-enabled/solar`; it
restores that Vite-proxy symlink if `nginx -t` rejects the new configuration.

- [ ] **Step 5: Replace the development-proxy README section**

Replace `README.md`'s `## Deploying with Nginx` section through the line before `## Implementation Notes` with:

```markdown
## Production Deployment

Pushing to `main` builds, tests, and deploys the static Vite output through the
GitHub Actions workflow. The Debian server only needs Nginx and an SSH account
with passwordless `sudo`; it does not run Vite or require Node.js.

The server checkout must be located at `~/dev/solar-system-simulation`. Add
these GitHub Actions repository secrets:

- `DEPLOY_HOST`: server hostname or IP address
- `DEPLOY_USER`: SSH account that owns the checkout
- `DEPLOY_SSH_KEY`: private key authorized for that account
- `DEPLOY_KNOWN_HOSTS`: pinned server host key, generated with
  `ssh-keyscan -H <DEPLOY_HOST>` from a trusted network

Each deployment uploads the built `dist/` assets into
`~/dev/solar-system-simulation/.deploy/releases/<commit SHA>/`, then atomically
updates `.deploy/current`. Nginx serves that symlink on port `5199` for
`solar.yokicloud.net`, replacing the former proxy to the Vite development server.

The workflow validates the Nginx configuration before reloading it. If the
build or upload fails, the previously deployed release remains active.
```

- [ ] **Step 6: Run the focused contract test to verify it passes**

Run: `npm test -- tests/deployment.test.mjs`

Expected: PASS with 2 passing tests.

- [ ] **Step 7: Run the full verification suite**

Run: `npm test && npm run build`

Expected: all Vitest tests pass and Vite creates `dist/` without TypeScript errors.

- [ ] **Step 8: Inspect the completed change set**

```bash
git diff --check
```

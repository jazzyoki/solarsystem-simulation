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

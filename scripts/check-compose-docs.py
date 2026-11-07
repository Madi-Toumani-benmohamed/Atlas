#!/usr/bin/env python3
"""Render documented Compose examples; never start containers or print secrets."""

import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
BASE = ['docker-compose.yml', 'docker-compose.auth.yml']
CONFIG_KEYS = (
    'POSTGRES_PASSWORD', 'ATLAS_DATABASE_PASSWORD', 'ATLAS_PORT', 'ATLAS_DOMAIN',
    'ATLAS_ORIGIN', 'ATLAS_INSECURE_HTTP', 'ATLAS_REGISTRATION',
    'ATLAS_RESTORE_DATABASE', 'COMPOSE_FILE', 'COMPOSE_PROJECT_NAME',
)


def render(files, overrides=None, *, missing_restore=False):
    env = {key: value for key, value in os.environ.items() if key not in CONFIG_KEYS}
    env.update(overrides or {})
    command = ['docker', 'compose', '--env-file', '.env.example', '-p', 'atlas-docs-check']
    for name in files:
        command += ['-f', name]
    command += ['config', '--format', 'json']
    result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=30)
    if missing_restore:
        if result.returncode == 0:
            raise ValueError('restore configuration silently accepted a missing database name')
        return None
    if result.returncode:
        raise ValueError('documented Compose configuration could not be rendered')
    return json.loads(result.stdout)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_common(config):
    api = config['services']['api']
    db = config['services']['db']
    require(not db.get('ports'), 'documented stack publishes PostgreSQL')
    require(api['environment']['ATLAS_HEALTHCHECK_PATH'] == '/readyz', 'auth stack lacks readiness')
    dsn = urlsplit(api['environment']['DATABASE_URL'])
    require(dsn.hostname == 'db' and dsn.username == 'atlas' and dsn.port == 5432, 'unexpected DB connection role/host')
    require(dsn.password != db['environment']['POSTGRES_PASSWORD'], 'application and admin credentials are shared')
    require(api.get('read_only') is True, 'API root filesystem is not read-only')


def main():
    loopback = render(BASE + ['docker-compose.loopback.yml'], {
        'ATLAS_ORIGIN': 'http://127.0.0.1:8080', 'ATLAS_INSECURE_HTTP': 'true',
        'ATLAS_REGISTRATION': 'true',
    })
    check_common(loopback)
    ports = loopback['services']['api'].get('ports', [])
    require(len(ports) == 1 and ports[0].get('host_ip') == '127.0.0.1'
            and ports[0]['target'] == 8080 and str(ports[0]['published']) == '8080',
            'laboratory API does not bind to documented loopback address')
    tls = render(BASE + ['docker-compose.tls.yml'])
    check_common(tls)
    require(not tls['services']['api'].get('ports'), 'TLS stack publishes the API directly')
    proxy_ports = tls['services']['proxy']['ports']
    require({str(port['published']) for port in proxy_ports} == {'80', '443'}, 'TLS proxy ports differ from guide')
    restored = render(BASE + ['docker-compose.tls.yml', 'docker-compose.restore.yml'], {
        'ATLAS_RESTORE_DATABASE': 'atlas_restore_docs_check',
    })
    check_common(restored)
    require(urlsplit(restored['services']['api']['environment']['DATABASE_URL']).path == '/atlas_restore_docs_check',
            'restore profile does not select the restored database')
    require(restored['services']['db'] == tls['services']['db'] and restored['volumes'] == tls['volumes'],
            'restore profile changes the DB service or project volumes')
    require(not restored['services']['api'].get('ports'), 'restore profile exposes HTTP in TLS stack')
    render(BASE + ['docker-compose.restore.yml'], missing_restore=True)
    print('Documented Compose profiles: loopback, TLS, restored DB and missing-name guard passed; no containers started.')


if __name__ == '__main__':
    main()

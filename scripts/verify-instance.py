#!/usr/bin/env python3
"""Exercise a fresh isolated Compose instance and encrypted recovery; preserve volumes."""
import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent


class VerificationError(RuntimeError):
    pass


def require(condition, code):
    if not condition:
        raise VerificationError(code)


class Lab:
    def __init__(self, directory, image, postgres_image):
        self.directory = directory.resolve()
        require(not self.directory.is_relative_to(ROOT), 'work_directory_must_be_outside_checkout')
        self.directory.mkdir(mode=0o700, parents=False)  # Refuse reuse of any existing directory.
        self.owns_project = False
        self.project = 'atlas-recette-' + uuid.uuid4().hex[:16]
        self.env = os.environ.copy()
        for key in ('DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH',
                    'COMPOSE_PROFILES', 'COMPOSE_PATH_SEPARATOR', 'ATLAS_RESTORE_DATABASE'):
            self.env.pop(key, None)
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        self.env.update(DOCKER_HOST='unix:///var/run/docker.sock', COMPOSE_PROJECT_NAME=self.project,
                        POSTGRES_PASSWORD=secrets.token_hex(32), ATLAS_DATABASE_PASSWORD=secrets.token_hex(32),
                        ATLAS_REGISTRATION='true', ATLAS_INSECURE_HTTP='true', ATLAS_PORT=str(port),
                        ATLAS_ORIGIN=f'http://127.0.0.1:{port}')
        config = self.directory / 'lab.yml'
        config.write_text(json.dumps({'services': {
            'api': {'image': image, 'restart': 'no'},
            'db': {'image': postgres_image, 'restart': 'no'},
        }}))
        files = ['docker-compose.yml', 'docker-compose.auth.yml', 'docker-compose.loopback.yml']
        self.base_files = ':'.join(str(ROOT / file) for file in files) + ':' + str(config)
        self.env['COMPOSE_FILE'] = self.base_files
        env_file = self.directory / 'lab.env'
        with open(env_file, 'x', opener=lambda path, flags: os.open(path, flags, 0o600)) as output:
            for key in ('POSTGRES_PASSWORD', 'ATLAS_DATABASE_PASSWORD'):
                output.write(f'{key}={self.env[key]}\n')
        self.env['COMPOSE_ENV_FILES'] = str(env_file)
        self.env['ATLAS_ARCHIVE_BIN'] = str(self.directory / 'archive')
        self.env['ATLAS_BACKUP_KEY_FILE'] = str(self.directory / 'archive.key')
        self.env['ATLAS_BACKUP_DIR'] = str(self.directory / 'backups')
        self.env['ATLAS_DATABASE_NAME'] = 'atlas'
        self.jar = http.cookiejar.CookieJar()
        # Never send loopback synthetic credentials through an inherited HTTP proxy.
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(self.jar))
        self.origin = None

    def run(self, args, *, expected=0, timeout=120):
        result = subprocess.run(args, cwd=ROOT, env=self.env, capture_output=True, timeout=timeout)
        matched = result.returncode == expected if expected is not None else result.returncode != 0
        if not matched:
            diagnostic = self.directory / 'command-failure.log'
            with open(diagnostic, 'w', opener=lambda path, flags: os.open(path, flags, 0o600)) as output:
                output.write(result.stderr.decode('utf-8', errors='replace'))
        require(matched, 'subprocess_failed_' + Path(args[0]).name)
        return result.stdout

    def compose(self, *args):
        return self.run(['docker', 'compose', *args])

    def request(self, path, data=None, *, status=200, origin=None, anonymous=False):
        client = self.http if not anonymous else urllib.request.build_opener(urllib.request.ProxyHandler({}))
        headers = {'Origin': origin or self.origin, 'Idempotency-Key': uuid.uuid4().hex}
        raw = None
        if data is not None:
            raw = json.dumps(data).encode()
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(self.origin + path, data=raw, headers=headers)
        try:
            response = client.open(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            require(response.status == status, 'unexpected_http_status_' + str(response.status))
            body = response.read()
            return json.loads(body) if body and response.headers.get_content_type() == 'application/json' else body

    def start(self, *, recreate=False):
        args = ['up', '--no-build', '--pull', 'never', '-d', '--wait', '--wait-timeout', '90']
        if recreate:
            args.append('--force-recreate')
        self.compose(*args, 'api')
        binding = self.compose('port', 'api', '8080').decode().strip()
        require(binding.startswith('127.0.0.1:'), 'api_not_loopback')
        self.origin = 'http://' + binding
        if self.env['ATLAS_ORIGIN'] != self.origin:
            self.env['ATLAS_ORIGIN'] = self.origin
            self.compose(*args, 'api')
        self.request('/readyz')

    def sql(self, query):
        return self.compose('exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'atlas', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query).decode().strip()

    def export(self):
        data = self.request('/api/v1/financial-export')
        data.pop('exported_at')
        return data

    def exercise(self):
        require(shutil.disk_usage(self.directory).free >= 2 * 1024**3, 'insufficient_workspace_disk_2_gib')
        require(not self.run(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + self.project]).strip(),
                'project_already_exists')
        self.owns_project = True
        self.start()
        api = self.compose('ps', '-q', 'api').decode().strip()
        db = self.compose('ps', '-q', 'db').decode().strip()
        self.run(['docker', 'cp', api + ':/web/licenses', str(self.directory / 'notices')])
        details = json.loads(self.run(['docker', 'inspect', api]))[0]
        require(details['HostConfig']['ReadonlyRootfs'] and details['Config']['User'] == '65532:65532', 'api_privilege_regression')
        require('ALL' in details['HostConfig']['CapDrop'] and 'no-new-privileges:true' in details['HostConfig']['SecurityOpt'],
                'api_capability_regression')
        database = json.loads(self.run(['docker', 'inspect', db]))[0]
        require(not database['HostConfig'].get('PortBindings'), 'db_public_port')
        require(self.sql("SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname='atlas'") == 'f',
                'db_role_privileged')
        print('PASS: fresh Compose, readiness, loopback, isolated DB and least privilege', flush=True)
        self.request('/api/v1/financial-export', status=401, anonymous=True)
        credentials = dict(email='restore-' + uuid.uuid4().hex + '@example.test', password=secrets.token_hex(24))
        self.request('/api/v1/auth/register', credentials, status=202)
        self.request('/api/v1/auth/login', credentials)
        portfolio = self.request('/api/v1/portfolios', dict(name='Recette synthétique'), status=201)
        account = self.request('/api/v1/portfolios/' + portfolio['id'] + '/accounts',
                               dict(name='Compte synthétique', kind='brokerage', currency='EUR'), status=201)
        asset = self.request('/api/v1/assets', dict(name='Action synthétique', kind='stock', symbol='TEST',
                             namespace='XPAR', reference='FR0000120271', currency='EUR'), status=201)
        base = dict(account_id=account['id'], occurred_at='2025-01-01T00:00:00Z')
        self.request('/api/v1/operations', dict(base, kind='deposit', amount='1000'), status=201)
        buy = dict(base, kind='buy', asset_id=asset['id'], quantity='5', price='100', occurred_at='2025-01-02T00:00:00Z')
        operation = self.request('/api/v1/operations', buy, status=201)
        self.request('/api/v1/operations/' + operation['id'] + '/corrections',
                     dict(replacement=dict(buy, price='90'), reason='Correction synthétique'), status=201)
        self.request('/api/v1/prices', dict(asset_id=asset['id'], currency='EUR', value='125',
                     observed_at='2025-01-03T00:00:00Z', source='Recette synthétique'), status=201)
        self.request('/api/v1/operations', dict(base, kind='deposit', amount='1'), origin='https://wrong.example.test', status=403)
        before = self.export()
        require(len(before['operations']) == 3, 'audit_missing')
        summary = self.request('/api/v1/summary')
        require(summary['total_value_eur']['exact'] == '1175', 'unexpected_valuation')
        self.compose('restart', 'api')
        for _ in range(30):
            try:
                self.request('/readyz')
                break
            except (urllib.error.URLError, VerificationError):
                time.sleep(1)
        require(self.export() == before, 'restart_data_changed')
        print('PASS: persisted financial data, correction/audit, origin refusal and anonymous export refusal', flush=True)
        self.run(['docker', 'cp', api + ':/archive', self.env['ATLAS_ARCHIVE_BIN']])
        self.run([self.env['ATLAS_ARCHIVE_BIN'], 'keygen', '-out', self.env['ATLAS_BACKUP_KEY_FILE']])
        backup = Path(self.run(['bash', 'scripts/backup.sh']).decode().strip())
        require(backup.stat().st_mode & 0o777 == 0o600, 'backup_mode')
        require(Path(self.env['ATLAS_BACKUP_KEY_FILE']).stat().st_mode & 0o777 == 0o600, 'key_mode')
        self.env['ATLAS_RESTORE_DATABASE'] = 'atlas_restore_verified'
        self.run(['bash', 'scripts/restore.sh', str(backup)])
        # Existing targets must never be overwritten.
        self.run(['bash', 'scripts/restore.sh', str(backup)], expected=None)
        tampered = self.directory / 'tampered.aesgcm'
        raw = bytearray(backup.read_bytes())
        raw[-1] ^= 1
        tampered.write_bytes(raw)
        tampered.chmod(0o600)
        self.env['ATLAS_RESTORE_DATABASE'] = 'atlas_restore_tampered'
        self.run(['bash', 'scripts/restore.sh', str(tampered)], expected=None)
        require(self.sql("SELECT count(*) FROM pg_database WHERE datname='atlas_restore_tampered'") == '0',
                'tampered_archive_created_database')
        self.env['ATLAS_RESTORE_DATABASE'] = 'atlas_restore_verified'
        self.env['COMPOSE_FILE'] = self.base_files + ':' + str(ROOT / 'docker-compose.restore.yml')
        self.start(recreate=True)
        self.request('/api/v1/auth/login', credentials)
        require(self.export() == before, 'restored_export_differs')
        require(self.request('/api/v1/summary')['total_value_eur']['exact'] == '1175', 'restored_valuation_differs')
        # Persist a change only in the restored DB, then prove the original remains unchanged.
        self.request('/api/v1/operations', dict(base, kind='deposit', amount='10'), status=201)
        require(self.request('/api/v1/summary')['total_value_eur']['exact'] == '1185', 'restored_db_not_writable')
        self.env['COMPOSE_FILE'] = self.base_files
        self.env.pop('ATLAS_RESTORE_DATABASE')
        self.start(recreate=True)
        self.request('/api/v1/auth/login', credentials)
        require(self.export() == before, 'original_database_changed')
        require(self.sql("SELECT count(*) FROM pg_database WHERE datname IN ('atlas','atlas_restore_verified')") == '2',
                'database_not_preserved')
        print('PASS: encrypted backup, real distinct-DB restore, exact export/valuation, tamper and overwrite refusal, original preserved', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work-dir', required=True, type=Path, help='new private directory; must not already exist')
    parser.add_argument('--image', required=True, help='existing local Atlas image for this checkout')
    parser.add_argument('--postgres-image', default='postgres:18.6', help='existing local PostgreSQL 18.6 image')
    args = parser.parse_args()
    lab = None
    ok = False
    try:
        lab = Lab(args.work_dir, args.image, args.postgres_image)
        lab.exercise()
        ok = True
    except VerificationError as error:
        print('FAIL: ' + str(error), file=sys.stderr)
    except (OSError, ValueError, KeyError, subprocess.TimeoutExpired, urllib.error.URLError) as error:
        frame = traceback.extract_tb(error.__traceback__)[-1]
        print(f'FAIL: {type(error).__name__} at {Path(frame.filename).name}:{frame.lineno}; input values withheld.', file=sys.stderr)
    finally:
        if lab is not None and lab.owns_project:
            try:
                lab.compose('stop', '--timeout', '15')
                lab.compose('rm', '-f', 'api', 'db')
                print('Stopped and removed isolated containers ' + lab.project + '; volumes and private work directory preserved.', flush=True)
            except (VerificationError, OSError, subprocess.TimeoutExpired):
                ok = False
                print('FAIL: stop isolated project ' + lab.project, file=sys.stderr)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

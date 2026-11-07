"""Check bootstrap secret handling without invoking a database."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'deploy/postgres/01-app-role.sh'


class AppRoleSecretTests(unittest.TestCase):
    def run_bootstrap(self, same_password=False):
        with tempfile.TemporaryDirectory() as directory:
            fake = Path(directory) / 'psql'
            fake.write_text('#!/usr/bin/env python3\nimport sys,json\nprint(json.dumps({"args":sys.argv[1:],"sql":sys.stdin.read()}))\n')
            fake.chmod(0o700)
            env = os.environ.copy()
            env.update(PATH=directory + os.pathsep + env['PATH'], POSTGRES_USER='postgres', POSTGRES_DB='atlas',
                       POSTGRES_PASSWORD='synthetic-admin-only', ATLAS_DATABASE_PASSWORD='synthetic-app-only')
            if same_password:
                env['ATLAS_DATABASE_PASSWORD'] = env['POSTGRES_PASSWORD']
            return subprocess.run(['sh', str(SCRIPT)], env=env, capture_output=True, text=True)

    def test_secret_is_read_from_environment_by_psql_and_not_passed_in_arguments(self):
        result = self.run_bootstrap()
        self.assertEqual(result.returncode, 0, result.stderr)
        captured = json.loads(result.stdout)
        self.assertNotIn('synthetic-app-only', result.stdout + result.stderr)
        self.assertNotIn('synthetic-admin-only', result.stdout + result.stderr)
        self.assertIn('\\getenv app_password ATLAS_DATABASE_PASSWORD', captured['sql'])
        self.assertIn('NOSUPERUSER NOCREATEDB NOCREATEROLE', captured['sql'])
        self.assertNotIn('--set=app_password', ' '.join(captured['args']))

    def test_shared_secrets_are_rejected_before_psql(self):
        result = self.run_bootstrap(same_password=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertNotIn('synthetic-admin-only', result.stderr)


if __name__ == '__main__':
    unittest.main()

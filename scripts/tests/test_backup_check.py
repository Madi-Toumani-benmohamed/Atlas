"""Filesystem policy tests with a crypto stub; real AES-GCM is checked in Go/Compose."""
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]


class BackupPolicyTests(unittest.TestCase):
    def test_age_permissions_and_authentication_exit_status(self):
        cases = ('fresh', 'stale', 'future', 'public', 'symlink', 'missing', 'invalid-age', 'bad-authentication')
        for case in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                archive = root / 'private.aesgcm'
                archive.write_bytes(b'synthetic ciphertext stub')
                archive.chmod(0o600)
                stub = root / 'archive'
                stub.write_text('#!/bin/sh\n[ "$1" = verify ] || exit 64\ncat >/dev/null\nexit "${ARCHIVE_TEST_RESULT:-0}"\n')
                stub.chmod(0o700)
                env = os.environ.copy()
                env.update(ATLAS_BACKUP_KEY_FILE=str(root / 'key'), ATLAS_ARCHIVE_BIN=str(stub), ATLAS_BACKUP_MAX_AGE_SECONDS='60')
                if case == 'stale': os.utime(archive, (time.time()-3600, time.time()-3600))
                if case == 'future': os.utime(archive, (time.time()+3600, time.time()+3600))
                if case == 'public': archive.chmod(0o644)
                if case == 'symlink':
                    link = root / 'link.aesgcm'; link.symlink_to(archive); archive = link
                if case == 'missing': archive = root / 'missing.aesgcm'
                if case == 'invalid-age': env['ATLAS_BACKUP_MAX_AGE_SECONDS'] = '1;echo invalid'
                if case == 'bad-authentication': env['ARCHIVE_TEST_RESULT'] = '1'
                result = subprocess.run(['bash', str(ROOT / 'scripts/check-backup.sh'), str(archive)], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode == 0, case == 'fresh')
                self.assertEqual('Archive authenticated' in result.stdout, case == 'fresh')
                if archive.exists(): self.assertEqual(archive.read_bytes(), b'synthetic ciphertext stub')

    def test_backup_does_not_publish_when_post_write_verification_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docker = root / 'docker'
            docker.write_text('#!/bin/sh\nprintf synthetic-dump\n')
            docker.chmod(0o700)
            archive = root / 'archive'
            archive.write_text('''#!/bin/sh
if [ "$1" = verify ]; then exit 1; fi
while [ "$#" -gt 0 ]; do
 if [ "$1" = -out ]; then shift; output=$1; fi
 shift
done
cat > "$output"
''')
            archive.chmod(0o700)
            backups = root / 'backups'
            env = os.environ.copy()
            env.update(PATH=directory+os.pathsep+env['PATH'], ATLAS_BACKUP_KEY_FILE=str(root/'key'), ATLAS_ARCHIVE_BIN=str(archive), ATLAS_BACKUP_DIR=str(backups))
            result = subprocess.run(['bash', str(ROOT/'scripts/backup.sh')], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, '')
            self.assertEqual(list(backups.iterdir()), [])


if __name__ == '__main__':
    unittest.main()

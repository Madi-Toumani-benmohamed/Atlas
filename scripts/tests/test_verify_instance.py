"""Containment checks; never contact Docker or a database."""
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('instance_check', Path(__file__).resolve().parents[1] / 'verify-instance.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class InstanceContainmentTests(unittest.TestCase):
    def test_external_project_and_daemon_settings_cannot_select_an_existing_instance(self):
        with tempfile.TemporaryDirectory() as parent, patch.dict(os.environ, {
            'COMPOSE_PROJECT_NAME': 'production', 'COMPOSE_FILE': '/private/production.yml',
            'COMPOSE_ENV_FILES': '/private/production.env', 'COMPOSE_PROFILES': 'production',
            'DOCKER_HOST': 'tcp://remote.example.test:2376', 'DOCKER_CONTEXT': 'production',
            'DOCKER_TLS_VERIFY': '1', 'ATLAS_RESTORE_DATABASE': 'atlas',
        }):
            lab = module.Lab(Path(parent) / 'new', 'atlas:test', 'postgres:18.6')
            self.assertTrue(lab.project.startswith('atlas-recette-'))
            self.assertEqual(lab.env['DOCKER_HOST'], 'unix:///var/run/docker.sock')
            self.assertNotIn('DOCKER_CONTEXT', lab.env)
            self.assertNotIn('DOCKER_TLS_VERIFY', lab.env)
            self.assertNotIn('COMPOSE_PROFILES', lab.env)
            self.assertNotIn('ATLAS_RESTORE_DATABASE', lab.env)
            self.assertNotIn('production', lab.env['COMPOSE_FILE'])
            self.assertNotEqual(lab.env['POSTGRES_PASSWORD'], lab.env['ATLAS_DATABASE_PASSWORD'])
            self.assertEqual(lab.directory.stat().st_mode & 0o777, 0o700)
            self.assertEqual(Path(lab.env['COMPOSE_ENV_FILES']).stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                module.Lab(lab.directory, 'atlas:test', 'postgres:18.6')

    def test_insufficient_disk_fails_before_any_docker_call(self):
        with tempfile.TemporaryDirectory() as parent:
            lab = module.Lab(Path(parent) / 'new', 'atlas:test', 'postgres:18.6')
            lab.run = Mock(side_effect=AssertionError('must not contact Docker'))
            with patch.object(module.shutil, 'disk_usage', return_value=type('Usage', (), {'free': 0})()):
                with self.assertRaisesRegex(module.VerificationError, 'insufficient_workspace_disk_2_gib'):
                    lab.exercise()
            lab.run.assert_not_called()


if __name__ == '__main__':
    unittest.main()

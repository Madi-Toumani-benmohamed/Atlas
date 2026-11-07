"""Synthetic external-reader contract tests; no application imports or database."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).resolve().parents[1] / 'read-export.py'
spec = importlib.util.spec_from_file_location('reader', SCRIPT)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def fixture():
    def op(key, stamp, rank, **values):
        return dict(id=key, account_id='a', kind='deposit', amount='0.1', active=True,
                    occurred_at=stamp, created_at='2026-01-01T00:00:00Z', replay_order=rank, **values)
    original = op('old', '2025-01-01T00:00:00Z', 1)
    original['active'] = False
    replacement = op('new', '2025-01-01T00:00:00Z', 1, corrects='old')
    replacement.update(kind='buy', asset_id='x', amount='450.00', quantity='100/3')
    return dict(format='atlas-portfolio', version=1, exported_at='2026-01-01T00:00:00Z',
                replay_ordering='occurred_at, then replay_order; replay active operations only',
                number_encoding='source decimal strings; exact rational computations',
                portfolios=[dict(id='p', name='PRIVATE NAME', archived=True)],
                accounts=[dict(id='a', portfolio_id='p')], assets=[dict(id='x')],
                operations=[op('later', '2025-01-01T00:00:00.000000002Z', 3),
                            replacement, original,
                            op('early', '2025-01-01T01:00:00.000000001+01:00', 2)],
                prices=[dict(id='px', asset_id='x', currency='EUR', value='10/11',
                             value_number=dict(exact='10/11', display='0.90909091', approximate=True),
                             observed_at='2025-01-01T00:00:00Z')], imports=[dict(id='i')])


class ExportReaderTests(unittest.TestCase):
    def test_exact_numbers_audit_nanoseconds_and_offsets(self):
        summary, journal = reader.inspect_export(fixture())
        self.assertEqual(summary['active_operations'], 3)
        self.assertEqual(summary['inactive_operations'], 1)
        self.assertEqual(summary['corrections'], 1)
        self.assertEqual(summary['counts']['portfolios'], 1)  # archived metadata retained
        self.assertEqual(summary['exact_values_read'], 7)
        self.assertEqual([op['id'] for op in journal], ['new', 'early', 'later'])
        self.assertEqual(journal[0]['exact_numbers'], {'quantity': '100/3', 'amount': '450'})
        self.assertEqual(reader.number('0.1') + reader.number('0.2'), reader.number('0.3'))
        self.assertEqual(reader.number('999999999999999999999999999999999999.123456789012345678'),
                         reader.number('999999999999999999999999999999999999123456789012345678/1000000000000000000'))
        self.assertNotIn('PRIVATE NAME', json.dumps(summary))

    def test_year_zero_leap_day_is_preserved(self):
        self.assertEqual(reader.instant('0000-03-01T00:00:00Z') - reader.instant('0000-02-29T00:00:00Z'), 86400 * 10**9)

    def test_identical_instants_use_replay_order(self):
        data = fixture()
        data['operations'][0]['occurred_at'] = '2025-01-01T00:00:00Z'
        self.assertEqual([o['id'] for o in reader.inspect_export(data)[1]], ['new', 'later', 'early'])

    def test_structural_rejections(self):
        mutations = {
            'catalog_only': lambda d: d.update(format='atlas-catalog'),
            'new_version': lambda d: d.update(version=2),
            'bool_version': lambda d: d.update(version=True),
            'missing_collection': lambda d: d.pop('imports'),
            'missing_account': lambda d: d['accounts'].clear(),
            'duplicate_id': lambda d: d['assets'].append(dict(id='x')),
            'unknown_kind': lambda d: d['operations'][0].update(kind='SECRET'),
            'numeric_float': lambda d: d['operations'][0].update(amount=0.1),
            'zero_denominator': lambda d: d['prices'][0].update(value='10/0'),
            'bad_timestamp': lambda d: d['operations'][0].update(occurred_at='2025-02-30T00:00:00Z'),
            'bad_offset': lambda d: d['operations'][0].update(occurred_at='2025-01-01T00:00:00+00:60'),
            'missing_parent': lambda d: d['operations'][1].update(corrects='missing'),
            'active_parent': lambda d: d['operations'][2].update(active=True),
            'different_rank': lambda d: d['operations'][1].update(replay_order=9),
            'duplicate_active_rank': lambda d: d['operations'][0].update(replay_order=2),
            'cycle': lambda d: d['operations'][2].update(corrects='new'),
            'inexact_price': lambda d: d['prices'][0]['value_number'].update(exact='0.90909091'),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                data = fixture()
                mutate(data)
                with self.assertRaises(reader.InvalidExport):
                    reader.inspect_export(data)

    def test_cancelled_chain_and_empty_export(self):
        data = fixture()
        data['operations'][1]['active'] = False
        summary, journal = reader.inspect_export(data)
        self.assertEqual(summary['inactive_operations'], 2)
        self.assertNotIn('new', [op['id'] for op in journal])
        for name in reader.COLLECTIONS:
            data[name] = []
        self.assertEqual(reader.inspect_export(data)[0]['active_operations'], 0)

    def test_unknown_fields_do_not_change_original(self):
        data = fixture()
        data['extra'] = {'future': 1}
        data['operations'][0]['future'] = {'value': 'untouched'}
        before = copy.deepcopy(data)
        reader.inspect_export(data)
        self.assertEqual(data, before)

    def test_cli_private_input_rejections_and_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'private.json'
            valid = json.dumps(fixture())
            invalid = ['{"format":"atlas-portfolio", "format":"SECRET"}', '{"n":NaN}', valid[:-1]]
            for value in [valid, *invalid]:
                path.write_text(value)
                result = subprocess.run([sys.executable, str(SCRIPT), str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0 if value == valid else 1)
                self.assertEqual(path.read_text(), value)
                self.assertNotIn('SECRET', result.stdout + result.stderr)
                self.assertNotIn('PRIVATE NAME', result.stdout + result.stderr)
                self.assertNotIn('Traceback', result.stderr)
            path.write_text(valid)
            result = subprocess.run([sys.executable, str(SCRIPT), '--journal', str(path)], capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(result.stdout)['active_journal'][0]['exact_numbers']['quantity'], '100/3')
            large = fixture()
            large['operations'][0]['quantity'] = '1' * 4301 + '/3'
            path.write_text(json.dumps(large))
            result = subprocess.run([sys.executable, str(SCRIPT), str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            with path.open('wb') as source:
                source.truncate(reader.MAX_BYTES + 1)
            result = subprocess.run([sys.executable, str(SCRIPT), str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn('reader_limit_64_mib', result.stderr)


if __name__ == '__main__':
    unittest.main()

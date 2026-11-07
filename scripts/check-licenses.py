#!/usr/bin/env python3
"""Compare production dependency versions and license bytes with the reviewed inventory."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
INVENTORY = ROOT / 'docs/licenses/dependencies.json'
GO_LICENSES = {
    'github.com/jackc/pgpassfile': 'MIT',
    'github.com/jackc/pgservicefile': 'MIT',
    'github.com/jackc/pgx/v5': 'MIT',
    'github.com/jackc/puddle/v2': 'MIT',
    'golang.org/x/crypto': 'BSD-3-Clause',
    'golang.org/x/sync': 'BSD-3-Clause',
    'golang.org/x/text': 'BSD-3-Clause',
}
NOTICE = re.compile(r'^(licen[cs]e|copying|notice|copyright|patents)([.-].*)?$', re.I)


def run(args, cwd):
    return subprocess.check_output(args, cwd=cwd, stderr=subprocess.PIPE, text=True, timeout=120)


def notices(directory):
    result = {}
    for file in sorted(directory.iterdir()):
        if file.is_file() and NOTICE.fullmatch(file.name):
            result[file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
    if not result:
        raise ValueError('missing_license_notice')
    return result


def collect():
    # Only modules compiled into shipped commands; excludes test-only modules.
    lines = run(['go', 'list', '-deps', '-f', '{{if .Module}}{{.Module.Path}}@{{.Module.Version}}|{{.Module.Dir}}{{end}}', './cmd/...'], ROOT / 'backend')
    modules = set(line for line in lines.splitlines() if line and not line.startswith('atlas.local/backend@|'))
    entries = []
    for line in sorted(modules):
        identity, directory = line.split('|', 1)
        name, version = identity.rsplit('@', 1)
        license_id = GO_LICENSES.get(name)
        if not license_id or not version:
            raise ValueError('unreviewed_go_dependency')
        entries.append(dict(ecosystem='go', name=name, version=version, license=license_id,
                            notices=notices(Path(directory))))
    # npm's installed production graph, checked against the committed lockfile.
    lock = json.loads((ROOT / 'web/package-lock.json').read_text())['packages']
    paths = run(['npm', 'ls', '--omit=dev', '--parseable', '--all'], ROOT / 'web').splitlines()
    for raw in sorted(set(paths)):
        directory = Path(raw)
        if directory == ROOT / 'web':
            continue
        relative = directory.relative_to(ROOT / 'web').as_posix()
        pkg = json.loads((directory / 'package.json').read_text())
        locked = lock[relative]
        if pkg.get('license') != 'MIT' or pkg['version'] != locked['version'] or locked.get('dev'):
            raise ValueError('unreviewed_npm_dependency')
        entries.append(dict(ecosystem='npm', name=pkg['name'], version=pkg['version'], license='MIT',
                            notices=notices(directory)))
    if len(entries) != len({(e['ecosystem'], e['name'], e['version']) for e in entries}):
        raise ValueError('duplicate_dependency_inventory')
    goroot = Path(run(['go', 'env', 'GOROOT'], ROOT / 'backend').strip())
    version = run(['go', 'env', 'GOVERSION'], ROOT / 'backend').strip()
    required = re.search(r'^go (\S+)$', (ROOT / 'backend/go.mod').read_text(), re.M)[1]
    if version != 'go' + required:
        raise ValueError('unexpected_go_toolchain')
    return dict(format='atlas-reviewed-licenses', version=1, project_license='Apache-2.0',
                project_license_sha256=hashlib.sha256((ROOT / 'LICENSE').read_bytes()).hexdigest(),
                go_toolchain=dict(version=version, license='BSD-3-Clause',
                                  notice_sha256=hashlib.sha256((goroot / 'LICENSE').read_bytes()).hexdigest()),
                dependencies=sorted(entries, key=lambda e: (e['ecosystem'], e['name'], e['version'])))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='regenerate candidate inventory after human source review')
    parser.add_argument('--artifact-dir', type=Path, help='extracted /web/licenses directory; verify shipped notice bytes')
    args = parser.parse_args()
    try:
        if args.write and args.artifact_dir:
            raise ValueError('write_requires_source_inventory')
        inventory = json.loads(INVENTORY.read_text()) if args.artifact_dir else collect()
        if args.artifact_dir:
            expected = {'Atlas-LICENSE': inventory['project_license_sha256'],
                        'backend/Go-LICENSE': inventory['go_toolchain']['notice_sha256']}
            for entry in inventory['dependencies']:
                prefix = ('backend/go/' + entry['name'] + '@' + entry['version']) if entry['ecosystem'] == 'go' else entry['name'].replace('/', '_')
                expected.update({prefix + '/' + name: digest for name, digest in entry['notices'].items()})
            for name, digest in expected.items():
                if hashlib.sha256((args.artifact_dir / name).read_bytes()).hexdigest() != digest:
                    raise ValueError('shipped_notice_changed')
            print(f'PASS: {len(expected)} shipped notice files match the production inventory.')
        if args.write:
            INVENTORY.parent.mkdir(parents=True, exist_ok=True)
            INVENTORY.write_text(json.dumps(inventory, indent=2, ensure_ascii=True) + '\n')
            print('Wrote candidate inventory; source license review remains required.')
        elif args.artifact_dir:
            pass  # Source graph is checked separately by the normal invocation.
        elif json.loads(INVENTORY.read_text()) != inventory:
            print('FAIL: dependency versions or license notices differ from reviewed inventory.', file=sys.stderr)
            return 1
        else:
            print(f"PASS: {len(inventory['dependencies'])} production dependencies, Go toolchain and Atlas license match reviewed notice hashes.")
        return 0
    except (OSError, ValueError, KeyError, IndexError, subprocess.SubprocessError):
        print('FAIL: license inventory could not be verified; no command output logged.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

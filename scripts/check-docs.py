#!/usr/bin/env python3
"""Check explicit local Markdown link targets in a Git checkout; no network I/O."""

from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

INLINE = re.compile(r'!?\[[^\]\n]*\]\((<[^>\n]+>|[^\s)]+)(?:\s+["\'][^\n]*?["\'])?\)')
REFERENCE = re.compile(r'^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)', re.MULTILINE)
FENCE = re.compile(r'^ {0,3}(`{3,}|~{3,})')


def without_fences(text):
    marker = None
    lines = []
    for line in text.splitlines(keepends=True):
        fence = FENCE.match(line)
        if fence:
            value = fence.group(1)
            if marker is None:
                marker = value
            elif value[0] == marker[0] and len(value) >= len(marker):
                marker = None
            lines.append('\n')
        else:
            lines.append('\n' if marker else line)
    return ''.join(lines)


def check(root):
    root = root.resolve()
    result = subprocess.run(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'],
        cwd=root, check=True, stdout=subprocess.PIPE,
    )
    documents = sorted(set(result.stdout.decode('utf-8').rstrip('\0').split('\0')) - {''})
    failures = []
    count = 0
    for name in documents:
        document = root / name
        if not document.exists():
            continue  # A deleted file's remaining incoming links are checked below.
        if not document.resolve().is_relative_to(root):
            failures.append(f'{name}: document outside checkout')
            continue
        text = without_fences(document.read_text(encoding='utf-8'))
        for pattern in (INLINE, REFERENCE):
            for match in pattern.finditer(text):
                target = match.group(1).strip('<>')
                parsed = urlsplit(target)
                if (parsed.netloc and parsed.scheme != 'file') or parsed.scheme not in ('', 'file'):
                    continue
                if not parsed.path and not parsed.scheme:
                    continue  # Heading-only links; anchors are outside this check.
                count += 1
                line = text.count('\n', 0, match.start()) + 1
                path = Path(unquote(parsed.path))
                resolved = (document.parent / path).resolve()
                if parsed.scheme == 'file' or path.is_absolute() or not resolved.is_relative_to(root):
                    failures.append(f'{name}:{line}: non-portable local target: {target}')
                elif not resolved.exists():
                    failures.append(f'{name}:{line}: missing local target: {target}')
    return len(documents), count, failures


def main():
    root = Path(__file__).resolve().parent.parent
    try:
        documents, links, failures = check(root)
    except (OSError, UnicodeError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Documentation check could not run: {type(error).__name__}', file=sys.stderr)
        return 2
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        return 1
    print(f'Documentation links: {documents} Markdown files, {links} local targets checked.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

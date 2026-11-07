#!/usr/bin/env python3
"""Offline structural reader for Atlas financial exports, using only Python stdlib."""

import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fractions import Fraction
import json
from pathlib import Path
import re
import sys

MAX_BYTES = 64 * 1024 * 1024
COLLECTIONS = ('portfolios', 'accounts', 'assets', 'operations', 'prices', 'imports')
NUMERIC_FIELDS = ('quantity', 'price', 'amount', 'fees', 'cost', 'fx_to_eur', 'exchange_rate')
KINDS = frozenset(('deposit', 'withdrawal', 'buy', 'sell', 'transfer', 'fee',
                   'dividend', 'staking', 'interest', 'opening_cash', 'opening_position'))
JOURNAL_FIELDS = frozenset(NUMERIC_FIELDS + ('id', 'kind', 'account_id', 'target_account_id',
    'asset_id', 'occurred_at', 'active', 'corrects', 'reason', 'created_at', 'replay_order',
    'price_source', 'price_observed_at', 'fx_source', 'fx_observed_at', 'note'))
NUMBER = re.compile(r'-?(?:[0-9]+(?:\.[0-9]+)?|[0-9]+/[1-9][0-9]*)\Z')
STAMP = re.compile(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})\Z')


class InvalidExport(ValueError):
    """Fixed diagnostic codes never include private input values."""


def require(condition, code):
    if not condition:
        raise InvalidExport(code)


def number(value):
    require(isinstance(value, str) and 0 < len(value) <= 8192 and NUMBER.fullmatch(value),
            'invalid_financial_string')
    try:
        return Fraction(value)
    except (ValueError, ZeroDivisionError, OverflowError):
        raise InvalidExport('invalid_financial_string') from None


def instant(value):
    require(isinstance(value, str), 'invalid_timestamp')
    match = STAMP.fullmatch(value)
    require(match is not None, 'invalid_timestamp')
    base, nano, offset = match.groups()
    try:
        zone = timezone.utc
        if offset != 'Z':
            hours, minutes = int(offset[1:3]), int(offset[4:6])
            require(hours <= 23 and minutes <= 59, 'invalid_timestamp')
            zone = timezone(timedelta(minutes=(hours * 60 + minutes) * (-1 if offset[0] == '-' else 1)))
        # Go RFC3339 also permits year 0000. Shift one complete 400-year
        # Gregorian cycle for Python's datetime, then remove its exact days.
        year_zero = base.startswith('0000-')
        if year_zero:
            base = '0400' + base[4:]
        date = datetime.strptime(base, '%Y-%m-%dT%H:%M:%S').replace(tzinfo=zone)
        delta = date - datetime(1970, 1, 1, tzinfo=timezone.utc)
        days = delta.days - (146097 if year_zero else 0)
        return (days * 86400 + delta.seconds) * 10**9 + int((nano or '').ljust(9, '0'))
    except (ValueError, OverflowError):
        raise InvalidExport('invalid_timestamp') from None


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'duplicate_json_key')
        result[key] = value
    return result


def reject_constant(_):
    raise InvalidExport('non_finite_json_number')


def read_export(path):
    # Bound input before decoding. No write, import, API or database operation.
    with Path(path).open('rb') as source:
        raw = source.read(MAX_BYTES + 1)
    require(len(raw) <= MAX_BYTES, 'reader_limit_64_mib')
    try:
        payload = json.loads(raw, object_pairs_hook=unique_object,
                             parse_float=Decimal, parse_constant=reject_constant)
    except (ValueError, UnicodeError, RecursionError):
        raise InvalidExport('invalid_json') from None
    return inspect_export(payload)


def inspect_export(payload):
    require(isinstance(payload, dict), 'invalid_export_object')
    require(payload.get('format') == 'atlas-portfolio', 'unsupported_format')
    require(type(payload.get('version')) is int and payload['version'] == 1, 'unsupported_version')
    instant(payload.get('exported_at'))
    require(payload.get('replay_ordering') == 'occurred_at, then replay_order; replay active operations only',
            'unsupported_replay_ordering')
    require(payload.get('number_encoding') == 'source decimal strings; exact rational computations',
            'unsupported_number_encoding')
    tables = {}
    for name in COLLECTIONS:
        rows = payload.get(name)
        require(isinstance(rows, list), 'missing_collection')
        table = {}
        for row in rows:
            require(isinstance(row, dict), 'invalid_record')
            key = row.get('id')
            require(isinstance(key, str) and key and key not in table, 'invalid_or_duplicate_id')
            table[key] = row
        tables[name] = table

    def reference(row, field, collection, *, optional=False):
        key = row.get(field)
        if optional and not key:
            return
        require(isinstance(key, str) and key in tables[collection], 'dangling_reference')

    for account in tables['accounts'].values():
        reference(account, 'portfolio_id', 'portfolios')
    exact_count = 0
    ordered = []
    active_ranks = set()
    for op in tables['operations'].values():
        reference(op, 'account_id', 'accounts')
        reference(op, 'target_account_id', 'accounts', optional=True)
        reference(op, 'asset_id', 'assets', optional=True)
        reference(op, 'corrects', 'operations', optional=True)
        require(type(op.get('active')) is bool, 'invalid_active_flag')
        rank = op.get('replay_order')
        require(type(rank) is int and rank > 0, 'invalid_replay_order')
        require(isinstance(op.get('kind'), str) and op['kind'] in KINDS, 'unsupported_operation_kind')
        at = instant(op.get('occurred_at'))
        instant(op.get('created_at'))
        for field in ('price_observed_at', 'fx_observed_at'):
            if op.get(field):
                instant(op[field])
        exact = {}
        for field in NUMERIC_FIELDS:
            if field in op:
                exact[field] = str(number(op[field]))
                exact_count += 1
        if op['active']:
            require(rank not in active_ranks, 'duplicate_active_replay_order')
            active_ranks.add(rank)
            record = {key: value for key, value in op.items() if key in JOURNAL_FIELDS}
            ordered.append((at, rank, {**record, 'exact_numbers': exact}))
    # Each correction points backwards within one rank; catch cycles/forks without
    # recursive traversal, including an inactive-only cycle in a damaged file.
    corrected = set()
    roots = {}
    for op in tables['operations'].values():
        parent = op.get('corrects')
        if parent:
            old = tables['operations'][parent]
            require(parent not in corrected and not old['active']
                    and old['replay_order'] == op['replay_order'], 'invalid_correction_chain')
            corrected.add(parent)
        else:
            rank = op['replay_order']
            require(rank not in roots, 'invalid_correction_chain')
            roots[rank] = op['id']
    visited = set()
    children = {op['corrects']: op['id'] for op in tables['operations'].values() if op.get('corrects')}
    for key in roots.values():
        while key is not None:
            require(key not in visited, 'invalid_correction_chain')
            visited.add(key)
            key = children.get(key)
    require(len(visited) == len(tables['operations']), 'invalid_correction_chain')

    for price in tables['prices'].values():
        reference(price, 'asset_id', 'assets', optional=True)
        value = number(price.get('value'))
        exact_count += 1
        instant(price.get('observed_at'))
        if 'value_number' in price:
            encoded = price['value_number']
            require(isinstance(encoded, dict), 'invalid_value_number')
            require(number(encoded.get('exact')) == value, 'inconsistent_exact_price')
            exact_count += 1
    ordered.sort(key=lambda item: (item[0], item[1]))
    journal = [item[2] for item in ordered]
    summary = {
        'format': 'atlas-export-inspection', 'version': 1,
        'counts': {name: len(tables[name]) for name in COLLECTIONS},
        'active_operations': len(journal),
        'inactive_operations': len(tables['operations']) - len(journal),
        'corrections': len(corrected),
        'active_kinds': dict(sorted(Counter(op['kind'] for op in journal).items())),
        'exact_values_read': exact_count,
        'scope': 'structural reading; no financial replay, valuation or restore',
    }
    return summary, journal


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', help='private atlas-portfolio v1 JSON file')
    parser.add_argument('--journal', action='store_true', help='include PRIVATE active operations in replay order')
    args = parser.parse_args()
    # Export quantity strings can reach 8192 characters; keep integer conversion
    # bounded but support them on Python versions with the integer digit guard.
    if hasattr(sys, 'set_int_max_str_digits'):
        sys.set_int_max_str_digits(10000)
    try:
        summary, journal = read_export(args.file)
        if args.journal:
            summary['active_journal'] = journal
        print(json.dumps(summary, ensure_ascii=True, allow_nan=False))
        return 0
    except InvalidExport as error:
        print(f'Export refused: {error}', file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError, RecursionError, OverflowError):
        print('Export could not be read; no input values logged.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

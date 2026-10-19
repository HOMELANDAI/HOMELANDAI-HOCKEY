#!/usr/bin/env python3
"""Copy only Frozen Paws Verse source into an existing UEFN Content folder.

Dry run is default. --apply copies; existing differences require --replace and
are backed up outside Content. Does not start UEFN, compile, or import meshes.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import shutil
import sys
from pathlib import Path


def install(source: Path, content: Path, *, apply: bool = False, replace: bool = False) -> dict:
    source, content = source.resolve(strict=True), content.resolve(strict=True)
    if content.name != 'Content' or not content.is_dir():
        raise ValueError('Choose the existing project/plugin Content directory, not an installation directory.')
    if not list(content.parent.glob('*.uplugin')) and not list(content.parent.glob('*.uproject')):
        raise ValueError('Content parent must contain the existing UEFN .uplugin or .uproject descriptor.')
    files = sorted(source.glob('*.verse'))
    if len(files) != 6 or not (source / 'fp_hockey_device.verse').is_file():
        raise ValueError('Expected the six delivered Verse files. No changes were made.')
    destination = content / 'FrozenPaws'
    if destination.is_symlink():
        raise ValueError('Refusing a symbolic-link target.')
    # Reject old copies in another module: otherwise duplicate symbols/old devices
    # can obscure whether the new code is being tested.
    duplicates = [p for f in files for p in content.rglob(f.name)
                  if p.resolve().parent != destination]
    if duplicates:
        raise ValueError('Move/archive the previous fp_*.verse module outside Content first: '
                         + ', '.join(str(p) for p in duplicates))
    changes = [f for f in files if not (destination / f.name).exists()
               or f.read_bytes() != (destination / f.name).read_bytes()]
    conflicts = [f.name for f in changes if (destination / f.name).exists()]
    if apply and conflicts and not replace:
        raise FileExistsError('Existing modified source needs --replace; it will be backed up: ' + ', '.join(conflicts))
    report = {'mode': 'apply' if apply else 'dry_run', 'destination': str(destination),
              'changed_files': [f.name for f in changes], 'overwrites': conflicts,
              'backup': None, 'compiled': False, 'assets_imported': False}
    if not apply or not changes:
        return report
    if conflicts:
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = content.parent / 'FrozenPaws_Source_Backups' / stamp
        backup.mkdir(parents=True, exist_ok=False)
        for name in conflicts:
            shutil.copy2(destination / name, backup / name)
        report['backup'] = str(backup)
    destination.mkdir(parents=True, exist_ok=True)
    for f in changes:
        temp = destination / (f.name + '.pending')
        shutil.copy2(f, temp)
        temp.replace(destination / f.name)
        if hashlib.sha256(f.read_bytes()).digest() != hashlib.sha256((destination / f.name).read_bytes()).digest():
            raise OSError('Post-copy verification failed: ' + f.name)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('content', type=Path, help='Existing UEFN project/plugin Content folder')
    parser.add_argument('--apply', action='store_true', help='Actually copy source; otherwise preview only')
    parser.add_argument('--replace', action='store_true', help='Back up and replace different existing FrozenPaws source')
    args = parser.parse_args()
    try:
        result = install(Path(__file__).resolve().parents[1] / 'Verse', args.content,
                         apply=args.apply, replace=args.replace)
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError) as exc:
        print('NOT INSTALLED: ' + str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

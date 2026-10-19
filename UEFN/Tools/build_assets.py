#!/usr/bin/env python3
"""Regenerate the prototype OBJ assets from preserved browser geometry (Node.js required)."""
from pathlib import Path
import shutil
import subprocess


def main():
    root = Path(__file__).resolve().parents[1]
    source = root / 'Tools' / 'AssetSource'
    # In the GitHub branch reuse the untouched browser source instead of duplicating it.
    if not (source / 'renderer.js').exists():
        source = root.parent / 'Source'
    roster = root / 'Data' / 'canonical_roster_v1_0.json'
    if not roster.exists():
        roster = root.parent / 'Source' / 'roster.json'
    node = shutil.which('node')
    if not node:
        raise SystemExit('Node.js is needed only to regenerate meshes; the complete ZIP already contains them.')
    subprocess.run([node, str(root / 'Tools' / 'export_prototype_assets.js'),
                    str(source / 'renderer.js'), str(source / 'simulation.js'),
                    str(roster), str(root / 'ImportAssets' / 'Models')], check=True)


if __name__ == '__main__':
    main()

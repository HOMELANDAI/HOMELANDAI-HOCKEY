#!/usr/bin/env python3
"""Local package/geometry/installer checks. This is NOT a Verse compiler."""
from __future__ import annotations
import hashlib
import importlib.util
import io
import json
import math
import re
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSES = {p.name: p.read_text(encoding='utf-8') for p in (ROOT/'Verse').glob('*.verse')}
ROSTER_PATH = ROOT/'Data'/'canonical_roster_v1_0.json'
if not ROSTER_PATH.exists():
    ROSTER_PATH = ROOT.parent/'Source'/'roster.json'
ROSTER = json.loads(ROSTER_PATH.read_text(encoding='utf-8'))
SPEC = importlib.util.spec_from_file_location('fp_installer', ROOT/'Tools'/'install_verse.py')
INSTALLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTALLER)


class SourceTests(unittest.TestCase):
    def test_six_verse_files_and_device(self):
        self.assertEqual(set(VERSES), {'fp_types.verse', 'fp_roster.verse', 'fp_simulation.verse',
                                     'fp_hockey_device.verse', 'fp_menu.verse', 'fp_logic_tests.verse'})
        self.assertIn('fp_hockey_device := class(creative_device)', VERSES['fp_hockey_device.verse'])

    def test_delimiters_no_placeholder_code(self):
        for name, text in VERSES.items():
            clean = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
            clean = re.sub(r'#[^\n]*', '', clean)
            stack = []
            for c in clean:
                if c in '({[': stack.append(c)
                elif c in ')}]':
                    self.assertTrue(stack, name)
                    self.assertEqual(stack.pop(), {')':'(', '}':'{', ']':'['}[c], name)
            self.assertEqual(stack, [], name)
            self.assertNotIn('\t', text, name)
            self.assertNotIn('TODO_IMPLEMENT', text)
        # Delimiters are only a structural check; syntax/effects/API types still
        # need the real compiler.

    def test_canonical_roster_and_attributes_preserved(self):
        self.assertEqual(len(ROSTER['characters']), 15)
        self.assertEqual(len(ROSTER['unassigned_characters']), 4)
        source = VERSES['fp_roster.verse']
        for i, c in enumerate(ROSTER['characters']):
            row = next(x for x in source.splitlines() if 'Id := "'+c['id']+'"' in x)
            self.assertIn(f'Index := {i},', row)
            self.assertIn('OriginalFaction := "'+c['original_faction']+'"', row)
            for stat, value in c['base_attributes'].items():
                self.assertIn(f'{stat.upper()} := {value}.0', row)
        for c in ROSTER['unassigned_characters']:
            self.assertIsNone(c['name'])
            self.assertNotIn('Id := "'+c['id']+'"', source)

    def test_lineups_and_modes(self):
        rules = VERSES['fp_types.verse']
        arrays = [list(map(int, re.search(name+r':\[\]int = array\{([^}]+)\}', rules).group(1).split(',')))
                  for name in ['HomeLineup', 'AwayLineup']]
        self.assertTrue(all(len(a) == 6 for a in arrays))
        self.assertEqual(len(set(arrays[0]+arrays[1])), 12)
        self.assertEqual([a[-1] for a in arrays], [1,11])
        self.assertIn('enum{StandardHockey, Stationary, GoalieTraining, FullRink}', rules)
        self.assertIn('enum{BehindPlayer, GoalieFPV, OverheadAerial}', rules)
        self.assertIn('not ValidLineups()?', VERSES['fp_simulation.verse'])

    def test_shot_lifecycle_guards_present(self):
        sim = VERSES['fp_simulation.verse']
        shoot = sim[sim.index('    Shoot(I:'):sim.index('\n    StepPuck(Dt:')]
        self.assertLess(shoot.index('set Puck.Owner = -1'), shoot.index('set ShotQualified'))
        self.assertNotIn('if (RunReady', shoot)
        for guard in ['ChargeOwner <> Controlled', 'ChargeOwner = Controlled', 'set ChargeOwner = -1',
                      'C.ShootUp?', 'C.QuickShot?', 'C.ReleaseSeconds']:
            self.assertIn(guard, sim)
        adapter = VERSES['fp_hockey_device.verse']
        for guard in ['MissingReleaseTime >= 0.10', 'ShotPressedAt > 0.15', 'E(1) <= Age + 0.25',
                      'Command.ClearEdges()', 'not Game.Paused?']:
            self.assertIn(guard, adapter)

    def test_bindings_have_handlers_and_all_input_actions(self):
        code = VERSES['fp_hockey_device.verse']
        mapping = json.loads((ROOT/'Data/device_mapping.json').read_text())
        for item in mapping['input_devices']:
            self.assertIn('@editable '+item['field']+':input_trigger_device', code)
        self.assertEqual(len(mapping['input_devices']), 14)
        self.assertEqual({i['custom_input'] for i in mapping['input_devices']}, set(range(1,13)))
        for text in [code, VERSES['fp_menu.verse']]:
            for handler in re.findall(r'\.Subscribe\((\w+)\)', text):
                self.assertRegex(text, r'\n    '+handler+r'\(')

    def test_spawn_cleanup_and_menu_guards(self):
        code = VERSES['fp_hockey_device.verse']
        for item in ['SpawnProp(', 'P.Dispose()', 'PlayerRemoved', 'SetVulnerability(SavedVulnerable)',
                     'ReleaseFromStasis()', 'Input.Unregister(A)', 'Proxies.Length <> Game.Athletes.Length',
                     'AutoResetTraining?', 'SetupComplete?', 'ThirdPersonControls.RemoveFrom(A)']:
            self.assertIn(item, code)
        menu = VERSES['fp_menu.verse']
        for mode in ['StandardHockey', 'Stationary', 'GoalieTraining', 'FullRink']:
            self.assertIn('fp_mode.'+mode, menu)
        self.assertIn('ui_input_mode.All', menu)
        self.assertIn('UI.RemoveWidget(C)', menu)
        self.assertIn('S.Cancel()', menu)

    def test_exported_geometry_integrity(self):
        folder = ROOT/'ImportAssets/Models'
        if not folder.exists():
            self.skipTest('Run Tools/build_assets.py to generate meshes in a GitHub checkout.')
        manifest = json.loads((folder/'ASSET_MANIFEST.json').read_text())
        declared = set(re.findall(r'^newmtl (.+)$', (folder/'FrozenPaws.mtl').read_text(), re.M))
        self.assertEqual(len(manifest['meshes']), 63)
        self.assertFalse(manifest['rigs_or_animations'])
        for item in manifest['meshes']:
            vertices = normals = faces = 0
            for line in (folder/item['file']).read_text().splitlines():
                if line.startswith('v ') or line.startswith('vn '):
                    self.assertTrue(all(math.isfinite(float(n)) for n in line.split()[1:]), item['file'])
                    if line.startswith('v '): vertices += 1
                    else: normals += 1
                elif line.startswith('usemtl '):
                    self.assertIn(line[7:], declared)
                elif line.startswith('f '):
                    faces += 1
                    self.assertEqual(len(line.split()), 4)
                    for index in line.split()[1:]:
                        v,n = map(int, index.split('//'))
                        self.assertTrue(0 < v <= item['vertices'])
                        self.assertTrue(0 < n <= item['vertices'])
            self.assertEqual(vertices, item['vertices'])
            self.assertEqual(normals, item['vertices'])
            self.assertEqual(faces, item['triangles'])


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.plugin = self.base/'TestPlugin'; self.plugin.mkdir()
        (self.plugin/'TestPlugin.uplugin').write_text('{}')
        self.content = self.plugin/'Content'; self.content.mkdir()
    def tearDown(self):
        self.tmp.cleanup()
    def run_install(self, **kwargs):
        return INSTALLER.install(ROOT/'Verse', self.content, **kwargs)
    def test_dry_run_does_not_write(self):
        r = self.run_install()
        self.assertEqual(len(r['changed_files']), 6)
        self.assertFalse((self.content/'FrozenPaws').exists())
    def test_apply_and_idempotence(self):
        r = self.run_install(apply=True)
        self.assertEqual(len(r['changed_files']), 6)
        self.assertEqual(self.run_install(apply=True)['changed_files'], [])
        self.assertFalse(r['compiled'])
    def test_conflicting_source_requires_replace_and_backs_up(self):
        self.run_install(apply=True)
        f = self.content/'FrozenPaws'/'fp_types.verse'; f.write_text('# local edit\n')
        with self.assertRaises(FileExistsError): self.run_install(apply=True)
        r = self.run_install(apply=True, replace=True)
        self.assertEqual((Path(r['backup'])/'fp_types.verse').read_text(), '# local edit\n')
        self.assertFalse(Path(r['backup']).is_relative_to(self.content))
    def test_wrong_folder_rejected(self):
        with self.assertRaises(ValueError):
            INSTALLER.install(ROOT/'Verse', self.base, apply=True)
    def test_missing_project_descriptor_rejected(self):
        (self.plugin/'TestPlugin.uplugin').unlink()
        with self.assertRaises(ValueError): self.run_install(apply=True)
    def test_duplicate_module_rejected(self):
        old = self.content/'OldModule'; old.mkdir()
        (old/'fp_types.verse').write_text('# old')
        with self.assertRaises(ValueError): self.run_install(apply=True)


if __name__ == '__main__':
    stream = io.StringIO()
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    print(stream.getvalue())
    hashes = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted((ROOT/'Verse').glob('*.verse'))}
    report = {'product': 'ICE HOCKEY LAKE: FROZEN PAWS EDITION', 'version': '0.4.0',
              'scope': 'Local source/geometry integrity and installer tests only; not a Verse compiler or Fortnite execution.',
              'tests_run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
              'skipped': len(result.skipped), 'successful': result.wasSuccessful(),
              'authored_editor_expectations': VERSES['fp_logic_tests.verse'].count('Expect("'),
              'verse_compile': 'NOT RUN', 'verse_logic_test_execution': 'NOT RUN',
              'uefn_asset_import': 'NOT RUN', 'fortnite_session': 'NOT RUN',
              'local_editor_access': 'NOT AVAILABLE', 'published_island': False,
              'verse_sha256': hashes, 'test_output': stream.getvalue()}
    (ROOT/'Tests').mkdir(exist_ok=True)
    (ROOT/'Tests'/'LOCAL_VERIFICATION.json').write_text(json.dumps(report, indent=2)+'\n')
    raise SystemExit(0 if result.wasSuccessful() else 1)

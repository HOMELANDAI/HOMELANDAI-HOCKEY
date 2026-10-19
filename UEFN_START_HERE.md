# ICE HOCKEY LAKE: FROZEN PAWS EDITION - Fortnite development

**HomelandAI Studios | UEFN source v0.4.0**

Start with [UEFN/README_FIRST.md](UEFN/README_FIRST.md) and [the editor setup](UEFN/Docs/UEFN_SETUP.md).

The new implementation is in `UEFN/Verse/`: actual Verse gameplay, native menu, input handling, cameras, dynamic prop spawning, roster and authored engine tests. It is not a browser page relabeled as an Unreal project.

**Not yet compiled or playtested in UEFN/Fortnite. No published island code is included.** The editor session on your own computer has not been accessed or modified by this upload.

The original root browser game remains unchanged. The main branch remains the browser version; this branch isolates the Fortnite work. Do not upload this repository ZIP to VIVERSE.

## Geometry and local checks

The downloadable source package delivered in chat includes pre-exported models and original reference art. This branch instead regenerates the same 63 static OBJ assets from the preserved browser geometry:

```sh
python UEFN/Tools/build_assets.py
python UEFN/Tools/verify_source.py
```

Regeneration needs Node.js. These checks are source/geometry/installer checks only, not a Verse compiler. The 33 authored engine expectations in `fp_logic_tests.verse` still need a real editor test session.

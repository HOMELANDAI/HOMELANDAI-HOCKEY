#!/usr/bin/env python3
"""Assemble the existing game and package only index.html for VIVERSE.

No dependencies or network access. Does not modify the repository launcher.
The default refuses to relabel modified code as the preserved v0.3.0 build.
"""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

BASELINE_SHA256 = "2392227d201f9542410b0c033b8198487b623a93f75be8618af186e97b38b540"
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Source"


def assemble() -> bytes:
    def read(name: str) -> str:
        path = SOURCE / name
        # Normalize Windows line endings without adding or removing final newlines.
        return path.read_text(encoding="utf-8")

    roster = read("roster.json")
    json.loads(roster)
    body = "\n".join(read(name) for name in
                     ["simulation.js", "input.js", "renderer.js", "app.js"])
    html = (read("head.html") + read("error_bootstrap.html")
            + '<script>\n(()=>{\n"use strict";\nwindow.FrozenPawsRoster='
            + roster + ';\n' + body + '\n})();\n</script>\n</body></html>')
    return html.encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-modified", action="store_true",
                        help="Package edited source with a MODIFIED filename; does not claim baseline validation.")
    args = parser.parse_args()
    try:
        runtime = assemble()
        digest = hashlib.sha256(runtime).hexdigest()
        preserved = digest == BASELINE_SHA256
        if not preserved and not args.allow_modified:
            raise ValueError("Source differs from the original v0.3.0 runtime. "
                             "Review your edits and tests, then use --allow-modified to package them. "
                             "Actual SHA-256: " + digest)
        output = ROOT / "dist"
        output.mkdir(exist_ok=True)
        (output / "index.html").write_bytes(runtime)
        name = ("Ice_Hockey_Lake_Frozen_Paws_VIVERSE_WEB_UPLOAD_v0_3_0_CLEAN.zip"
                if preserved else "Ice_Hockey_Lake_Frozen_Paws_VIVERSE_WEB_UPLOAD_MODIFIED.zip")
        archive = output / name
        with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr("index.html", runtime)
        with ZipFile(archive) as z:
            if z.namelist() != ["index.html"] or z.testzip() is not None:
                raise ValueError("Archive integrity or root-entry validation failed.")
            if z.read("index.html") != runtime:
                raise ValueError("Packaged runtime does not match the assembled game.")
        print("Created:", archive)
        print("Runtime SHA-256:", digest)
        print("Original v0.3.0 byte preservation:", "PASS" if preserved else "MODIFIED - NOT BASELINE")
        print("ZIP contains only index.html at root. Upload this ZIP, not the repository ZIP.")
        print("This command checks packaging, not gameplay, Gemini, VIVERSE hosting, or headset compatibility.")
    except (OSError, ValueError) as exc:
        parser.exit(1, "Build failed: " + str(exc) + "\n")


if __name__ == "__main__":
    main()

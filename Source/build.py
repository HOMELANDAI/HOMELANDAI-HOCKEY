from pathlib import Path
S=Path(__file__).resolve().parent
head=(S/"head.html").read_text(encoding="utf-8")
error=(S/"error_bootstrap.html").read_text(encoding="utf-8")
roster=(S/"roster.json").read_text(encoding="utf-8")
body="\n".join((S/f).read_text(encoding="utf-8") for f in ["simulation.js","input.js","renderer.js","app.js"])
html=head+error+'<script>\n(()=>{\n"use strict";\nwindow.FrozenPawsRoster='+roster+';\n'+body+'\n})();\n</script>\n</body></html>'
(S.parent/"index.html").write_text(html,encoding="utf-8")
print("Built self-contained index.html",len(html.encode("utf-8")),"bytes")

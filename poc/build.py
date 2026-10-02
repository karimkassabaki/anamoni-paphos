"""Assemble the single-file ANAMONI dashboard (fonts, data and code inlined)."""
import base64, json, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(ROOT, "..", "node_modules", "@fontsource")

def face(family, pkg, weight, subset, urange):
    p = os.path.join(FONTS, pkg, "files", f"{pkg}-{subset}-{weight}-normal.woff2")
    b64 = base64.b64encode(open(p, "rb").read()).decode()
    return f"@font-face{{font-family:'{family}';font-style:normal;font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{urange}}}"

LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATEXT = "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
GREEK = "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF"
fonts = []
for w in (400, 500, 600):
    fonts.append(face("IBM Plex Sans", "ibm-plex-sans", w, "latin", LATIN))
    fonts.append(face("IBM Plex Sans", "ibm-plex-sans", w, "greek", GREEK))
    fonts.append(face("IBM Plex Sans", "ibm-plex-sans", w, "latin-ext", LATEXT))
for w in (400, 500, 600):
    fonts.append(face("IBM Plex Mono", "ibm-plex-mono", w, "latin", LATIN))

district = json.load(open(os.path.join(ROOT, "district.json")))
kb = json.load(open(os.path.join(ROOT, "..", "data", "scheme_kb.json")))
rec = {"screen": json.load(open(os.path.join(ROOT, "rec_screen.json"))), "chat": json.load(open(os.path.join(ROOT, "rec_chat.json")))}
src = lambda n: open(os.path.join(ROOT, "src", n), encoding="utf-8").read()
def jtag(i, obj):
    return f'<script type="application/json" id="{i}">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>"

html = (
    "<title>ANAMONI Paphos</title>\n"
    '<meta name="description" content="ANAMONI proof of concept: AI screening, building passports and safe rooftop homes for Paphos.">\n'
    "<style>" + "".join(fonts) + "\n" + src("styles.css") + "</style>\n"
    + src("body.html") + "\n"
    + jtag("d-district", district) + jtag("d-kb", kb) + jtag("d-rec", rec) + "\n"
    + '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n'
    + "<script>\n" + src("engine.js") + "\n" + src("model3d.js") + "\n" + src("ui1.js") + "\n" + src("ui2.js") + "\n" + src("tests.js") + "\n" + src("ui3.js") + "\n</script>\n"
)
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
open(os.path.join(ROOT, "dist", "index.html"), "w", encoding="utf-8").write(html)
# standalone copy with a full document skeleton and three.js embedded, for GitHub Pages or opening from disk offline
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
three = open(os.path.join(ROOT, "..", "node_modules", "three", "build", "three.min.js"), encoding="utf-8").read()
head = html.split("\n", 2)
full = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        + head[0] + "\n" + head[1] + "</head><body>" + head[2].replace(CDN, "<script>" + three + "</script>") + "</body></html>")
open(os.path.join(ROOT, "dist", "standalone.html"), "w", encoding="utf-8").write(full)
open(os.path.join(ROOT, "dist", "local.html"), "w", encoding="utf-8").write(full)
print("built", len(html) // 1024, "KB")

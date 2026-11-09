"""Writes src/views/icons.ts from Potok's copy of Heroicons, so the app draws
the same icons as the page. Heroicons comes with potok-ide's dependencies:
run `mix deps.get` there first, with potok-ide next to this project, then
`python scripts/icons.py` here. Heroicons is MIT licensed by Tailwind Labs;
its notice goes into the file it writes and is in THIRD_PARTY_NOTICES.md."""

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
HERO = HERE.parents[1] / "potok-ide" / "deps" / "heroicons" / "optimized" / "24"
OUT = HERE.parent / "src" / "views" / "icons.ts"

OUTLINE = {
    "addCircle": "plus-circle",
    "title": "h1",
    "image": "photo",
    "video": "video-camera",
    "section": "queue-list",
    "eye": "eye",
    "undo": "arrow-uturn-left",
    "redo": "arrow-uturn-right",
    "more": "ellipsis-horizontal",
    "copy": "document-duplicate",
    "trash": "trash",
    "close": "x-mark",
    "check": "check",
    "checkCircle": "check-circle",
    "left": "chevron-left",
    "right": "chevron-right",
    "first": "chevron-double-left",
    "last": "chevron-double-right",
    "up": "chevron-up",
    "down": "chevron-down",
    "bold": "bold",
    "italic": "italic",
    "underline": "underline",
    "link": "link",
    "listBullet": "list-bullet",
    "listNumbered": "numbered-list",
    "star": "star",
    "heart": "heart",
    "thumb": "hand-thumb-up",
    "upload": "arrow-up-tray",
    "file": "document",
    "calendar": "calendar-days",
    "clock": "clock",
    "shortText": "bars-2",
    "paragraph": "bars-3-bottom-left",
    "dropdown": "chevron-up-down",
    "scale": "adjustments-horizontal",
    "grid": "table-cells",
    "checkGrid": "squares-2x2",
    "settings": "cog-6-tooth",
    "download": "arrow-down-tray",
    "lock": "lock-closed",
    "person": "user",
    "quiz": "academic-cap",
    "print": "printer",
    "saved": "check-circle",
    "warning": "exclamation-triangle",
    "info": "information-circle",
    "table": "table-cells",
    "summary": "chart-bar",
    "forms": "clipboard-document-list",
    "fill": "pencil-square",
    "back": "arrow-left",
    "send": "paper-airplane",
}

# Heroicons has no grip, radio button or checkbox: drawn here in its outline style.
CUSTOM = {
    "drag": " ".join(
        f"M{x + 0.75} {y}a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" for y in (6, 12, 18) for x in (9, 15)
    ),
    "radio": "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M14.25 12a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
    "checkbox": "M6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75Z M8.25 12.25l2.5 2.5 5-5.5",
}

SOLID = {"star": "star", "heart": "heart", "thumb": "hand-thumb-up"}

# Kept by the bundler as a legal comment, so the build carries it too.
NOTICE = """/**
 * @license Heroicons, https://github.com/tailwindlabs/heroicons
 *
 * MIT License
 *
 * Copyright (c) Tailwind Labs, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
"""


def paths(file: Path) -> list[str]:
    if not file.exists():
        sys.exit(f"{file} is missing: run `mix deps.get` in potok-ide first")
    found = re.findall(r'\sd="([^"]+)"', file.read_text(encoding="utf-8"))
    if not found:
        sys.exit(f"no path in {file}")
    return found


def main() -> None:
    lines = [f"  {name}: '{' '.join(paths(HERO / 'outline' / f'{hero}.svg'))}'," for name, hero in OUTLINE.items()]
    lines += [f"  {name}: '{d}'," for name, d in CUSTOM.items()]
    solid = [
        f"  {name}: [{', '.join(repr(d) for d in paths(HERO / 'solid' / f'{hero}.svg'))}],"
        for name, hero in SOLID.items()
    ]

    OUT.write_text(
        "// Icons from Heroicons, the set Potok's page draws with: the outline ones at\n"
        "// 24×24 with a 1.5 stroke, and solid ones for a chosen star, heart or thumb.\n"
        "// Written by scripts/icons.py from potok-ide's deps/heroicons, plus a grip, a\n"
        "// radio button and a checkbox in the same style, which Heroicons does not have.\n"
        "\n" + NOTICE + "\n"
        "import { html, svg, type TemplateResult } from 'lit-html';\n"
        "\n"
        "const PATHS = {\n" + "\n".join(lines) + "\n};\n"
        "\n"
        "const SOLID = {\n" + "\n".join(solid) + "\n};\n"
        "\n"
        "export type IconName = keyof typeof PATHS;\n"
        "export type SolidName = keyof typeof SOLID;\n"
        "\n"
        "export function icon(name: IconName, className = 'size-5'): TemplateResult {\n"
        "  return html`<svg\n"
        "    class=${className}\n"
        '    viewBox="0 0 24 24"\n'
        '    fill="none"\n'
        '    stroke="currentColor"\n'
        '    stroke-width="1.5"\n'
        '    stroke-linecap="round"\n'
        '    stroke-linejoin="round"\n'
        '    aria-hidden="true"\n'
        "  ><path d=${PATHS[name]}></path></svg>`;\n"
        "}\n"
        "\n"
        "/** A filled star, heart or thumb, for a chosen level of a rating. */\n"
        "export function solidIcon(name: SolidName, className = 'size-5'): TemplateResult {\n"
        '  return html`<svg class=${className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n'
        "    ${SOLID[name].map((d) => svg`<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=${d}></path>`)}\n"
        "  </svg>`;\n"
        "}\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"wrote {OUT.name}: {len(lines)} outline and {len(solid)} solid icons")


main()

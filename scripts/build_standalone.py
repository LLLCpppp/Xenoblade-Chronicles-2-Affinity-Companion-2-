"""Build a portable, offline HTML page. Uses Python standard library only."""
from pathlib import Path
import base64
import json
import mimetypes
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def data_url(content, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(content).decode('ascii')


def build(output=None):
    output = Path(output) if output else ROOT / 'dist' / 'xc2-affinity-companion.html'
    data = json.loads((ROOT / 'data.json').read_text(encoding='utf-8'))
    assets = {}
    for blade in data['blades'] + data['mercenary']['blades']:
        relative = blade['image']
        if relative not in assets:
            path = ROOT / relative
            assets[relative] = data_url(path.read_bytes(), mimetypes.guess_type(path.name)[0] or 'image/png')
    content = (ROOT / 'index.html').read_text(encoding='utf-8')
    content = content.replace('<link rel="stylesheet" href="style.css">', '<style>' + (ROOT / 'style.css').read_text(encoding='utf-8') + '</style>')
    data_code = 'window.XB2_DATA=' + json.dumps(data, ensure_ascii=False).replace('<', '\\u003c') + ';\n'
    data_code += '(()=>{const assets=' + json.dumps(assets, ensure_ascii=False) + ';for(const b of [...window.XB2_DATA.blades,...window.XB2_DATA.mercenary.blades])b.image=assets[b.image];})();'

    def inline_script(match):
        name = match.group(1)
        if name == 'data.js':
            code = data_code
        else:
            code = (ROOT / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
            if name != 'merc-engine.js':
                code = 'document.addEventListener("DOMContentLoaded",function(){\n' + code + '\n});'
        return '<script>' + code + '</script>'

    content = re.sub(r'<script src="([^"]+)" defer></script>', inline_script, content)
    content = content.replace('href="index.html"', 'href="#"')
    files = [('牵绊圆环精英条件.csv', 'text/csv;charset=utf-8'), ('data.json', 'application/json'), ('locales.json', 'application/json'), ('ATTRIBUTION.md', 'text/plain;charset=utf-8'), ('复核报告.html', 'text/html;charset=utf-8'), ('佣兵团功能复核报告.html', 'text/html;charset=utf-8')]
    for name, mime in files:
        encoded = data_url((ROOT / name).read_bytes(), mime)
        content = re.sub(r'href="' + re.escape(name) + r'"(?: target="_blank")?(?: rel="noopener noreferrer")?(?: download)?', lambda m: f'href="{encoded}" download="{name}"', content)
    content = content.replace('独立复核报告 ↗', '独立复核报告 ↓')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding='utf-8')
    return output


if __name__ == '__main__':
    print(build(sys.argv[1] if len(sys.argv) > 1 else None))

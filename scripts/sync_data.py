"""Refresh offline JS bundles after editing the public JSON datasets."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
for filename, variable in [('data', 'XB2_DATA'), ('locales', 'XB2_LOCALES')]:
    data = json.loads((root / (filename + '.json')).read_text(encoding='utf-8'))
    script = 'window.' + variable + '=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + ';\n'
    (root / (filename + '.js')).write_text(script, encoding='utf-8')
    print('Updated ' + filename + '.js')

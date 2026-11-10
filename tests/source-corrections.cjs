'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
require('../merc-engine.js');
const E = globalThis.XB2_MERC_ENGINE;
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const D = JSON.parse(read('data.json')), M = D.mercenary;
const before = JSON.stringify(D);
const blade = name => M.blades.find(item => item.name === name);
const branch = (name, track) => blade(name).tracks.find(item => item.name === track);
let checks = 0;
const check = fn => { fn(); checks++; };
function allDone(b) {
  return {name: b.name, tier: 5, confirmed: true, completed: Object.fromEntries(b.tracks.map(t => [t.name, t.rows.length]))};
}

// Correct the source typo in place. The node count and stable ordinal positions
// must survive the stage correction, rather than treating it as an added node.
const carving = branch('斩铁', '镌刻');
check(() => {
  assert.equal(carving.rows.length, 5);
  assert.deepEqual(carving.rows.map(row => row.stage), [1, 2, 3, 4, 5]);
  assert.deepEqual(carving.rows.map(row => row.ordinal), [1, 2, 3, 4, 5]);
  assert.equal(carving.initial_completed, 1);
  assert.equal(carving.duplicate_stages, false);
  assert.equal(carving.rows[2].condition.replace(/\s/g, ''), '使用镌刻0/8');
  assert.equal(carving.rows[2].effect, '必杀技造成的仇恨值提升80%');
  assert(carving.rows.every(row => row.node === '镌刻'));
  assert(carving.rows.every(row => row.source === carving.rows[0].source));
  assert.equal(E.maxRank(carving, 2), 2);
  assert.equal(E.maxRank(carving, 3), 3);
});
check(() => {
  const b = blade('斩铁'), profile = allDone(b);
  profile.tier = 2;
  for (const track of b.tracks) profile.completed[track.name] = E.maxRank(track, 2);
  const result = E.analyze(b, profile);
  assert.equal(profile.completed['镌刻'], 2);
  assert(!result.frontiers.some(item => item.track === '镌刻'));
  const next = result.locked.find(item => item.track === '镌刻');
  assert(next);
  assert.equal(next.completed, 2);
  assert.equal(next.row.stage, 3);
  assert.equal(next.row.condition, carving.rows[2].condition);
});

// Append the missing real row after the existing two-row prefix. Existing
// progress values remain counts into that same prefix; compatibility migration
// itself is exercised in the separate progress-import tests.
const dark = branch('M.O.M.O. :i', '暗属性之力');
const darkSource = 'https://xenoblade2.cn/%E5%BC%82%E5%88%83:M.O.M.O._:i#暗属性之力';
check(() => {
  assert.deepEqual(dark.rows.map(row => row.stage), [2, 4, 5]);
  assert.deepEqual(dark.rows.map(row => row.ordinal), [1, 2, 3]);
  assert.equal(dark.initial_completed, 0);
  assert.equal(dark.duplicate_stages, false);
  assert.equal(E.maxRank(dark, 2), 1);
  assert.equal(E.maxRank(dark, 4), 2);
  assert.equal(E.maxRank(dark, 5), 3);
  for (let i = 0; i < 2; i++) {
    const row = dark.rows[i];
    assert.deepEqual({
      node: row.node, stage: row.stage, effect: row.effect, condition: row.condition,
      source: row.source, links: row.links, ordinal: row.ordinal,
      status: row.merc.status, rule: row.merc.rule
    }, {
      node: '暗属性之力', stage: i === 0 ? 2 : 4, effect: '暗属性异刃的能力',
      condition: `多聊聊天（可通过至今的累计数达成）0/${i === 0 ? 100 : 200}`,
      source: darkSource, links: [], ordinal: i + 1,
      status: 'eligible', rule: 'player_conversation'
    });
  }
  const tail = dark.rows[2];
  assert.equal(tail.node, '暗属性之力');
  assert.equal(tail.condition, '多多行走（可通过至今的累计数达成）0/400000');
  assert.equal(tail.effect, '暗属性异刃的能力');
  assert.equal(tail.source, darkSource);
  assert.equal(tail.merc.status, 'manual');
  assert.equal(tail.merc.rule, 'movement');
  assert.equal(E.effective(tail).status, 'manual');
});
check(() => {
  const b = blade('M.O.M.O. :i'), profile = allDone(b);
  profile.completed['暗属性之力'] = 2;
  const result = E.analyze(b, profile);
  assert.equal(result.status, 'manual');
  assert.equal(result.frontiers.length, 1);
  assert.equal(result.frontiers[0].row.condition, dark.rows[2].condition);
  assert.deepEqual(E.mercNodeSummary(b, profile), {total: 0, trust: 0});
  profile.completed['暗属性之力'] = 3;
  assert.equal(E.analyze(b, profile).status, 'complete');
});

const ordinary = [
  ['鸣', '暴力机关', 3, '铠甲钳蝎', '在斯佩比亚打倒 铠甲钳蝎 0/4'],
  ['重音', '感伤爆发', 3, '马格奈尔刺毛虫', '在洛修利亚打倒 马格奈尔刺毛虫 0/5'],
  ['重音', '秘密欲望', 4, '清洗者刺毛虫', '在艾尔皮斯灵洞打倒 清洗者刺毛虫 0/5']
];
const removedNames = new Set(ordinary.map(item => item[3]));
const hunts = D.blades.flatMap(b => b.rows.map(row => ({blade: b.name, ...row})));
for (const [name, trackName, stage, enemy, condition] of ordinary) {
  check(() => {
    const b = blade(name), track = branch(name, trackName), index = track.rows.findIndex(row => row.stage === stage);
    assert(index >= 0);
    const row = track.rows[index];
    assert.equal(track.rows.length, 5, 'Removing a hunt requirement must not delete its original affinity-chart row');
    assert.equal(row.condition, condition);
    assert(row.links.some(link => link.name === enemy && decodeURIComponent(link.url).includes('/敌人:')));
    assert.equal(row.merc.status, 'eligible');
    assert.equal(E.effective(row).status, 'eligible');
    const profile = allDone(b); profile.completed[trackName] = index;
    assert.equal(E.analyze(b, profile).status, 'eligible');
    assert(E.mercNodeSummary(b, profile).total >= 1);
    assert(!hunts.some(hunt => hunt.enemies.some(item => item.name === enemy)));
  });
}
check(() => {
  assert.equal(D.blades.length, 29);
  assert.equal(hunts.length, 79);
  assert.equal(new Set(hunts.map(row => row.id)).size, 79);
  assert.equal(D.blades.some(b => b.name === '鸣'), false);
  const azami = D.blades.find(b => b.name === '重音');
  assert(azami);
  assert.equal(azami.rows.length, 1);
  assert.equal(azami.rows[0].id, 'b21-1');
  assert.equal(azami.rows[0].enemies[0].name, '吸血贵妇人玛蒙');
  assert.equal(D.coverage.find(b => b.name === '鸣').included, 0);
  assert.equal(D.coverage.find(b => b.name === '重音').included, 1);
  assert.equal(D.coverage.reduce((sum, b) => sum + b.included, 0), 79);
  assert.equal(hunts.filter(row => row.status === 'verified').length, 76);
  assert.equal(hunts.filter(row => row.status === 'generic').length, 3);
  assert.equal(hunts.filter(row => row.status === 'uncertain').length, 0);
  assert.equal(new Set(hunts.flatMap(row => row.enemies.map(enemy => enemy.name))).size, 50);
  assert.deepEqual(D.statistics, {
    scanned: 57, blades: 29, nodes: 79, verified_names: 50, uncertain_nodes: 0, generic_nodes: 3
  });
});

// Original IDs are intentionally sparse after deleting the three ordinary kills.
// In particular b21-1 cannot be renumbered to b21-0, nor may subsequent blade IDs
// shift just because the Ming hunt card disappeared.
const expectedIds = {
  '光': ['b01-0', 'b01-1'], '白虎': ['b03-0', 'b03-1'], '花JD': ['b06-0'],
  '迦具土': ['b08-0'], '彩歌': ['b09-0'], '绵津见': ['b11-0'], '红莲': ['b12-0'],
  '力男': ['b13-0', 'b13-1', 'b13-2', 'b13-3'], '婆娑罗': ['b14-0'],
  '玛瑙': ['b16-0', 'b16-1', 'b16-2'], '雄黄': ['b17-0'], '重音': ['b21-1'],
  '水分': ['b22-0'], '星织': ['b23-0'], '时叶': ['b24-0', 'b24-1'],
  '蓟': ['b26-0', 'b26-1'], '纽兹': ['b28-0', 'b28-1'], '宇迦': ['b29-0', 'b29-1'],
  '结': ['b31-0'], '式': ['b32-0', 'b32-1'],
  '八重切': Array.from({length: 34}, (_, i) => `b34-${i}`),
  '伊吹': ['b35-0', 'b35-1'], '月': ['b39-0'], 'T-elos Re:': ['b40-0', 'b40-1', 'b40-2'],
  '花巴斯塔': ['b41-0', 'b41-1', 'b41-2'], '弁庆': ['b48-0'],
  '佐田彦': ['b49-0'], '神威': ['b50-0'], '斩铁': ['b53-0']
};
check(() => assert.deepEqual(D.blades.map(b => b.name).sort(), Object.keys(expectedIds).sort()));
for (const b of D.blades) check(() => assert.deepEqual(b.rows.map(row => row.id), expectedIds[b.name]));
check(() => {
  // Snapshot of the original 79 retained records' identity fields, captured before
  // these source corrections. Sorting allows card order changes, but preserves
  // the binding from each saved hunt ID to its exact blade/node/condition/source.
  const identity = hunts.map(row => [row.blade, row.id, row.node, String(row.stage), row.condition, row.source])
    .sort((a, b) => a[1].localeCompare(b[1], 'en'));
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  assert.equal(fingerprint, '7eee80f8323824b4383e87853e07b8bdd3884a0cdfb17c0bce2ceecdb9f46048');
});

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const records = []; let record = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === ',') { record.push(field); field = ''; }
    else if (char === '\r' || char === '\n') {
      record.push(field); records.push(record); record = []; field = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else field += char;
  }
  assert.equal(quoted, false, 'CSV has an unterminated quoted field');
  if (field !== '' || record.length) { record.push(field); records.push(record); }
  return records;
}
check(() => {
  const csvText = read('牵绊圆环精英条件.csv'), [header, ...records] = parseCsv(csvText);
  assert.equal(records.length, 79);
  assert.equal(header.length, 12);
  assert(records.every(row => row.length === header.length));
  for (const name of removedNames) assert(!csvText.includes(name), `Ordinary enemy remains in CSV: ${name}`);
  const col = name => { const index = header.indexOf(name); assert(index >= 0); return index; };
  const columns = ['异刃', '节点', '阶段', '获得条件原文', '节点来源'].map(col);
  const csvRows = records.map(row => columns.map(index => row[index])).sort();
  const dataRows = hunts.map(row => [row.blade, row.node, String(row.stage), row.condition, row.source]).sort();
  assert.deepEqual(csvRows, dataRows, 'CSV and the 79-row hunt data must describe the same requirements');
});
check(() => {
  assert.equal(M.blades.length, 55);
  assert.equal(M.blades.reduce((sum, b) => sum + b.tracks.length, 0), 493);
  assert.equal(M.blades.reduce((sum, b) => sum + b.tracks.reduce((n, t) => n + t.rows.length, 0), 0), 2189);
  assert.equal(M.blades.reduce((sum, b) => sum + b.gates.length, 0), 220);
  assert.equal(M.statistics.blades, 55);
  assert.equal(M.statistics.tracks, 493);
  assert.equal(M.statistics.skill_rows, 2189);
  assert.equal(M.statistics.gate_rows, 220);
  assert.equal(M.statistics.all_rows, 2409);
  assert.equal(M.statistics.skill_rows + M.statistics.gate_rows, M.statistics.all_rows);
});
check(() => {
  const context = {window: {}}; vm.createContext(context);
  vm.runInContext(read('data.js'), context, {filename: 'data.js'});
  const generated = context.window.XB2_DATA || context.XB2_DATA;
  assert(generated, 'Browser data bundle did not expose XB2_DATA');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(generated)).digest('hex'), crypto.createHash('sha256').update(before).digest('hex'), 'Browser bundle must contain the same corrected data as data.json');
  assert.equal(JSON.stringify(D), before, 'Source-correction checks must not mutate the data');
});
console.log(`Source corrections: ${checks} checks passed; corrected stages and appended row, 79 stable hunt IDs, ordinary kills retained, CSV and generated data synchronized.`);


'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
require('../merc-engine.js');
const E = globalThis.XB2_MERC_ENGINE;
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '../data.json'), 'utf8')).mercenary;
const clone = value => JSON.parse(JSON.stringify(value));
let checks = 0;
const check = fn => { fn(); checks++; };
const trustPattern = /信[赖賴]度/;
const sourceBefore = JSON.stringify(M.blades);
const labelSets = [
  {},
  Object.fromEntries((M.ruleGroups || []).map(group => [group.id, 'manual'])),
  Object.fromEntries((M.ruleGroups || []).map(group => [group.id, 'eligible']))
];

// Build records from actual Wiki rows only: complete every skill node in the
// currently opened tier, but do not open the next tier or change any condition.
function completedWithinTier(blade, tier) {
  return {
    name: blade.name,
    tier,
    confirmed: true,
    completed: Object.fromEntries(blade.tracks.map(track => [
      track.name,
      track.rows.filter(row => row.stage <= tier).length
    ]))
  };
}
function analyzeUnchanged(blade, profile, labels) {
  const before = clone(profile);
  const result = E.analyze(blade, profile, labels);
  assert.deepEqual(profile, before, `${blade.name}: analysis must not change the recorded progress`);
  assert.equal(typeof result.manualTier, 'boolean', `${blade.name}: manualTier must be a boolean`);
  return result;
}

check(() => assert.equal(M.blades.length, 55));
let trustGates = 0, nonTrustGates = 0, primaryCases = 0;
for (const blade of M.blades) {
  check(() => assert.deepEqual(blade.gates.map(row => row.stage), [2, 3, 4, 5]));
  for (let tier = 1; tier <= 4; tier++) {
    const rawGate = blade.gates.find(row => row.stage === tier + 1);
    assert(rawGate, `${blade.name}: missing actual stage ${tier + 1} gate`);
    const expectedManual = !trustPattern.test(rawGate.condition);
    if (expectedManual) nonTrustGates++; else trustGates++;
    primaryCases++;
    for (const labels of labelSets) {
      const profile = completedWithinTier(blade, tier);
      const result = analyzeUnchanged(blade, profile, labels);
      check(() => {
        assert.equal(result.status, 'tier_locked', `${blade.name}, tier ${tier}`);
        assert.equal(result.frontiers.length, 0);
        assert.equal(result.manualTier, expectedManual, `${blade.name}: ${rawGate.condition}`);
        assert(result.nextGate);
        for (const key of ['node', 'stage', 'effect', 'condition', 'source']) {
          assert.equal(result.nextGate[key], rawGate[key], `${blade.name}: nextGate.${key}`);
        }
        const source = new URL(result.nextGate.source);
        assert.equal(source.hostname, 'xenoblade2.cn');
        assert(source.hash.length > 1, `${blade.name}: nextGate must retain its Wiki anchor`);
        // The extra UI hint must not reclassify a gate or override a personal label.
        assert.deepEqual(result.nextGate.merc, E.effective(rawGate, labels));
      });

      const draft = clone(profile);
      draft.confirmed = false;
      const draftResult = analyzeUnchanged(blade, draft, labels);
      check(() => {
        assert.equal(draftResult.status, 'draft');
        assert.equal(draftResult.manualTier, false, `${blade.name}: an unconfirmed draft is not a tier blocker`);
      });

      // Leave one real, currently open skill node incomplete. Even when the
      // next gate is non-trust, a current skill frontier must not get this hint.
      const pending = clone(profile);
      const track = blade.tracks.find(item => pending.completed[item.name] > 0);
      assert(track, `${blade.name}: no open skill node found for tier ${tier}`);
      pending.completed[track.name]--;
      const pendingResult = analyzeUnchanged(blade, pending, labels);
      check(() => {
        assert(pendingResult.frontiers.length > 0);
        assert.notEqual(pendingResult.status, 'tier_locked');
        assert.equal(pendingResult.manualTier, false, `${blade.name}: an available skill frontier takes precedence`);
      });
    }
  }
  for (const labels of labelSets) {
    const complete = completedWithinTier(blade, 5);
    const result = analyzeUnchanged(blade, complete, labels);
    check(() => {
      assert.equal(result.status, 'complete');
      assert.equal(result.manualTier, false);
      assert.equal(result.nextGate, null);
    });
    complete.confirmed = false;
    const draft = analyzeUnchanged(blade, complete, labels);
    check(() => {
      assert.equal(draft.status, 'draft');
      assert.equal(draft.manualTier, false);
    });
  }
}
check(() => {
  assert.equal(primaryCases, 55 * 4);
  assert.equal(trustGates, 175);
  assert.equal(nonTrustGates, 45);
});

// Named regression examples retain real conditions and their original categories.
for (const [name, tier, expectedManual, expectedText] of [
  ['菲奥伦', 1, false, '提升信赖度 0/100'],
  ['力男', 2, true, '温柔的异刃'],
  ['玛瑙', 2, true, '采石场获得矿石'],
  ['七冰', 2, true, '达到2级以上后举办演唱会'],
  ['八重切', 1, true, '八重切 追求强敌1'],
  ['红莲', 3, true, '正义的伙伴6'],
  ['天威', 2, true, '使用必杀技 0/11']
]) {
  const blade = M.blades.find(item => item.name === name);
  const result = analyzeUnchanged(blade, completedWithinTier(blade, tier), {});
  check(() => {
    assert.equal(result.manualTier, expectedManual);
    assert(result.nextGate.condition.includes(expectedText));
  });
}

// Safety boundary only: remove gates from an isolated in-memory copy to model a
// missing source table. No nonexistent gate or condition is added to the site.
const missingSource = clone(M.blades.find(blade => blade.name === '玛瑙'));
missingSource.gates = [];
const missing = analyzeUnchanged(missingSource, completedWithinTier(missingSource, 2), {});
check(() => {
  assert.equal(missing.status, 'tier_locked');
  assert.equal(missing.nextGate, null);
  assert.equal(missing.manualTier, false, 'an absent gate must not become a manual-tier assertion');
});
check(() => assert.equal(JSON.stringify(M.blades), sourceBefore, 'the entire Wiki data set must remain unchanged'));
console.log(`Tier blockers: ${checks} scenarios passed; ${primaryCases} actual tier boundaries (${trustGates} trust, ${nonTrustGates} non-trust).`);

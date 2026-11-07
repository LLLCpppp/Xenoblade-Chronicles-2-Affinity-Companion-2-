'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
require('../merc-engine.js');
const E = globalThis.XB2_MERC_ENGINE;
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '../data.json'), 'utf8')).mercenary;
const clone = value => JSON.parse(JSON.stringify(value));
const dataBefore = JSON.stringify(M.blades);
const targets = [
  ['雷鼓', '雷电控制', 2, 2, '与各地城镇的人们对话 完成雷电控制的特训 0/2'],
  ['雷鼓', '雷电控制', 3, 4, '与各地城镇的人们对话 完成雷电控制的特训 0/4'],
  ['雷鼓', '雷电控制', 4, 6, '与各地城镇的人们对话 完成雷电控制的特训 0/6'],
  ['雷鼓', '雷电控制', 5, 7, '与各地城镇的人们对话 完成雷电控制的特训 0/7'],
  ['萤', '偷心', 2, 2, '与镇上的人对话并使用偷心获得道具 0/2'],
  ['萤', '偷心', 3, 4, '与镇上的人对话并使用偷心获得道具 0/4'],
  ['萤', '偷心', 4, 7, '与镇上的人对话并使用偷心获得道具 0/7']
];
const rows = targets.map(([name, trackName, stage, count, condition]) => {
  const blade = M.blades.find(item => item.name === name);
  assert(blade, `Missing actual Wiki blade: ${name}`);
  const track = blade.tracks.find(item => item.name === trackName);
  assert(track, `Missing actual Wiki branch: ${name}/${trackName}`);
  const index = track.rows.findIndex(row => row.stage === stage);
  assert(index >= 0, `Missing actual Wiki stage: ${name}/${trackName}/${stage}`);
  return {blade, track, index, row: track.rows[index], stage, count, condition};
});
const legacyIds = new Set([
  'training', 'steal',
  ...(M.ruleGroups || []).map(group => group.id),
  ...rows.map(item => item.row.review_id).filter(Boolean)
]);
const labelSets = [
  {},
  Object.fromEntries([...legacyIds].map(id => [id, 'manual'])),
  Object.fromEntries([...legacyIds].map(id => [id, 'eligible']))
];
let checks = 0;
const check = fn => { fn(); checks++; };
function fullProfile(blade) {
  return {
    name: blade.name,
    tier: 5,
    confirmed: true,
    completed: Object.fromEntries(blade.tracks.map(track => [track.name, track.rows.length]))
  };
}
function remainingRun(track, completed, tier, labels) {
  let total = 0, trust = 0;
  // Count only the actual consecutive eligible suffix from the new frontier.
  // A later manual row is still a blocker, even after the target row is done.
  for (let i = completed; i < track.rows.length; i++) {
    const row = track.rows[i];
    if (row.stage > tier || E.effective(row, labels).status !== 'eligible') break;
    total++;
    if (/信[赖賴]度/.test(row.condition)) trust++;
  }
  return {total, trust};
}

for (const item of rows) {
  const {blade, track, index, row, stage, count, condition} = item;
  check(() => {
    assert.equal(row.stage, stage);
    assert.equal(row.condition, condition);
    assert.equal(Number(row.condition.match(/0\/(\d+)$/)[1]), count);
    assert.equal(row.merc.status, 'manual');
    assert.equal(row.merc.rule, 'player_unique_action');
    const source = new URL(row.source);
    assert.equal(source.hostname, 'xenoblade2.cn');
    assert.equal(decodeURIComponent(source.pathname), `/异刃:${blade.name}/牵绊圆环`);
    assert.equal(decodeURIComponent(source.hash.slice(1)), track.name);
  });
  const originalRow = clone(row);
  for (const labels of labelSets) {
    const profile = fullProfile(blade);
    profile.completed[track.name] = index;
    const before = clone(profile);
    const result = E.analyze(blade, profile, labels);
    check(() => {
      // Fixed player confirmation must override legacy "eligible" markings.
      assert.equal(E.effective(row, labels).status, 'manual');
      assert.equal(E.effective(row, labels).rule, 'player_unique_action');
      assert.equal(result.status, 'manual');
      assert.equal(result.frontiers.length, 1);
      assert.equal(result.manual.length, 1);
      assert.equal(result.eligible.length, 0);
      assert.equal(result.frontiers[0].track, track.name);
      assert.equal(result.frontiers[0].completed, index);
      assert.equal(result.frontiers[0].row.condition, condition);
      assert.equal(result.frontiers[0].row.source, row.source);
      assert.deepEqual(E.mercNodeSummary(blade, profile, labels), {total: 0, trust: 0});
      assert.equal(E.countMercNodes(blade, profile, labels), 0);
      assert.deepEqual(profile, before);
      assert.deepEqual(row, originalRow);
    });

    const after = clone(profile);
    after.completed[track.name] = index + 1;
    const afterBefore = clone(after);
    const advanced = E.analyze(blade, after, labels);
    check(() => {
      assert(!advanced.frontiers.some(frontier => frontier.track === track.name && frontier.completed === index));
      const next = advanced.frontiers.find(frontier => frontier.track === track.name);
      if (index + 1 < track.rows.length) {
        assert(next, `${blade.name}/${track.name}: frontier must advance to the actual following row`);
        assert.equal(next.completed, index + 1);
        assert.equal(next.row.stage, track.rows[index + 1].stage);
        assert.equal(next.row.condition, track.rows[index + 1].condition);
        assert.equal(next.row.source, track.rows[index + 1].source);
      } else {
        assert.equal(next, undefined);
        assert(advanced.finished.some(frontier => frontier.track === track.name));
        assert.equal(advanced.status, 'complete');
      }
      assert.deepEqual(E.mercNodeSummary(blade, after, labels), remainingRun(track, index + 1, 5, labels));
      assert.deepEqual(after, afterBefore);
      assert.deepEqual(row, originalRow);
    });

    const closed = {
      name: blade.name,
      tier: stage - 1,
      confirmed: true,
      completed: Object.fromEntries(blade.tracks.map(branch => [
        branch.name, branch.rows.filter(candidate => candidate.stage < stage).length
      ]))
    };
    assert.equal(closed.completed[track.name], index);
    const closedBefore = clone(closed);
    const locked = E.analyze(blade, closed, labels);
    check(() => {
      assert(!locked.frontiers.some(frontier => frontier.track === track.name));
      const actual = locked.locked.find(frontier => frontier.track === track.name);
      assert(actual, `${blade.name}/${track.name}/${stage}: unopened node must stay locked`);
      assert.equal(actual.completed, index);
      assert.equal(actual.row.stage, stage);
      assert.equal(actual.row.condition, condition);
      assert.equal(actual.row.source, row.source);
      assert.deepEqual(E.mercNodeSummary(blade, closed, labels), {total: 0, trust: 0});
      assert.deepEqual(closed, closedBefore);
      assert.deepEqual(row, originalRow);
    });

    const complete = fullProfile(blade);
    const completeBefore = clone(complete);
    const finished = E.analyze(blade, complete, labels);
    check(() => {
      assert.equal(finished.status, 'complete');
      assert.equal(finished.frontiers.length, 0);
      assert.equal(finished.manual.length, 0);
      assert(finished.finished.some(frontier => frontier.track === track.name));
      assert.deepEqual(E.mercNodeSummary(blade, complete, labels), {total: 0, trust: 0});
      assert.deepEqual(complete, completeBefore);
    });
  }
}

// Only the seven special-action requirements change. The other thirty fixed
// conversation counters keep the player's earlier eligible confirmation.
let normalConversations = 0, uniqueActions = 0;
for (const blade of M.blades) {
  for (const group of blade.tracks.concat([{name: '阶段解锁', rows: blade.gates}])) {
    for (const row of group.rows) {
      if (row.merc.rule === 'player_unique_action') {
        uniqueActions++;
        check(() => assert(rows.some(item => item.row === row), 'Unexpected extra unique-action requirement'));
      }
      if (row.merc.rule !== 'player_conversation') continue;
      normalConversations++;
      const before = clone(row);
      for (const labels of labelSets) check(() => {
        assert.equal(row.merc.status, 'eligible');
        assert.equal(E.effective(row, labels).status, 'eligible');
        assert.equal(E.effective(row, labels).rule, 'player_conversation');
        assert.deepEqual(row, before);
      });
    }
  }
}
check(() => {
  assert.equal(rows.length, 7);
  assert.equal(uniqueActions, 7);
  assert.equal(normalConversations, 30);
  assert.equal(JSON.stringify(M.blades), dataBefore, 'Original Wiki sources, conditions and classifications must remain unchanged by analysis');
});
console.log(`Unique actions: ${checks} checks passed; 7 fixed manual requirements, 30 ordinary conversation counters preserved, and legacy labels cannot bypass special-action blockers.`);

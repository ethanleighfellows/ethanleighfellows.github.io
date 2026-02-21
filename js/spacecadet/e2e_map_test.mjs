#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const gameFiles = [
  "js/spacecadet/maths.js",
  "js/spacecadet/physics.js",
  "js/spacecadet/render.js",
  "js/spacecadet/loader.js",
  "js/spacecadet/table.js",
];

for (const file of gameFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInThisContext(source, { filename: file });
}

function loadDatAndProfiles() {
  const loader = new DatLoader();
  const profileCsv = fs.readFileSync(path.join(root, "js/spacecadet/collision_ramp_gate_oneway.csv"), "utf8");
  const rows = loader.parseCsv(profileCsv);
  for (const row of rows) {
    const groupId = Number(row.group_id);
    if (!Number.isFinite(groupId)) continue;
    loader.collisionProfileByGroup.set(groupId, {
      objectType: Number(row.object_type),
      objectTypeName: row.object_type_name,
      groupName: row.group_name,
      hasAnyCollisionTag: row.has_any_collision_tag === "true",
      tag600: loader.parseJsonArrayField(row.tag_600),
      tag603: loader.parseJsonArrayField(row.tag_603),
      tag1300: loader.parseJsonArrayField(row.tag_1300),
      tag1301: loader.parseJsonArrayField(row.tag_1301),
      tag1302: loader.parseJsonArrayField(row.tag_1302),
      tag1303: loader.parseJsonArrayField(row.tag_1303),
    });
  }
  loader.collisionCsvLoaded = true;

  const datBuffer = fs.readFileSync(path.join(root, "js/spacecadet/PINBALL_ENGLISH/pinball.dat"));
  const arrayBuffer = datBuffer.buffer.slice(datBuffer.byteOffset, datBuffer.byteOffset + datBuffer.byteLength);
  loader.datFile = loader.parse(arrayBuffer);
  return loader;
}

function createTable(loader) {
  const game = { loader, message: "" };
  const table = new TPinballTable(game);
  table.initialize(loader.datFile);
  table.newGame();
  return table;
}

function runBall(table, start, direction, speed, steps = 360, dt = 1 / 120) {
  table.timers = [];
  table.ballHeldAtPlunger = false;
  table.ball.active = true;
  table.ball.captureLocked = false;
  table.ball.position = new Vector2(start.x, start.y);
  table.ball.direction = new Vector2(direction.x, direction.y);
  table.ball.direction.normalize();
  table.ball.speed = speed;
  table.ball.stuckTime = 0;
  table.ball.alreadyHit.length = 0;

  let minY = Infinity;
  let maxY = -Infinity;
  let maxStallFrames = 0;
  let stallFrames = 0;

  for (let i = 0; i < steps; i++) {
    const px = table.ball.position.x;
    const py = table.ball.position.y;
    table.ball.update(dt);

    minY = Math.min(minY, table.ball.position.y);
    maxY = Math.max(maxY, table.ball.position.y);

    const moved = Math.hypot(table.ball.position.x - px, table.ball.position.y - py);
    if (table.ball.speed > 20 && moved < 0.0015) {
      stallFrames++;
      maxStallFrames = Math.max(maxStallFrames, stallFrames);
    } else {
      stallFrames = 0;
    }
    if (!table.ball.active) break;
  }

  return {
    active: table.ball.active,
    pos: { x: table.ball.position.x, y: table.ball.position.y },
    speed: table.ball.speed,
    minY,
    maxY,
    maxStallFrames,
  };
}

function createRng(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function testOriginalCollisionMapRampCoverage(loader) {
  const dat = loader.datFile;
  const objIdx = dat.record_labeled("table_objects");
  const objData = dat.query_iattribute(objIdx, 1025);
  assertCondition(!!objData && objData.length > 0, "original map: missing table_objects");

  const rampGroups = [];
  for (let i = 0; i < objData.length; i += 2) {
    const type = objData[i];
    const groupIdx = objData[i + 1];
    if (type === 1021) {
      const tag1300 = dat.query_float_attribute(groupIdx, 1300);
      const tag1301 = dat.query_float_attribute(groupIdx, 1301);
      const tag1302 = dat.query_float_attribute(groupIdx, 1302);
      const tag1303 = dat.query_float_attribute(groupIdx, 1303);
      assertCondition(!!tag1300 && !!tag1301 && !!tag1302 && !!tag1303, `original map: ramp ${groupIdx} missing 130x tags`);
      rampGroups.push(groupIdx);
    }
  }

  assertCondition(rampGroups.length >= 2, `original map: expected ramp objects, found ${rampGroups.length}`);

  const table = createTable(loader);
  const rampComps = table.components.filter((c) => c instanceof TRampCollision);
  assertCondition(rampComps.length >= rampGroups.length, "runtime map: not all original ramp groups built as ramp colliders");
}

function testOriginalCollisionMapRolloverCoverage(loader) {
  const dat = loader.datFile;
  const objIdx = dat.record_labeled("table_objects");
  const objData = dat.query_iattribute(objIdx, 1025);
  assertCondition(!!objData && objData.length > 0, "original map: missing table_objects");

  let rolloverCount = 0;
  let lightRolloverCount = 0;
  let tripwireCount = 0;
  let rolloverSecondaryCount = 0;
  for (let i = 0; i < objData.length; i += 2) {
    const type = objData[i];
    const groupIdx = objData[i + 1];
    if (type === 1015 || type === 1020 || type === 1024) {
      const tag600 = dat.query_float_attribute(groupIdx, 600);
      assertCondition(!!tag600, `original map: rollover-like group ${groupIdx} missing tag600`);
      const tag603 = dat.query_float_attribute(groupIdx, 603);
      if (type !== 1024) {
        assertCondition(!!tag603, `original map: rollover-like group ${groupIdx} missing tag603`);
        rolloverSecondaryCount++;
      }
      if (type === 1015) rolloverCount++;
      if (type === 1020) lightRolloverCount++;
      if (type === 1024) tripwireCount++;
    }
  }

  assertCondition(rolloverCount + lightRolloverCount + tripwireCount > 0, "original map: no rollover-like objects found");
  const table = createTable(loader);
  const rolloverComps = table.components.filter((c) => c instanceof TRolloverCollision && c.sourceObjectType === 1015);
  const lightRolloverComps = table.components.filter((c) => c instanceof TLightRolloverCollision);
  const tripwireComps = table.components.filter((c) => c instanceof TTripwireCollision);
  assertCondition(rolloverComps.length === rolloverCount, "runtime map: 1015 objects not instantiated as TRolloverCollision");
  assertCondition(lightRolloverComps.length === lightRolloverCount, "runtime map: 1020 objects not instantiated as TLightRolloverCollision");
  assertCondition(tripwireComps.length === tripwireCount, "runtime map: 1024 objects not instantiated as TTripwireCollision");
  const withSecondary = rolloverComps.filter((c) => c.useSecondary).length + lightRolloverComps.filter((c) => c.useSecondary).length;
  assertCondition(withSecondary >= rolloverSecondaryCount, "runtime map: secondary rollover walls are missing");
}

function testStateMachineTypeCoverage(loader) {
  const dat = loader.datFile;
  const objIdx = dat.record_labeled("table_objects");
  const objData = dat.query_iattribute(objIdx, 1025);
  assertCondition(!!objData && objData.length > 0, "coverage: missing table_objects");

  const typeCounts = new Map();
  for (let i = 0; i < objData.length; i += 2) {
    const type = objData[i];
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }

  const table = createTable(loader);
  const countByType = (type) => table.components.filter((c) => c.sourceObjectType === type).length;
  const countInstanceForType = (type, cls) =>
    table.components.filter((c) => c.sourceObjectType === type && c instanceof cls).length;
  const checks = [
    { type: 1000, cls: TWall, name: "TWall(1000)" },
    { type: 1001, cls: TPlunger, name: "TPlunger" },
    { type: 1002, cls: TLightComponent, name: "TLightComponent" },
    { type: 1003, cls: TFlipper, name: "TFlipper(Left)" },
    { type: 1004, cls: TFlipper, name: "TFlipper(Right)" },
    { type: 1005, cls: TBumper, name: "TBumper" },
    { type: 1006, cls: TPopupTargetCollision, name: "TPopupTargetCollision" },
    { type: 1007, cls: TDrain, name: "TDrain" },
    { type: 1010, cls: TWall, name: "TWall(1010)" },
    { type: 1011, cls: TBlockerCollision, name: "TBlockerCollision" },
    { type: 1012, cls: TKickoutCollision, name: "TKickoutCollision(1012)" },
    { type: 1013, cls: TGateCollision, name: "TGateCollision" },
    { type: 1014, cls: TKickbackCollision, name: "TKickbackCollision" },
    { type: 1015, cls: TRolloverCollision, name: "TRolloverCollision" },
    { type: 1016, cls: TOnewayCollision, name: "TOnewayCollision" },
    { type: 1017, cls: TSinkCollision, name: "TSinkCollision" },
    { type: 1018, cls: TFlagSpinnerCollision, name: "TFlagSpinnerCollision" },
    { type: 1019, cls: TSoloTargetCollision, name: "TSoloTargetCollision" },
    { type: 1020, cls: TLightRolloverCollision, name: "TLightRolloverCollision" },
    { type: 1021, cls: TRampCollision, name: "TRampCollision" },
    { type: 1022, cls: THoleCollision, name: "THoleCollision" },
    { type: 1023, cls: TDemoCollision, name: "TDemoCollision" },
    { type: 1024, cls: TTripwireCollision, name: "TTripwireCollision" },
    { type: 1026, cls: TLightGroupComponent, name: "TLightGroupComponent" },
    { type: 1028, cls: TComponentGroupComponent, name: "TComponentGroupComponent" },
    { type: 1029, cls: TKickoutCollision, name: "TKickoutCollision(1029)" },
    { type: 1030, cls: TLightBargraphComponent, name: "TLightBargraphComponent" },
    { type: 1031, cls: TSoundComponent, name: "TSoundComponent" },
    { type: 1032, cls: TTimerComponent, name: "TTimerComponent" },
    { type: 1033, cls: TTextBoxComponent, name: "TTextBoxComponent" },
  ];

  for (const check of checks) {
    const expected = typeCounts.get(check.type) || 0;
    if (expected <= 0) continue;
    const totalType = countByType(check.type);
    assertCondition(totalType === expected, `coverage: type ${check.type} expected ${expected}, got ${totalType}`);
    const actual = countInstanceForType(check.type, check.cls);
    assertCondition(actual === expected, `coverage: ${check.name} expected ${expected}, got ${actual}`);
  }

  const blockers = table.components.filter((c) => c instanceof TBlockerCollision);
  for (const blocker of blockers) {
    assertCondition(!blocker.activeFlagPtr.value, "coverage: blocker should start disabled");
  }

  const gates = table.components.filter((c) => c instanceof TGateCollision);
  for (const gate of gates) {
    assertCondition(gate.activeFlagPtr.value, "coverage: gate should start enabled");
  }

  const kickouts = table.components.filter((c) => c instanceof TKickoutCollision);
  const disabledKickouts = kickouts.filter((c) => c.sourceObjectType === 1029);
  assertCondition(disabledKickouts.every((c) => !c.activeFlagPtr.value), "coverage: 1029 kickout should start disabled");
}

function testStateMachineRuntimeCycles(loader) {
  const table = createTable(loader);
  const ball = table.ball;

  const sink = table.components.find((c) => c instanceof TSinkCollision);
  assertCondition(!!sink, "state-cycle: no sink component");
  table.ballHeldAtPlunger = false;
  ball.active = true;
  ball.captureLocked = false;
  sink.onCollision(ball, sink.ballPosition, null);
  assertCondition(ball.captureLocked, "state-cycle: sink did not capture ball");
  const sinkFrames = Math.ceil((sink.timerTime + 0.35) * 120);
  for (let i = 0; i < sinkFrames; i++) table.update(1 / 120);
  assertCondition(!ball.captureLocked, "state-cycle: sink did not release ball");
  let maxSpeed = ball.speed;
  let maxDist = 0;
  for (let i = 0; i < 30; i++) {
    table.update(1 / 120);
    maxSpeed = Math.max(maxSpeed, ball.speed);
    maxDist = Math.max(maxDist, Math.hypot(ball.position.x - sink.ballPosition.x, ball.position.y - sink.ballPosition.y));
  }
  assertCondition(maxSpeed > 10 || maxDist > 0.35, "state-cycle: sink release impulse not observed");

  const hole = table.components.find((c) => c instanceof THoleCollision);
  assertCondition(!!hole, "state-cycle: no hole component");
  ball.active = true;
  ball.captureLocked = false;
  hole.onCollision(ball, hole.center, null);
  assertCondition(ball.captureLocked, "state-cycle: hole did not capture ball");
  const holeFrames = Math.ceil((hole.captureTime + 0.35) * 120);
  for (let i = 0; i < holeFrames; i++) table.update(1 / 120);
  assertCondition(!ball.captureLocked, "state-cycle: hole did not release ball");
  let holeMaxSpeed = ball.speed;
  let holeMaxDist = 0;
  for (let i = 0; i < 25; i++) {
    table.update(1 / 120);
    holeMaxSpeed = Math.max(holeMaxSpeed, ball.speed);
    holeMaxDist = Math.max(holeMaxDist, Math.hypot(ball.position.x - hole.center.x, ball.position.y - hole.center.y));
  }
  assertCondition(holeMaxSpeed > 8 || holeMaxDist > 0.3, "state-cycle: hole release impulse not observed");

  const kickback = table.components.find((c) => c instanceof TKickbackCollision);
  assertCondition(!!kickback, "state-cycle: no kickback component");
  const edge = { getNormal: () => new Vector2(0, -1) };
  ball.active = true;
  ball.captureLocked = false;
  ball.position = new Vector2(0, 0);
  ball.direction = new Vector2(0, 1);
  ball.speed = 35;
  kickback.onCollision(ball, new Vector2(0, 0), edge);
  assertCondition(kickback.kickActive, "state-cycle: kickback did not arm");
  for (let i = 0; i < 100; i++) table.update(1 / 120);
  assertCondition(!kickback.kickActive, "state-cycle: kickback did not reset");

  const soloTarget = table.components.find((c) => c instanceof TSoloTargetCollision);
  assertCondition(!!soloTarget, "state-cycle: no solo target component");
  const soloEdge = { getNormal: () => new Vector2(0, -1) };
  ball.active = true;
  ball.position = new Vector2(0, 0);
  ball.direction = new Vector2(0, 1);
  ball.speed = 45;
  soloTarget.onCollision(ball, new Vector2(0, 0), soloEdge);
  assertCondition(!soloTarget.activeFlagPtr.value, "state-cycle: solo target did not disable on collision");
  for (let i = 0; i < 30; i++) table.update(1 / 120);
  assertCondition(soloTarget.activeFlagPtr.value, "state-cycle: solo target did not re-enable");

  const spinner = table.components.find((c) => c instanceof TFlagSpinnerCollision);
  assertCondition(!!spinner, "state-cycle: no flag spinner component");
  const spinnerEdge = spinner.edgeList[0];
  const spinnerStartFrame = spinner.currentState;
  ball.active = true;
  ball.position = new Vector2(0, 0);
  ball.direction = new Vector2(0, 1);
  ball.speed = 35;
  spinner.onCollision(ball, new Vector2(0, 0), spinnerEdge);
  for (let i = 0; i < 60; i++) table.update(1 / 120);
  assertCondition(spinner.currentState !== spinnerStartFrame, "state-cycle: spinner frame did not advance");
}

function testRightEntryRamp(loader) {
    const scenarios = [
        { start: { x: 6.6, y: 0.6 }, dir: { x: 0.08, y: -1 }, speed: 95 },
        { start: { x: 6.3, y: 1.2 }, dir: { x: 0.0, y: -1 }, speed: 110 },
    { start: { x: 6.8, y: 0.0 }, dir: { x: -0.1, y: -1 }, speed: 120 },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    const table = createTable(loader);
    const result = runBall(table, scenario.start, scenario.dir, scenario.speed);
    assertCondition(result.maxStallFrames < 16, `right_entry_${index + 1}: stalled at ramp mouth`);
    assertCondition(result.minY <= -2.4, `right_entry_${index + 1}: did not enter ramp lane (minY=${result.minY.toFixed(3)})`);
  }
}

function testRightEntryRampRegressionSweep(loader) {
  const scenarios = [
    { name: "ramp_regression_a", start: { x: 5.8, y: -0.4 }, dir: { x: -0.25, y: -1 }, speed: 65 },
    { name: "ramp_regression_b", start: { x: 5.8, y: -0.4 }, dir: { x: 0.15, y: -1 }, speed: 35 },
    { name: "ramp_regression_c", start: { x: 6.1, y: -0.2 }, dir: { x: -0.2, y: -1 }, speed: 55 },
    { name: "ramp_regression_d", start: { x: 6.0, y: 0.1 }, dir: { x: 0.1, y: -1 }, speed: 45 },
  ];

  for (const scenario of scenarios) {
    const table = createTable(loader);
    const result = runBall(table, scenario.start, scenario.dir, scenario.speed, 480);
    assertCondition(result.maxStallFrames < 20, `${scenario.name}: stalled near right entry ramp`);
    assertCondition(result.minY <= -2.4, `${scenario.name}: blocked at right entry ramp (minY=${result.minY.toFixed(3)})`);
  }
}

function testPlungerBottomLeakGuard(loader) {
  const table = createTable(loader);
  const result = runBall(table, { x: -7.0, y: 13.4 }, { x: 0.0, y: 1 }, 50, 180);
  assertCondition(result.active, "plunger leak: ball deactivated outside drain");
  assertCondition(result.pos.y <= table.edgeManager.maxY + 3.1, "plunger leak: ball escaped bottom bounds");
}

function testPlungerHoldAndLaunch(loader) {
  const table = createTable(loader);
  const holdPos = { x: table.ball.position.x, y: table.ball.position.y };

  for (let i = 0; i < 120; i++) {
    table.update(1 / 60);
  }

  assertCondition(table.ballHeldAtPlunger, "plunger hold: hold flag cleared before launch");
  assertCondition(Math.abs(table.ball.position.x - holdPos.x) < 0.01, "plunger hold: x drifted before launch");
  assertCondition(Math.abs(table.ball.position.y - holdPos.y) < 0.01, "plunger hold: y drifted before launch");
  assertCondition(table.ball.speed <= 0.001, "plunger hold: ball gained speed before launch");

  table.launchBall();
  assertCondition(!table.ballHeldAtPlunger, "plunger launch: hold flag not cleared");
  assertCondition(table.ball.speed >= 75, "plunger launch: launch speed too low");
  assertCondition(table.ball.direction.y < -0.8, "plunger launch: direction not upward");

  let minY = table.ball.position.y;
  for (let i = 0; i < 45; i++) {
    table.update(1 / 120);
    minY = Math.min(minY, table.ball.position.y);
  }
  assertCondition(minY < holdPos.y - 0.5, `plunger launch: ball did not move up lane (minY=${minY.toFixed(3)})`);
}

function testDrainConsumesBall(loader) {
  const table = createTable(loader);
  const result = runBall(
    table,
    { x: table.drainCenterX, y: table.drainTriggerY + 0.5 },
    { x: 0, y: 1 },
    24,
    60
  );
  assertCondition(!result.active, "drain behavior: center drain did not consume ball");
}

function testScoreAndBallState(loader) {
  const table = createTable(loader);
  assertCondition(table.score === 0, "score-state: expected initial score 0");
  assertCondition(table.ballsRemaining === table.ballsPerGame, "ball-state: expected initial balls to match configured count");

  const bumper = table.components.find((c) => c instanceof TBumper);
  assertCondition(!!bumper, "score-state: no bumper component");
  const edge = bumper.edgeList[0];
  assertCondition(!!edge, "score-state: bumper has no collision edge");
  table.ball.active = true;
  table.ball.position = new Vector2(table.ball.position.x, table.ball.position.y);
  table.ball.direction = new Vector2(0, 1);
  table.ball.speed = 35;
  bumper.onCollision(table.ball, table.ball.position, edge);
  assertCondition(table.score >= 100, "score-state: bumper collision did not increment score");

  const startingBalls = table.ballsRemaining;
  table.ball.active = true;
  table.ballHeldAtPlunger = false;
  table.ball.captureLocked = false;
  table.ball.position = new Vector2(table.drainCenterX, table.drainTriggerY + 0.65);
  table.ball.direction = new Vector2(0, 1);
  table.ball.speed = 24;
  for (let i = 0; i < 10; i++) table.update(1 / 120);
  assertCondition(table.ballsRemaining === startingBalls - 1, "ball-state: drain did not decrement balls remaining");
  assertCondition(table.respawnTimer > 0, "ball-state: expected respawn timer after drain");

  table.ballsRemaining = 1;
  table.ball.active = true;
  table.ballHeldAtPlunger = false;
  table.ball.captureLocked = false;
  table.ball.position = new Vector2(table.drainCenterX, table.drainTriggerY + 0.65);
  table.ball.direction = new Vector2(0, 1);
  table.ball.speed = 24;
  for (let i = 0; i < 10; i++) table.update(1 / 120);
  assertCondition(table.gameOver, "ball-state: expected game over when last ball drains");
}

function testLaunchEntersPlayfield(loader) {
  const table = createTable(loader);
  const startX = table.ball.position.x;
  const startY = table.ball.position.y;

  table.launchBall();

  let enteredPlayfield = false;
  let fellBelowApron = false;
  for (let i = 0; i < 480; i++) {
    table.update(1 / 120);
    if (!table.ball.active) break;
    if (table.ball.position.x >= startX + 2.0 && table.ball.position.y <= startY - 4.0) {
      enteredPlayfield = true;
    }
    if (table.ball.position.y > table.edgeManager.maxY + 0.6) {
      fellBelowApron = true;
      break;
    }
  }

  assertCondition(enteredPlayfield, "launch path: ball did not curve from shooter lane into playfield");
  assertCondition(!fellBelowApron, "launch path: ball fell below apron / plunger area");
}

function testRandomNoStallOrLeak(loader) {
  const rng = createRng(0xC0FFEE);
  const table = createTable(loader);

  for (let i = 0; i < 120; i++) {
    const x = table.edgeManager.minX + (table.edgeManager.maxX - table.edgeManager.minX) * rng();
    const y = table.edgeManager.minY + (table.edgeManager.maxY - table.edgeManager.minY) * rng();
    const dx = rng() * 2 - 1;
    const dy = rng() * 2 - 1;
    const speed = 40 + rng() * 120;
    const result = runBall(table, { x, y }, { x: dx, y: dy }, speed, 240);

    assertCondition(result.maxStallFrames < 24, `random_${i}: long stall detected`);
    if (!result.active) {
      const inDrain = table.isInDrainWindow(result.pos.x, result.pos.y, 1, 20);
      assertCondition(inDrain, `random_${i}: ball deactivated outside drain`);
    }
  }
}

function runSuite() {
  const loader = loadDatAndProfiles();
  const tests = [
    ["Original collision map ramp coverage", () => testOriginalCollisionMapRampCoverage(loader)],
    ["Original collision map rollover coverage", () => testOriginalCollisionMapRolloverCoverage(loader)],
    ["State machine type coverage", () => testStateMachineTypeCoverage(loader)],
    ["State machine runtime cycles", () => testStateMachineRuntimeCycles(loader)],
    ["Right entry ramp flow", () => testRightEntryRamp(loader)],
    ["Right entry ramp regression sweep", () => testRightEntryRampRegressionSweep(loader)],
    ["Plunger hold and launch", () => testPlungerHoldAndLaunch(loader)],
    ["Launch enters playfield", () => testLaunchEntersPlayfield(loader)],
    ["Plunger bottom leak guard", () => testPlungerBottomLeakGuard(loader)],
    ["Drain center consume", () => testDrainConsumesBall(loader)],
    ["Score and ball state", () => testScoreAndBallState(loader)],
    ["Random no stall/leak", () => testRandomNoStallOrLeak(loader)],
  ];

  const failures = [];
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`PASS: ${name}`);
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
      console.error(`FAIL: ${name} -> ${err.message}`);
    }
  }

  if (failures.length) {
    console.error(`\\nE2E failures (${failures.length}):`);
    for (const item of failures) console.error(`- ${item}`);
    process.exit(1);
  }
  console.log("\\nAll e2e map tests passed.");
}

runSuite();

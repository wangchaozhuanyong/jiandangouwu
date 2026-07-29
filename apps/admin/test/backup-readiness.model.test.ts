import assert from "node:assert/strict";
import test from "node:test";
import {
  backupControlCodes,
  backupGateCodes,
  backupResourceCodes,
  buildBackupReadiness,
} from "../src/features/backups/model";

test("backup readiness separates same-host persistence from backup evidence", () => {
  const result = buildBackupReadiness();

  assert.equal(result.localVolumeDefinitionCount, 2);
  assert.equal(result.awsProtectionDefinitionCount, 2);
  assert.equal(result.localBackupJobCount, 0);
  assert.equal(result.restoreDrillCount, 0);
  assert.deepEqual(result.resources.map((resource) => resource.code), backupResourceCodes);
  assert.deepEqual(result.resources.map((resource) => resource.backupState), [
    "NOT_A_BACKUP",
    "NOT_A_BACKUP",
    "NOT_DEPLOYED",
    "NOT_DEPLOYED",
  ]);
  assert.ok(result.resources.every((resource) => resource.restoreEvidence === "NOT_PERFORMED"));
});

test("backup readiness keeps repository controls explicit", () => {
  const result = buildBackupReadiness();

  assert.deepEqual(result.controls.map((control) => control.code), backupControlCodes);
  assert.deepEqual(result.controls.map((control) => control.state), [
    "DEFINED_LOCAL_CONFIG",
    "DEFINED_LOCAL_CONFIG",
    "DEFINED_INFRA",
    "DEFINED_INFRA",
    "DEFINED_INFRA",
    "DEFINED_INFRA",
  ]);
});

test("backup readiness keeps every launch and recovery gate open", () => {
  const result = buildBackupReadiness();

  assert.deepEqual(result.gates.map((gate) => gate.code), backupGateCodes);
  assert.deepEqual(result.gates.map((gate) => gate.state), [
    "NOT_IMPLEMENTED",
    "NOT_DEFINED",
    "NOT_DEPLOYED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_DEFINED",
    "NOT_DEFINED",
    "NOT_PERFORMED",
  ]);
});

test("backup readiness model never fabricates runtime backup metadata", () => {
  const serialized = JSON.stringify(buildBackupReadiness());

  for (const forbiddenField of [
    "backupId",
    "size",
    "checksum",
    "createdAt",
    "completedAt",
    "latestBackup",
    "restoreDuration",
    "integrityPassed",
  ]) {
    assert.equal(serialized.includes(`"${forbiddenField}"`), false);
  }
  for (const fabricatedValue of ["BKP-", "1.84 GB", "04:00", "30 days", "21m 48s"]) {
    assert.equal(serialized.includes(fabricatedValue), false);
  }
});

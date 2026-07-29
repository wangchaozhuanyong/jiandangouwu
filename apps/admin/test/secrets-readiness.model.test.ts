import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSecretReadiness,
  productionSecretBindings,
  secretControlCodes,
  secretDomainCodes,
  secretGateCodes,
} from "../src/features/secrets/model";

test("secret readiness reports repository definitions without runtime claims", () => {
  const result = buildSecretReadiness();

  assert.equal(result.sourceCount, 4);
  assert.equal(result.productionBindingCount, 6);
  assert.equal(result.frontendBindingCount, 0);
  assert.equal(result.automatedRotationCount, 0);
  assert.deepEqual(result.bindings, productionSecretBindings);
  assert.deepEqual(
    result.bindings.map((binding) => binding.code),
    [
      "DB_HOST",
      "DB_USER",
      "DB_PASSWORD",
      "REDIS_PASSWORD",
      "SESSION_SECRET",
      "AUTH_ENCRYPTION_KEY",
    ],
  );
  assert.ok(result.bindings.every((binding) => binding.consumer === "API_TASK"));
  assert.ok(result.bindings.every((binding) => binding.infrastructureState === "DEFINED_INFRA"));
  assert.ok(result.bindings.every((binding) => binding.runtimeState === "NOT_DEPLOYED"));
  assert.ok(result.bindings.every((binding) => binding.rotationState === "NOT_IMPLEMENTED"));
});

test("secret readiness keeps source domains and code controls explicit", () => {
  const result = buildSecretReadiness();

  assert.deepEqual(secretDomainCodes, [
    "DATABASE_CREDENTIALS",
    "CACHE_AUTHENTICATION",
    "ADMIN_SESSION",
    "APPLICATION_ENCRYPTION",
  ]);
  assert.deepEqual(result.controls.map((control) => control.code), secretControlCodes);
  assert.ok(result.controls.every((control) => control.state === "IMPLEMENTED_CODE"));
});

test("secret readiness keeps launch gates closed without deployment evidence", () => {
  const result = buildSecretReadiness();

  assert.deepEqual(result.gates.map((gate) => gate.code), secretGateCodes);
  assert.deepEqual(result.gates.map((gate) => gate.state), [
    "NOT_DEPLOYED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_DEFINED",
    "NOT_DEFINED",
  ]);
});

test("secret readiness model never projects values or fabricated metadata", () => {
  const serialized = JSON.stringify(buildSecretReadiness());

  for (const forbiddenField of [
    "value",
    "suffix",
    "version",
    "createdAt",
    "updatedAt",
    "rotatedAt",
    "lastRotatedAt",
  ]) {
    assert.equal(serialized.includes(`"${forbiddenField}"`), false);
  }
  for (const fabricatedCode of [
    "STRIPE_SIGNING_SECRET",
    "DATABASE_APP_PASSWORD",
    "CONTACT_ENCRYPTION_KEY",
    "TELEGRAM_BOT_TOKEN",
  ]) {
    assert.equal(serialized.includes(fabricatedCode), false);
  }
});

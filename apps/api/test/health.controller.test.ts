import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  HealthController,
  measureHealthProbe,
} from "../src/health/health.controller.js";

test("health reports additive MySQL and Valkey runtime evidence", async () => {
  let databaseProbeCount = 0;
  let valkeyProbeCount = 0;
  const controller = new HealthController({
    $queryRaw: async () => {
      databaseProbeCount += 1;
      return [{ value: 1 }];
    },
  } as never, {
    assertAvailable: async () => {
      valkeyProbeCount += 1;
    },
  } as never);

  const result = await controller.health();

  assert.equal(result.status, "healthy");
  assert.equal(result.database, "connected");
  assert.equal(result.valkey, "connected");
  assert.equal(databaseProbeCount, 1);
  assert.equal(valkeyProbeCount, 1);
  assert.equal(Number.isSafeInteger(result.latencyMs.database), true);
  assert.equal(Number.isSafeInteger(result.latencyMs.valkey), true);
  assert.ok(result.latencyMs.database >= 0);
  assert.ok(result.latencyMs.valkey >= 0);
  assert.equal(Number.isFinite(Date.parse(result.timestamp)), true);
});

test("health starts MySQL and Valkey probes in parallel", async () => {
  let databaseStarted = false;
  let valkeyStarted = false;
  let releaseDatabase: (() => void) | undefined;
  let releaseValkey: (() => void) | undefined;
  const databaseWait = new Promise<void>((resolve) => {
    releaseDatabase = resolve;
  });
  const valkeyWait = new Promise<void>((resolve) => {
    releaseValkey = resolve;
  });
  const controller = new HealthController({
    $queryRaw: async () => {
      databaseStarted = true;
      await databaseWait;
    },
  } as never, {
    assertAvailable: async () => {
      valkeyStarted = true;
      await valkeyWait;
    },
  } as never);

  const pending = controller.health();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(databaseStarted, true);
  assert.equal(valkeyStarted, true);
  releaseDatabase?.();
  releaseValkey?.();
  await pending;
});

test("timed health probes reject without waiting indefinitely", async () => {
  const startedAt = performance.now();

  await assert.rejects(
    measureHealthProbe(() => new Promise(() => undefined), 5),
    /Health probe timed out/u,
  );

  assert.ok(performance.now() - startedAt < 250);
  await assert.rejects(
    measureHealthProbe(async () => undefined, 0),
    /positive safe integer/u,
  );
});

test("dependency failures never return a healthy response", async () => {
  const controller = new HealthController({
    $queryRaw: async () => {
      throw new Error("database details must not reach the response");
    },
  } as never, {
    assertAvailable: async () => undefined,
  } as never);

  await assert.rejects(
    controller.health(),
    (error: unknown) => (
      error instanceof ServiceUnavailableException
      && error.message === "A required health dependency is unavailable."
    ),
  );
});

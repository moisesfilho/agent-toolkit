import { performance } from "node:perf_hooks";

import { acquireRecoveryGuard } from "../../src/note-writer.mjs";

const [recoveryPath] = process.argv.slice(2);
const clock = { monotonicMs: () => performance.now() };
await acquireRecoveryGuard(recoveryPath, clock.monotonicMs(), {
  waitMs: 500,
  deadline: performance.now() + 2000,
  clock,
});
process.stdout.write("guarded\n");
process.kill(process.pid, "SIGKILL");

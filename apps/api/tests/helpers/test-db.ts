import { vi, type Mock } from "vitest";

/**
 * Creates a mock Drizzle transaction that records calls and returns configurable results.
 * Supports chained query builder patterns: select().from().where().limit(), insert().values().returning(), etc.
 */
export function createMockTx() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let selectResult: unknown[] = [];
  let insertResult: unknown[] = [];
  let updateResult: unknown[] = [];

  function recordCall(method: string, ...args: unknown[]) {
    calls.push({ method, args });
  }

  // Chain builder for select
  const selectChain: any = {
    from: vi.fn((...args: unknown[]) => {
      recordCall("from", ...args);
      return selectChain;
    }),
    where: vi.fn((...args: unknown[]) => {
      recordCall("where", ...args);
      return selectChain;
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      recordCall("orderBy", ...args);
      return selectChain;
    }),
    limit: vi.fn((...args: unknown[]) => {
      recordCall("limit", ...args);
      return selectChain;
    }),
    then: undefined as any,
  };

  // Make selectChain thenable so `await tx.select()...` works
  selectChain.then = function (resolve: any, reject: any) {
    return Promise.resolve(selectResult).then(resolve, reject);
  };

  // Chain builder for insert
  const insertChain: any = {
    values: vi.fn((...args: unknown[]) => {
      recordCall("values", ...args);
      return insertChain;
    }),
    returning: vi.fn((...args: unknown[]) => {
      recordCall("returning", ...args);
      return insertChain;
    }),
    onConflictDoNothing: vi.fn((...args: unknown[]) => {
      recordCall("onConflictDoNothing", ...args);
      return insertChain;
    }),
    then: undefined as any,
  };

  insertChain.then = function (resolve: any, reject: any) {
    return Promise.resolve(insertResult).then(resolve, reject);
  };

  // Chain builder for update
  const updateChain: any = {
    set: vi.fn((...args: unknown[]) => {
      recordCall("set", ...args);
      return updateChain;
    }),
    where: vi.fn((...args: unknown[]) => {
      recordCall("where", ...args);
      return updateChain;
    }),
    returning: vi.fn((...args: unknown[]) => {
      recordCall("returning", ...args);
      return updateChain;
    }),
    then: undefined as any,
  };

  updateChain.then = function (resolve: any, reject: any) {
    return Promise.resolve(updateResult).then(resolve, reject);
  };

  const tx = {
    select: vi.fn((...args: unknown[]) => {
      recordCall("select", ...args);
      return selectChain;
    }),
    insert: vi.fn((...args: unknown[]) => {
      recordCall("insert", ...args);
      return insertChain;
    }),
    update: vi.fn((...args: unknown[]) => {
      recordCall("update", ...args);
      return updateChain;
    }),
    delete: vi.fn((...args: unknown[]) => {
      recordCall("delete", ...args);
      return updateChain; // reuse update chain for where/returning
    }),
    execute: vi.fn(),
  };

  return {
    tx,
    calls,
    /** Configure what select queries will return */
    setSelectResult(result: unknown[]) {
      selectResult = result;
    },
    /** Configure what insert().returning() will return */
    setInsertResult(result: unknown[]) {
      insertResult = result;
    },
    /** Configure what update queries will return */
    setUpdateResult(result: unknown[]) {
      updateResult = result;
    },
    /** Reset all mocks and call history */
    reset() {
      calls.length = 0;
      selectResult = [];
      insertResult = [];
      updateResult = [];
      vi.clearAllMocks();
    },
  };
}

/**
 * Creates a mock for withTenantContext that calls the callback with the mock tx,
 * bypassing the real database entirely.
 */
export function mockWithTenantContext(mockTx: ReturnType<typeof createMockTx>) {
  return vi.fn(
    async (_orgId: string, fn: (tx: any) => Promise<any>) => {
      return fn(mockTx.tx);
    }
  );
}

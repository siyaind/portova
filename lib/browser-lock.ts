export type Lease = { release(): Promise<void> };
export type LockProvider = { request<T>(name: string, options: { ifAvailable?: boolean }, callback: (lock: unknown | null) => Promise<T>): Promise<T> };

/** No local-storage imitation of a mutex: signing fails closed without real cross-tab exclusion. */
export function acquireLease(name: string, locks: LockProvider | undefined): Promise<Lease> {
  if (!locks) return Promise.reject(new Error("This browser cannot coordinate safe signing across tabs. Use a current browser with Web Locks over HTTPS (or localhost)."));
  return new Promise((resolve, reject) => {
    let task: Promise<unknown>;
    task = locks.request(name, { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error("Another tab is using this launch. Finish or close its wallet request, then review again here.")); return; }
      let release!: () => void;
      const held = new Promise<void>(done => { release = done; });
      resolve({ release: () => { release(); return task.then(() => undefined); } });
      await held;
    });
    void task.catch(reject);
  });
}
export async function withBrowserLock<T>(name: string, action: () => Promise<T> | T): Promise<T> {
  if (!navigator.locks) throw new Error("Browser coordination is unavailable. Use a current browser over HTTPS or localhost.");
  return navigator.locks.request(name, action);
}

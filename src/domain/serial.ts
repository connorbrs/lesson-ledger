/**
 * Runs async jobs one at a time, in call order. A job starts only after the previous one has settled (fulfilled or
 * rejected), and a failure never blocks the jobs behind it. Used so only one PDF build holds receipt photos at a time.
 */
export function createSerialRunner(): <T>(job: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  };
}

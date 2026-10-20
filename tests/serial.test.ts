import { describe, expect, it } from 'vitest';
import { createSerialRunner } from '../src/domain/serial';

describe('createSerialRunner (WR-02)', () => {
  it('never runs two jobs at once and keeps call order', async () => {
    const run = createSerialRunner();
    const events: string[] = [];
    let active = 0;
    let maxActive = 0;
    const job = (name: string, ms: number) => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      events.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, ms));
      events.push(`end ${name}`);
      active--;
      return name;
    };
    const results = await Promise.all([run(job('a', 10)), run(job('b', 1)), run(job('c', 1))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(maxActive).toBe(1);
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('a failed job rejects its own caller and does not block the next job', async () => {
    const run = createSerialRunner();
    const failing = run(async () => {
      throw new Error('boom');
    });
    const next = run(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });
});

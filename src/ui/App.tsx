import { useState } from 'preact/hooks';
import { createFamily, listActiveFamilies } from '../data/families';
import { useLive } from '../data/live';

export function App() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const families = useLive(listActiveFamilies);

  async function add() {
    setBusy(true);
    try {
      await createFamily(name);
      setName('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Lesson Ledger</h1>
      <input
        type="text"
        value={name}
        autocapitalize="words"
        style={{ fontSize: '17px' }}
        onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
      />
      <button type="button" disabled={busy || name.trim() === ''} onClick={add}>
        Add Family
      </button>
      <ul>
        {(families ?? []).map((f) => (
          <li key={f.id}>{f.name}</li>
        ))}
      </ul>
      <p>
        <a href="?spike">Device check</a>
      </p>
    </main>
  );
}

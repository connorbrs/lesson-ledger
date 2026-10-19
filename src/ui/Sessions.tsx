import { useLive } from '../data/live';
import { listSessions, loadNameMaps } from '../data/sessions';
import { Group, Row } from './components';

/** First flat list of every session. Plan 02-02 replaces it with the period view. */
export function Sessions() {
  const data = useLive(async () => ({ sessions: await listSessions(), names: await loadNameMaps() }));
  return (
    <>
      <h1 class="large-title">Sessions</h1>
      {data && data.sessions.length > 0 && (
        <Group>
          {data.sessions.map((s) => (
            <Row key={s.id} value={`Lesson ${s.lessonMinutes} min`}>
              {s.date} · {s.attendees.map((a) => data.names.students[a.studentId]).join(', ')}
            </Row>
          ))}
        </Group>
      )}
    </>
  );
}

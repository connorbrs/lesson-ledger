import { useState } from 'preact/hooks';
import { shareCaption, type ShareError } from '../domain/split';
import { AmountField, Group } from './components';

/** The Split group of the Expense editor (two-family swim only): one amount field per family, in pick order. */
export function SplitGroup(props: {
  familyIds: [string, string];
  familyNames: Record<string, string>;
  texts: [string, string];
  error: ShareError | null;
  total: number;
  overridden: boolean;
  onInput: (index: 0 | 1, text: string) => void;
  onSplitEqually: () => void;
}) {
  // A caption shows once its field holds text or has been left once, so an untouched blank field stays quiet.
  const [left, setLeft] = useState<[boolean, boolean]>([false, false]);
  return (
    <Group
      header="Split"
      headerAction={props.overridden ? { label: 'Split Equally', onClick: props.onSplitEqually } : undefined}
      footer="Split equally by default. Type one family's share and the other fills in to make the total."
    >
      {([0, 1] as const).map((i) => {
        const error = props.error?.index === i && (props.texts[i].trim() !== '' || left[i]) ? props.error : null;
        return (
          <AmountField
            key={props.familyIds[i]}
            label={props.familyNames[props.familyIds[i]] ?? ''}
            value={props.texts[i]}
            hint="0.00"
            caption={error ? shareCaption(error, props.total) : null}
            invalid={props.error?.index === i}
            onInput={(text) => props.onInput(i, text)}
            onBlur={() => setLeft((l) => (i === 0 ? [true, l[1]] : [l[0], true]))}
          />
        );
      })}
    </Group>
  );
}

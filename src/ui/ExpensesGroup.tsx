import { expensesFooterText, receiptsLabel, resolveSplits, splitLine, type ExpenseDraft } from '../domain/expense';
import { formatCents } from '../domain/money';
import { Group, Row } from './components';

/** The Expenses group of the session form: one row per expense, then Add Expense (D-01). */
export function ExpensesGroup(props: {
  expenses: ExpenseDraft[];
  familyIds: string[];
  familyNames: Record<string, string>;
  onOpen: (id: string | null) => void;
}) {
  return (
    <Group header="Expenses" footer={expensesFooterText(props.expenses)}>
      {props.expenses.map((e) => {
        const splits = props.familyIds.length === 2 ? resolveSplits(e, props.familyIds) : null;
        const split = splits ? splitLine(splits, props.familyNames) : null;
        return (
          <button key={e.id} type="button" class="row expense-row" onClick={() => props.onOpen(e.id)}>
            <span class="expense-text">
              <span class="clamp2">{e.description}</span>
              <span class="row-sub">{receiptsLabel(e.photoIds.length)}</span>
              {split && <span class="row-sub clamp2">{split}</span>}
            </span>
            <span class="expense-amount">{formatCents(e.amountCents)}</span>
          </button>
        );
      })}
      <Row tone="accent" onClick={() => props.onOpen(null)}>
        Add Expense
      </Row>
    </Group>
  );
}

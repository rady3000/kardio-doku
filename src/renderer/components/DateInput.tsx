// Date entry in German notation (TT.MM.JJJJ). Parsed on blur; invalid input is
// shown as an error and not saved.
import { useEffect, useState } from 'react';
import { formatGermanDate, parseGermanDate } from '../../shared/dates';
import { inputClass } from './ui';

export function DateInput(props: {
  id: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  onError: (message: string | null) => void;
  allowEmpty?: boolean;
  autoFocus?: boolean;
}) {
  const { value, onChange, onError, allowEmpty = true } = props;
  const [text, setText] = useState(formatGermanDate(value));

  useEffect(() => setText(formatGermanDate(value)), [value]);

  const commit = () => {
    if (text.trim() === '') {
      if (allowEmpty) {
        onError(null);
        onChange(null);
      } else {
        onError('Datum erforderlich (TT.MM.JJJJ)');
      }
      return;
    }
    const iso = parseGermanDate(text);
    if (!iso) {
      onError('Ungültiges Datum (TT.MM.JJJJ)');
      return;
    }
    onError(null);
    setText(formatGermanDate(iso));
    onChange(iso);
  };

  return (
    <input
      id={props.id}
      className={`${inputClass} w-32 tabular-nums`}
      value={text}
      placeholder="TT.MM.JJJJ"
      autoFocus={props.autoFocus}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

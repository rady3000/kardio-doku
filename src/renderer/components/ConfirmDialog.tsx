import { useEffect, useRef, useState, type ReactNode } from 'react';
import { buttonClass, primaryButtonClass } from './ui';

/** Modal confirmation. With `acknowledge`, the confirm button stays disabled until the box is ticked. */
export function ConfirmDialog(props: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  acknowledge?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [ack, setAck] = useState(!props.acknowledge);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        props.onCancel();
      }}
      className="m-auto w-[34rem] rounded-sm border border-slate-300 p-0 shadow-lg backdrop:bg-slate-900/30"
    >
      <div className="border-b border-slate-200 px-4 py-2.5 text-[14px] font-semibold">{props.title}</div>
      <div className="space-y-2 px-4 py-3 text-slate-700">{props.children}</div>
      {props.acknowledge && (
        <label className="flex items-center gap-2 px-4 pb-3">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} autoFocus />
          {props.acknowledge}
        </label>
      )}
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
        <button type="button" className={buttonClass} onClick={props.onCancel} autoFocus={!props.acknowledge}>
          Abbrechen
        </button>
        <button type="button" className={primaryButtonClass} disabled={!ack} onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

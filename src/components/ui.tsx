import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ReactElement,
} from 'react';
import { X, Check, AlertCircle, Inbox } from 'lucide-react';

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const element = ref.current;
    (
      element?.querySelector<HTMLElement>('input, select, textarea') ??
      element?.querySelector<HTMLElement>('button')
    )?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const focusable = [
          ...(element?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ) ?? []),
        ];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = scroll;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  let found = false;
  const attach = (node: ReactNode): ReactNode => {
    if (!isValidElement(node)) return node;
    const child = node as ReactElement<{ children?: ReactNode; id?: string }>;
    if (
      !found &&
      typeof child.type === 'string' &&
      ['input', 'select', 'textarea'].includes(child.type)
    ) {
      found = true;
      return cloneElement(child, {
        id,
        ...{ 'aria-describedby': hint ? `${id}-hint` : undefined },
      });
    }
    return child.props.children
      ? cloneElement(child, { children: Children.map(child.props.children, attach) })
      : child;
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, attach)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Toast({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className={`toast ${error ? 'toast-error' : ''}`} role={error ? 'alert' : 'status'}>
      {error ? <AlertCircle size={18} /> : <Check size={18} />}
      {message}
    </div>
  );
}
export function AppIcon({ app, size = 'normal' }: { app: string; size?: 'normal' | 'small' }) {
  const kind = app.includes('eberick')
    ? 'eberick'
    : app.includes('excel')
      ? 'excel'
      : app.includes('chrome') || app.includes('edge')
        ? 'browser'
        : app.includes('outlook')
          ? 'outlook'
          : app.includes('code')
            ? 'code'
            : 'generic';
  const letter = {
    eberick: 'E',
    excel: 'X',
    browser: '◉',
    outlook: 'O',
    code: '⌘',
    generic: app.slice(0, 1).toUpperCase() || '·',
  }[kind];
  return (
    <span
      className={`app-icon app-${kind} ${size === 'small' ? 'app-small' : ''}`}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

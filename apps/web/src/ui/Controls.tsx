/**
 * Les contrôles ordinaires de la page (cahier §11.8, §12.4) : tout se règle au
 * clavier, chaque champ porte un libellé lisible par un lecteur d'écran, et
 * rien de tout cela ne vit dans le canevas.
 */
import type { JSX, ReactNode } from "react";

export interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly help?: string;
  readonly children: ReactNode;
}

export function Field({ id, label, help, children }: FieldProps): JSX.Element {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {help === undefined ? null : (
        <p className="help" id={`${id}-help`}>
          {help}
        </p>
      )}
    </div>
  );
}

export interface SliderProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit?: string;
  readonly help?: string;
  readonly invalid?: boolean;
  readonly onChange: (value: number) => void;
}

export function Slider({ id, label, value, min, max, step, unit, help, invalid, onChange }: SliderProps): JSX.Element {
  const texte = unit === undefined ? String(value) : `${value} ${unit}`;
  return (
    <Field id={id} label={label} help={help}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-invalid={invalid === true}
        aria-valuetext={texte}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={id} className="value">
        {texte}
      </output>
    </Field>
  );
}

export interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly invalid?: boolean;
  readonly onChange: (value: string) => void;
}

export function TextField({ id, label, value, invalid, onChange }: TextFieldProps): JSX.Element {
  return (
    <Field id={id} label={label}>
      <input
        id={id}
        type="text"
        value={value}
        aria-invalid={invalid === true}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export interface ToggleProps {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly help?: string;
  readonly onChange: (checked: boolean) => void;
}

export function Toggle({ id, label, checked, help, onChange }: ToggleProps): JSX.Element {
  return (
    <Field id={id} label={label} help={help}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </Field>
  );
}

export interface ChoiceProps<T extends string | number> {
  readonly id: string;
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly help?: string;
  readonly invalid?: boolean;
  readonly onChange: (value: T) => void;
}

export function Choice<T extends string | number>({
  id,
  label,
  value,
  options,
  help,
  invalid,
  onChange,
}: ChoiceProps<T>): JSX.Element {
  return (
    <Field id={id} label={label} help={help}>
      <select
        id={id}
        value={String(value)}
        aria-invalid={invalid === true}
        onChange={(event) => {
          const trouve = options.find((option) => String(option.value) === event.target.value);
          if (trouve !== undefined) onChange(trouve.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export interface PanelProps {
  readonly title: string;
  readonly onClose?: () => void;
  readonly closeLabel?: string;
  readonly children: ReactNode;
}

/** Un panneau : titre, contenu, fermeture au clavier (Échap géré par l'appelant). */
export function Panel({ title, onClose, closeLabel, children }: PanelProps): JSX.Element {
  return (
    <section className="panel" aria-label={title}>
      <header className="panel-head">
        <h2>{title}</h2>
        {onClose === undefined ? null : (
          <button type="button" className="ghost" onClick={onClose}>
            {closeLabel ?? "×"}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

export interface ButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly primary?: boolean;
}

export function Button({ label, onClick, disabled, primary }: ButtonProps): JSX.Element {
  return (
    <button type="button" className={primary === true ? "primary" : undefined} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

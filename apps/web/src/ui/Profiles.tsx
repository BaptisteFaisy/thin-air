/**
 * Le sélecteur de profil de mobilité (cahier §3, §12.4, AIR-N-06) : trois
 * boutons, utilisables au clavier comme à la souris, avec `aria-pressed` sur
 * le profil actif. Les libellés viennent de l'extérieur (`m`) : rien n'est
 * écrit en dur ici.
 */
import type { JSX } from "react";
import { PROFILES, type ProfileId } from "../state/profiles.js";
import type { ProfileMessages } from "../i18n/profiles.en.js";

export interface ProfilesProps {
  readonly m: ProfileMessages;
  readonly active: ProfileId | null;
  readonly onApply: (id: ProfileId) => void;
  readonly onClear: () => void;
}

export function Profiles({ m, active, onApply, onClear }: ProfilesProps): JSX.Element {
  return (
    <section role="group" aria-label={m.title}>
      <p className="help">{m.intro}</p>
      <div className="profiles">
        {PROFILES.map((profil) => {
          const libelle = m[profil.id];
          const choisi = active === profil.id;
          return (
            <button
              key={profil.id}
              type="button"
              className={choisi ? "profile is-active" : "profile"}
              aria-pressed={choisi}
              onClick={() => onApply(profil.id)}
            >
              <span className="profile-name">{libelle.name}</span>
              <span className="profile-effect">{libelle.effect}</span>
            </button>
          );
        })}
      </div>
      {active === null ? null : (
        <button type="button" className="ghost" onClick={onClear}>
          {m.none}
        </button>
      )}
    </section>
  );
}
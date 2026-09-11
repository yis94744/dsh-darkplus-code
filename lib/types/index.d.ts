/**
 * Public surface of dsh-darkplus-code's host half.
 *
 * The host owns the durable settings document only
 * (`~/.dsh-darkplus-code/config.json`) and serves it over
 * `GET|PUT /darkplus-code/settings`. It exposes no service that other plugins
 * should depend on.
 */

/** Appearance mode for the code-block font size. */
export type DarkplusSizeMode = 'follow' | 'scale' | 'fixed';

/** Which Dark+ token color the shared type/function variable receives. */
export type DarkplusPaletteVariant = 'typeTeal' | 'funcYellow';

/** Stored code-block appearance settings. */
export interface DarkplusSettings {
  /** Whether the Dark+ palette is applied at all. */
  readonly palette: boolean;
  /** Which color `--shiki-token-function` receives. */
  readonly variant: DarkplusPaletteVariant;
  /** How the code-block font size is derived. */
  readonly mode: DarkplusSizeMode;
  /** Multiplier used when `mode` is `scale` (0.5–2). */
  readonly ratio: number;
  /** Absolute px used when `mode` is `fixed` (9–32). */
  readonly fixedPx: number;
  /** Optional font-family override; empty keeps DSH's own code font. */
  readonly fontFamily: string;
}

/** Response shape of the settings route. */
export interface DarkplusSettingsResponse {
  readonly ok: boolean;
  readonly settings?: DarkplusSettings;
  readonly error?: string;
}

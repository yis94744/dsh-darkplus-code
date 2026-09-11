/**
 * Public surface of dsh-darkplus-code's browser half.
 *
 * The client half is loaded by the DSH web shell through this package's
 * `dsh.client` manifest; it exports the standard cordis plugin pair.
 */

/** Required client service: the slot registry the settings row is drawn into. */
export declare const inject: readonly string[];

/**
 * Client plugin body: installs the code-block stylesheet, restores the
 * persisted appearance settings from the host route, and registers the
 * settings row.
 */
export declare function apply(ctx: unknown): void;

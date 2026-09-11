window.__ModuleLoader__.load({
	id: "dsh-darkplus-code",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");

		/** Same-origin route mounted by this plugin's host half. */
		const SETTINGS_URL = "/darkplus-code/settings";

		/** Required service: the slot registry we draw the settings row into. */
		const inject = ["slots"];

		// ── Palette ───────────────────────────────────────────────────────────
		// VS Code Dark+ / Light+ token colors. DSH renders code through shiki's
		// css-variables theme: every token span carries
		// `style="color:var(--shiki-token-*)"`, and shiki assigns each TextMate
		// scope to one of those variables. This plugin rewrites those variables
		// AND pins the resolved color on the span itself, because the var()
		// reference does not always resolve on the span (measured: the variable
		// carries the right value on <body> while the span still computed to the
		// inherited color). `!important` on an author rule is the one thing that
		// outranks the inline non-important declaration shiki emits.
		const DARK = {
			"token-keyword": "#c586c0",
			"token-constant": "#b5cea8",
			"token-string": "#ce9178",
			"token-string-expression": "#ce9178",
			"token-comment": "#6a9955",
			"token-parameter": "#9cdcfe",
			"token-punctuation": "#d4d4d4",
			"token-link": "#4fc1ff",
			"token-inserted": "#b5cea8",
			"token-deleted": "#f44747",
			"token-changed": "#569cd6",
			foreground: "#9cdcfe",
			background: "#1e1e1e",
		};
		const LIGHT = {
			"token-keyword": "#af00db",
			"token-constant": "#098658",
			"token-string": "#a31515",
			"token-string-expression": "#a31515",
			"token-comment": "#008000",
			"token-parameter": "#001080",
			"token-punctuation": "#1f1f1f",
			"token-link": "#0563c1",
			"token-inserted": "#098658",
			"token-deleted": "#e51400",
			"token-changed": "#0000ff",
			foreground: "#001080",
			background: "#ffffff",
		};
		/** `token-function` carries both type names and function names in shiki's
		 *  mapping, so the two cannot differ — the variant picks which one wins. */
		const VARIANTS = {
			typeTeal: { label: "类型/函数 青", dark: "#4ec9b0", light: "#267f99" },
			funcYellow: { label: "函数 黄", dark: "#dcdcaa", light: "#795e26" },
		};
		/**
		 * Token variables in the order their rules must be emitted.
		 *
		 * The pin rules use `[style*="--shiki-token-string"]`, and a span whose
		 * style is `color:var(--shiki-token-string-expression)` also contains
		 * `--shiki-token-string`, so BOTH rules match it. They have identical
		 * specificity, so the one declared later wins — which means the
		 * *shorter* prefix must come first and its longer sibling last, or
		 * `token-string` would silently overwrite `token-string-expression`.
		 */
		const TOKEN_VARS = [
			"token-string",
			"token-string-expression",
			"token-keyword",
			"token-constant",
			"token-comment",
			"token-parameter",
			"token-punctuation",
			"token-link",
			"token-inserted",
			"token-deleted",
			"token-changed",
			"foreground",
		];

		const DEFAULTS = {
			palette: true,
			variant: "typeTeal",
			mode: "follow",
			ratio: 0.9,
			fixedPx: 15,
			fontFamily: "",
		};

		/** Current settings; mirrored from the host file. */
		let settings = { ...DEFAULTS };
		/** Subscribers re-rendered when settings change (settings row + any UI). */
		const listeners = new Set();
		/** Style element owned by this plugin (created once, text replaced). */
		let styleTag = null;
		/** Disposer for the theme override layer, when a theme service exists. */
		let themeDispose = null;
		/** The cordis context captured in apply, for the theme service. */
		let ctxRef = null;

		function subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		}

		function emit() {
			for (const fn of [...listeners]) {
				try {
					fn();
				} catch {
					/* a broken subscriber must not break the others */
				}
			}
		}

		function snapshot() {
			return { ...settings };
		}

		// ── CSS generation ────────────────────────────────────────────────────

		/** `--shiki-*` variable declaration block for one scheme. */
		function varBlock(palette) {
			const lines = [];
			for (const name of TOKEN_VARS) {
				lines.push(`  --shiki-${name}: ${palette[name]} !important;`);
			}
			lines.push(`  --shiki-background: ${palette.background} !important;`);
			return lines.join("\n");
		}

		/** Attribute selectors that pin each token color on the span itself. */
		function pinBlock(variant) {
			const out = [];
			for (const name of TOKEN_VARS) {
				const dark = name === "token-function" ? variant.dark : DARK[name];
				const light = name === "token-function" ? variant.light : LIGHT[name];
				out.push(
					`body[data-ds-dark-theme] pre.shiki span[style*="--shiki-${name}"],` +
					`body[data-ds-dark-theme] pre.shiki code span[style*="--shiki-${name}"]` +
					`{ color: ${dark} !important; }`,
				);
				out.push(
					`pre.shiki span[style*="--shiki-${name}"],` +
					`pre.shiki code span[style*="--shiki-${name}"]` +
					`{ color: ${light} !important; }`,
				);
			}
			// The token-function variable is not in TOKEN_VARS' loop above when a
			// variant applies, so pin it explicitly for both schemes.
			out.push(
				`body[data-ds-dark-theme] pre.shiki span[style*="--shiki-token-function"],` +
				`body[data-ds-dark-theme] pre.shiki code span[style*="--shiki-token-function"]` +
				`{ color: ${variant.dark} !important; }`,
			);
			out.push(
				`pre.shiki span[style*="--shiki-token-function"],` +
				`pre.shiki code span[style*="--shiki-token-function"]` +
				`{ color: ${variant.light} !important; }`,
			);
			return out.join("\n");
		}

		/** Font-size expression for the active mode. */
		function sizeExpr(cfg, lh) {
			if (cfg.mode === "follow") {
				// Same mechanism DSH itself uses for every other content font:
				// `--dsh-content-font-delta` is `calc(content-font-size - 14px)`,
				// so the code block grows and shrinks with the user's font size.
				return lh
					? "calc(19px + var(--dsh-content-font-delta, 0px))"
					: "calc(12px + var(--dsh-content-font-delta, 0px))";
			}
			if (cfg.mode === "scale") {
				const base = "var(--dsh-content-font-size, 14px)";
				return lh ? `calc(${base} * ${cfg.ratio} * 1.55)` : `calc(${base} * ${cfg.ratio})`;
			}
			return lh ? `${Math.round(cfg.fixedPx * 1.55)}px` : `${cfg.fixedPx}px`;
		}

		/** The complete stylesheet for the current settings. */
		function buildCss(cfg) {
			const variant = VARIANTS[cfg.variant] || VARIANTS.typeTeal;
			const parts = [];
			if (cfg.palette) {
				parts.push(`:root, body {\n${varBlock(LIGHT)}\n}`);
				parts.push(`body[data-ds-dark-theme] {\n${varBlock({ ...DARK, "token-function": variant.dark })}\n}`);
				parts.push(pinBlock(variant));
				parts.push(`pre.shiki { color: ${LIGHT.foreground} !important; }`);
				parts.push(
					`body[data-ds-dark-theme] pre.shiki {` +
					` color: ${DARK.foreground} !important;` +
					` background-color: ${DARK.background} !important; }`,
				);
			}
			// Font size. DSH fixes the code block at 11px/19px via
			// `--dsw-font-markdown-code-block`, which is why it does not follow the
			// content font size. Every token below is rewritten, plus the concrete
			// elements, because inline `code` additionally carries a `.875em` rule.
			const size = sizeExpr(cfg, false);
			const lh = sizeExpr(cfg, true);
			const family = cfg.fontFamily ? ` font-family: ${cfg.fontFamily} !important;` : "";
			parts.push([
				":root, body {",
				`  --dsw-font-markdown-code: ${size}/${lh} var(--ds-font-family-code) !important;`,
				`  --dsw-font-markdown-code-block: ${size}/${lh} var(--ds-font-family-code) !important;`,
				`  --dsw-font-markdown-code-block-font-size: ${size} !important;`,
				`  --dsw-font-markdown-code-block-line-height: ${lh} !important;`,
				`  --dsw-font-markdown-code-font-size: ${size} !important;`,
				"}",
			].join("\n"));
			parts.push(
				`.md-code-block :not(pre) > code, .md-body :not(pre) > code,` +
				` .md-code-block td code, .md-body td code` +
				`{ font-size: ${size} !important; line-height: ${lh} !important;${family} }`,
			);
			parts.push(
				`.md-code-block pre, .md-code-block pre code, .md-code-block pre span,` +
				` pre.shiki, pre.shiki code, pre.shiki span` +
				`{ font-size: ${size} !important; line-height: ${lh} !important;${family} }`,
			);
			return parts.join("\n");
		}

		/** Replace the plugin-owned stylesheet in place. */
		function applyCss() {
			if (typeof document === "undefined") return;
			if (!styleTag) {
				styleTag = document.createElement("style");
				styleTag.id = "dsh-darkplus-code-style";
				styleTag.setAttribute("data-plugin", "dsh-darkplus-code");
				document.head.appendChild(styleTag);
			}
			styleTag.textContent = buildCss(settings);
		}

		/** Push the palette into the theme service as a token layer, if present. */
		function applyThemeLayer() {
			const ctx = ctxRef;
			if (!ctx || typeof ctx.get !== "function") return;
			const theme = ctx.get("theme");
			if (!theme || typeof theme.overrideTokens !== "function") return;
			if (typeof themeDispose === "function") {
				try {
					themeDispose();
				} catch {
					/* the layer may already be gone */
				}
				themeDispose = null;
			}
			if (!settings.palette) return;
			const variant = VARIANTS[settings.variant] || VARIANTS.typeTeal;
			const tokens = {};
			for (const name of TOKEN_VARS) {
				if (name === "foreground") {
					tokens["--shiki-foreground"] = { light: LIGHT.foreground, dark: DARK.foreground };
					continue;
				}
				tokens[`--shiki-${name}`] = { light: LIGHT[name], dark: DARK[name] };
			}
			tokens["--shiki-token-function"] = { light: variant.light, dark: variant.dark };
			tokens["--shiki-background"] = { light: LIGHT.background, dark: DARK.background };
			themeDispose = theme.overrideTokens("dsh-darkplus-code", tokens);
		}

		/** Re-render everything that depends on the current settings. */
		function sync() {
			applyCss();
			applyThemeLayer();
			emit();
		}

		// ── Persistence (host file over the same-origin route) ────────────────

		/** Merge an untrusted partial into the live settings, bounded client-side
		 *  as well so the UI never shows a value the host would clamp away. */
		function normalize(input) {
			const raw = input && typeof input === "object" ? input : {};
			const mode = raw.mode === "scale" || raw.mode === "fixed" ? raw.mode : "follow";
			const ratio = Number.isFinite(raw.ratio) ? Math.min(2, Math.max(0.5, raw.ratio)) : DEFAULTS.ratio;
			const fixedPx = Number.isFinite(raw.fixedPx)
				? Math.min(32, Math.max(9, Math.round(raw.fixedPx)))
				: DEFAULTS.fixedPx;
			return {
				palette: raw.palette === undefined ? DEFAULTS.palette : raw.palette !== false,
				variant: raw.variant === "funcYellow" ? "funcYellow" : "typeTeal",
				mode,
				ratio,
				fixedPx,
				fontFamily: typeof raw.fontFamily === "string" ? raw.fontFamily.slice(0, 120) : "",
			};
		}

		/** Load persisted settings; falls back to defaults when unavailable. */
		async function load() {
			try {
				const res = await fetch(SETTINGS_URL, { headers: { accept: "application/json" } });
				if (!res.ok) return;
				const body = await res.json();
				if (body && body.ok && body.settings) settings = normalize({ ...DEFAULTS, ...body.settings });
				sync();
			} catch {
				/* no host route (headless or first boot): defaults stay in effect */
			}
		}

		/** Persist a partial update and re-render. */
		async function save(patch) {
			settings = normalize({ ...settings, ...patch });
			sync();
			try {
				await fetch(SETTINGS_URL, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(settings),
				});
			} catch {
				/* the in-memory value still applies for this session */
			}
		}

		// ── Settings row ──────────────────────────────────────────────────────

		function pillStyle(active) {
			return {
				height: "30px",
				minWidth: "46px",
				padding: "0 12px",
				borderRadius: "15px",
				cursor: "pointer",
				font: "inherit",
				fontSize: "13px",
				border: active
					? "1px solid var(--dsw-alias-brand-primary)"
					: "1px solid var(--dsw-alias-border-l3)",
				background: active ? "var(--dsw-alias-bg-layer-2)" : "transparent",
				color: "var(--dsw-alias-label-primary)",
			};
		}

		function readout() {
			if (typeof document === "undefined") return "";
			const pre = document.querySelector("pre.shiki") || document.querySelector(".md-code-block pre");
			const para = document.querySelector(".md-body p") || document.querySelector("p");
			const inline = document.querySelector(".md-code-block :not(pre) > code");
			const parts = [];
			if (para) parts.push(`正文 ${getComputedStyle(para).fontSize}`);
			if (pre) parts.push(`代码块 ${getComputedStyle(pre).fontSize}`);
			if (inline) parts.push(`行内 ${getComputedStyle(inline).fontSize}`);
			return parts.join(" · ");
		}

		function SettingsRow() {
			const [state, setState] = React.useState(snapshot());
			const [info, setInfo] = React.useState("");
			React.useEffect(() => subscribe(() => setState(snapshot())), []);
			React.useEffect(() => {
				setInfo(readout());
			}, [state.mode, state.fixedPx, state.ratio]);

			const modePills = [
				{ id: "follow", label: "跟随字号", title: "与 DSH 正文字号同步增减" },
				{ id: "scale", label: "比例", title: `正文的 ${state.ratio} 倍` },
				{ id: "fixed", label: "固定", title: "不随字号变化" },
			].map((m) =>
				React.createElement(
					"button",
					{
						key: m.id,
						type: "button",
						title: m.title,
						style: pillStyle(state.mode === m.id),
						onClick: () => save({ mode: m.id }),
					},
					m.label,
				),
			);

			const pxPills = [13, 14, 15, 16, 17].map((n) =>
				React.createElement(
					"button",
					{
						key: n,
						type: "button",
						style: pillStyle(state.mode === "fixed" && state.fixedPx === n),
						onClick: () => save({ mode: "fixed", fixedPx: n }),
					},
					String(n),
				),
			);

			const variantPills = Object.keys(VARIANTS).map((id) =>
				React.createElement(
					"button",
					{
						key: id,
						type: "button",
						title: "shiki 把类型名与函数名归到同一个变量，只能同色",
						style: pillStyle(state.variant === id),
						onClick: () => save({ variant: id }),
					},
					VARIANTS[id].label,
				),
			);

			return React.createElement(
				"div",
				{ style: { display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0" } },
				React.createElement(
					"div",
					{ style: { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" } },
					React.createElement(
						"div",
						{ style: { fontSize: "14px", fontWeight: 500, color: "var(--dsw-alias-label-primary)" } },
						"代码块外观",
					),
					React.createElement(
						"div",
						{ style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)" } },
						"Dark+ 配色 + 字号",
					),
					React.createElement(
						"button",
						{
							type: "button",
							onClick: () => {
								applyCss();
								setInfo(readout());
							},
							style: {
								marginLeft: "auto",
								height: "24px",
								padding: "0 10px",
								borderRadius: "12px",
								cursor: "pointer",
								font: "inherit",
								fontSize: "12px",
								border: "1px solid var(--dsw-alias-border-l3)",
								background: "transparent",
								color: "var(--dsw-alias-label-secondary)",
							},
						},
						"刷新读数",
					),
				),
				React.createElement(
					"div",
					{ style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
					modePills,
					React.createElement("span", {
						style: {
							width: "1px",
							height: "18px",
							background: "var(--dsw-alias-border-l3)",
							margin: "0 4px",
						},
					}),
					pxPills,
				),
				React.createElement(
					"div",
					{ style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
					React.createElement(
						"span",
						{ style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)" } },
						"配色",
					),
					variantPills,
					React.createElement(
						"button",
						{
							type: "button",
							style: pillStyle(state.palette),
							onClick: () => save({ palette: !state.palette }),
						},
						state.palette ? "已启用" : "已关闭",
					),
				),
				React.createElement(
					"div",
					{ style: { fontSize: "12px", fontFamily: "monospace", color: "var(--dsw-alias-label-secondary)" } },
					info,
				),
			);
		}

		// ── Plugin body ───────────────────────────────────────────────────────

		function apply(ctx) {
			ctxRef = ctx;
			// Own the stylesheet for exactly this fiber's lifetime.
			ctx.effect(() => {
				applyCss();
				return () => {
					if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
					styleTag = null;
					if (typeof themeDispose === "function") {
						try {
							themeDispose();
						} catch {
							/* already disposed */
						}
						themeDispose = null;
					}
				};
			}, "darkplus-code: stylesheet");
			// Restore persisted settings once, then keep the palette in sync.
			load();
			ctx.slots.inject("settings.general.item", () =>
				ctx.slots.register({ name: "settings.general.item", id: "darkplus-code", order: 25 }, () =>
					React.createElement(SettingsRow, null),
				),
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});

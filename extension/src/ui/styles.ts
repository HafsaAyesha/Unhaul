export const REFLECTION_STYLES = `
:host {
  all: initial; position: fixed; left: 12px; top: 12px; z-index: 2147483000; pointer-events: none; color-scheme: light;
  --unhaul-ink: #193c32; --unhaul-muted: #507165; --unhaul-border: #b6c7bf;
  --unhaul-bg: #faf8f3; --unhaul-soft: #edf3ef; --unhaul-focus: #286ec1; --unhaul-shadow: 0 8px 26px #193c3233;
}
* { box-sizing: border-box; }
.shell { font: 14px/1.5 system-ui, sans-serif; color: var(--unhaul-ink); }
select { min-height: 40px; font: inherit; padding: 8px 10px; border: 1px solid var(--unhaul-border); border-radius: 8px; color: var(--unhaul-ink); background: var(--unhaul-bg); }
button { min-height: 40px; font: inherit; border: 1px solid var(--unhaul-muted); border-radius: 10px; padding: 8px 12px; cursor: pointer; background: var(--unhaul-bg); color: var(--unhaul-ink); }
button:focus-visible, select:focus-visible { outline: 3px solid var(--unhaul-focus); outline-offset: 3px; }
button:disabled { opacity: .65; cursor: not-allowed; }
.badge { pointer-events: auto; display: block; max-width: min(280px, calc(100vw - 24px)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 12px; background: var(--unhaul-ink); color: #fff; box-shadow: var(--unhaul-shadow); }
.panel { pointer-events: auto; margin-top: 8px; padding: 16px; background: var(--unhaul-bg); border: 1px solid var(--unhaul-border); border-radius: 16px; width: min(350px, calc(100vw - 24px)); max-height: min(75vh, 650px); overflow-y: auto; box-shadow: var(--unhaul-shadow); }
[hidden] { display: none !important; }
header { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
header > div { min-width: 0; } header small { display: block; margin-bottom: 2px; color: var(--unhaul-muted); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
header button { flex: 0 0 32px; width: 32px; min-height: 32px; padding: 0; border-radius: 50%; font-size: 20px; line-height: 1; }
h2 { font-size: 18px; line-height: 1.25; margin: 0; } h3 { font-size: 15px; overflow-wrap: anywhere; }
p, li { overflow-wrap: anywhere; } ul { padding-left: 20px; }
.product { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.product-visual { flex: 0 0 72px; width: 72px; height: 72px; display: grid; place-items: center; background: var(--unhaul-soft); border-radius: 12px; }
img { width: 72px; height: 72px; object-fit: contain; border-radius: 12px; }
.product-info { min-width: 0; } .product-info h3 { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin: 0 0 4px; }
.product-info p { margin: 0; font-weight: 700; }
.question { margin: 16px 0; padding: 14px; border: 1px solid var(--unhaul-border); border-radius: 12px; background: var(--unhaul-soft); font-size: 16px; line-height: 1.4; font-weight: 650; }
.matches { display: grid; gap: 8px; padding: 0; margin: 12px 0 16px; list-style: none; }
.matches li { padding: 10px 12px; border: 1px solid var(--unhaul-border); border-radius: 10px; background: #fff; }
.matches li span { display: block; } .matches .muted, #unhaul-save-note { font-size: 12px; color: var(--unhaul-muted); }
.actions { display: grid; gap: 8px; } .save-action { display: flex; gap: 8px; } .save-action button { flex: 1 1 auto; background: var(--unhaul-ink); color: #fff; }
.save-action label { display: grid; flex: 0 0 42%; gap: 2px; color: var(--unhaul-muted); font-size: 11px; font-weight: 700; }
.save-action select { width: 100%; } .actions > button { width: 100%; }
.muted { font-size: 12px; color: var(--unhaul-muted); } #unhaul-save-note { min-height: 1.5em; }
@media (max-width: 360px) { .panel { padding: 12px; } .save-action { display: grid; grid-template-columns: 1fr; } .save-action label { width: 100%; } }
@media (max-height: 440px) { .panel { max-height: calc(100vh - 75px); } }
@media (prefers-reduced-motion: no-preference) { .panel, .badge { animation: unhaul-in 120ms ease-out; } }
@media (prefers-reduced-motion: reduce) { .panel, .badge { animation: none; } }
@keyframes unhaul-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-color-scheme: dark) {
  :host { color-scheme: dark; --unhaul-ink: #e7f1ec; --unhaul-muted: #b6c7bf; --unhaul-border: #507165; --unhaul-bg: #18251f; --unhaul-soft: #263a31; --unhaul-shadow: 0 8px 26px #0008; }
  .badge { background: #b6c7bf; color: #10251d; } .matches li, select, button { background: #203229; color: var(--unhaul-ink); }
  .save-action button { background: #b6c7bf; color: #10251d; }
}
`;

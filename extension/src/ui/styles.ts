export const REFLECTION_STYLES = `
:host { all: initial; position: fixed; left: 12px; top: 12px; z-index: 2147483000; pointer-events: none; color-scheme: light; }
* { box-sizing: border-box; }
.shell { font: 14px/1.5 system-ui, sans-serif; color: #193c32; }
button { font: inherit; border: 1px solid #507165; border-radius: 8px; padding: 8px 12px; cursor: pointer; background: #fff; color: #193c32; }
button:focus-visible { outline: 3px solid #286ec1; outline-offset: 3px; }
button:disabled { opacity: .65; cursor: not-allowed; }
.badge { pointer-events: auto; background: #193c32; color: white; box-shadow: 0 2px 8px #0002; max-width: min(280px, calc(100vw - 24px)); }
.panel { pointer-events: auto; margin-top: 8px; padding: 16px; background: #fff; border: 1px solid #b6c7bf; border-radius: 12px; width: min(350px, calc(100vw - 24px)); max-height: min(75vh, 650px); overflow-y: auto; box-shadow: 0 6px 28px #0003; }
[hidden] { display: none !important; }
header { display: flex; gap: 12px; align-items: start; justify-content: space-between; }
h2 { font-size: 17px; margin: 0 0 12px; } h3 { font-size: 15px; overflow-wrap: anywhere; }
p, li { overflow-wrap: anywhere; } ul { padding-left: 20px; }
img { width: 72px; height: 72px; object-fit: contain; }
.question { font-weight: 650; } .muted, #unhaul-save-note { font-size: 12px; color: #52645d; }
.panel > button { margin: 4px 6px 4px 0; }
@media (max-height: 440px) { .panel { max-height: calc(100vh - 75px); } }
`;

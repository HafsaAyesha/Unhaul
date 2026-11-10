export const VIEWS = ['home', 'items', 'saved', 'dashboard', 'settings'] as const;
export type ViewName = (typeof VIEWS)[number];

export function viewFromHash(hash: string): ViewName {
  const value = hash.replace(/^#/, '');
  return (VIEWS as readonly string[]).includes(value) ? value as ViewName : 'home';
}

export function createRouter(root: ParentNode, onChange?: (view: ViewName) => void) {
  const win = (root as Document).defaultView ?? (root as Node).ownerDocument?.defaultView;
  const views = new Map<ViewName, HTMLElement>();
  const buttons = new Map<ViewName, HTMLButtonElement>();
  for (const view of VIEWS) {
    const section = root.querySelector<HTMLElement>(`[data-view="${view}"]`);
    const button = root.querySelector<HTMLButtonElement>(`[data-nav="${view}"]`);
    if (section) views.set(view, section);
    if (button) buttons.set(view, button);
  }
  let current: ViewName = 'home';
  const render = (view: ViewName): void => {
    current = view;
    for (const [name, section] of views) section.hidden = name !== view;
    for (const [name, button] of buttons) {
      if (name === view) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    }
    views.get(view)?.querySelector<HTMLElement>('h2')?.focus();
    onChange?.(view);
  };
  const onHashChange = () => render(viewFromHash(win?.location.hash ?? ''));
  for (const [view, button] of buttons) button.addEventListener('click', () => {
    render(view);
    if (win && win.location.hash !== `#${view}`) win.location.hash = `#${view}`;
  });
  win?.addEventListener('hashchange', onHashChange);
  render(viewFromHash(win?.location.hash ?? ''));
  return {
    get current(): ViewName { return current; },
    navigate(view: ViewName): void {
      render(view);
      if (win && win.location.hash !== `#${view}`) win.location.hash = `#${view}`;
    },
    dispose(): void { win?.removeEventListener('hashchange', onHashChange); },
  };
}

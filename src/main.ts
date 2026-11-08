import { render } from 'lit-html';
import { boot } from './store/boot';
import { onChange } from './store/state';
import { appView } from './views/app';
import { setUi, ui } from './views/common';

if (import.meta.env.DEV) {
  const { seedDevForm } = await import('./dev-tools');
  const { installDevPotok } = await import('./potok-dev');
  seedDevForm();
  installDevPotok();
}

// No top-level await below this point: the build wrapper (vite.config.ts) runs
// this code inside a plain function.

const root = document.querySelector<HTMLElement>('#forma')!;

setUi(document.documentElement.lang);
onChange(() => render(appView(), root));
render(appView(), root);
void boot(ui.t);

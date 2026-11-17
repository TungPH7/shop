// jsdom has <dialog> but not its modal API, which <Dialog> calls. The stub only toggles
// `open` and fires `close` like a browser. Esc, the inert page behind and the focus
// restore are checked in a real browser (E2E, devtools). A test file of a component that
// opens a <Dialog> calls it once at its top: jsdom is per test file, and the stub stays
// out of testing/setup.ts so that the other tests run on jsdom as it is.
export function stubDialog(): void {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}

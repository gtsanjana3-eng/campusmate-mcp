import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no scrolling; the router's ScrollRestoration calls this on every navigation.
window.scrollTo = () => {};

// jsdom may not implement modal dialogs; this minimal stand-in opens and closes them for tests.
function showModal(this: HTMLDialogElement) {
  this.open = true;
}
function closeDialog(this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event('close'));
}
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = closeDialog;
}

afterEach(cleanup);

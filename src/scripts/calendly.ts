/*
  Calendly's widget, fetched once, the first time the page needs it: a click on a
  "Book a Discovery Call" button, or the booking section scrolling into view. Visitors who
  do neither never download it.
*/

declare global {
	interface Window {
		Calendly?: {
			initPopupWidget(o: { url: string }): void;
			initInlineWidget(o: { url: string; parentElement: HTMLElement; resize?: boolean }): void;
		};
	}
}

const CSS = 'https://assets.calendly.com/assets/external/widget.css';
const JS = 'https://assets.calendly.com/assets/external/widget.js';
// The calendar is told the page's colours, so it doesn't look pasted in.
const LOOK = 'hide_gdpr_banner=1&background_color=ffffff&text_color=1a1a1a&primary_color=2e86ec';

let loading: Promise<void> | undefined;

export function loadCalendly(): Promise<void> {
	if (!loading) {
		loading = new Promise((resolve) => {
			const css = document.createElement('link');
			css.rel = 'stylesheet';
			css.href = CSS;
			document.head.appendChild(css);
			const js = document.createElement('script');
			js.src = JS;
			js.onload = () => resolve();
			document.head.appendChild(js);
		});
	}
	return loading;
}

const styled = (url: string) => `${url}${url.includes('?') ? '&' : '?'}${LOOK}`;

export async function openCalendly(url: string): Promise<void> {
	await loadCalendly();
	window.Calendly?.initPopupWidget({ url: styled(url) });
}

export async function embedCalendly(el: HTMLElement, url: string): Promise<void> {
	await loadCalendly();
	window.Calendly?.initInlineWidget({ url: styled(url), parentElement: el, resize: true });
}

/*
  Cal.com's embed, fetched once, the first time the page needs it: a click on a
  "Book a Discovery Call" button, or the booking section scrolling into view. Visitors who
  do neither never download it.

  Cal's loader is a queue: calls made before the script arrives are replayed once it has,
  so the page can ask for a calendar without waiting.
*/

type CalApi = ((...args: unknown[]) => void) & { ns: Record<string, (...args: unknown[]) => void> };

declare global {
	interface Window {
		Cal?: CalApi;
	}
}

const SCRIPT = 'https://app.cal.com/embed/embed.js';
const ORIGIN = 'https://app.cal.com';
// One namespace for the whole site, so the look below is set once.
const NS = 'discovery';
// The page's own colours, so the calendar doesn't look pasted in.
const LOOK = {
	theme: 'light',
	layout: 'month_view',
	hideEventTypeDetails: false,
	styles: { branding: { brandColor: '#2e86ec' } },
};

let cal: ((...args: unknown[]) => void) | undefined;

function boot() {
	if (cal) return cal;
	// Cal's own snippet, typed loosely: it defines window.Cal as a queue and loads the script.
	const w = window as unknown as { Cal?: any; document: Document };
	if (!w.Cal) {
		const push = (a: any, ar: IArguments | unknown[]) => a.q.push(ar);
		w.Cal = function (this: unknown) {
			const c = w.Cal;
			const ar = arguments;
			if (!c.loaded) {
				c.ns = {};
				c.q = c.q || [];
				document.head.appendChild(document.createElement('script')).src = SCRIPT;
				c.loaded = true;
			}
			if (ar[0] === 'init') {
				const api: any = function (this: unknown) {
					push(api, arguments);
				};
				const namespace = ar[1];
				api.q = api.q || [];
				if (typeof namespace === 'string') {
					c.ns[namespace] = c.ns[namespace] || api;
					push(c.ns[namespace], ar);
					push(c, ['initNamespace', namespace]);
				} else push(c, ar);
				return;
			}
			push(c, ar);
		};
	}
	w.Cal('init', NS, { origin: ORIGIN });
	cal = w.Cal.ns[NS];
	cal!('ui', LOOK);
	return cal!;
}

export function openCal(link: string): void {
	boot()('modal', { calLink: link, config: { layout: LOOK.layout, theme: LOOK.theme } });
}

export function embedCal(el: HTMLElement, link: string): void {
	boot()('inline', { elementOrSelector: el, calLink: link, config: { layout: LOOK.layout, theme: LOOK.theme } });
}

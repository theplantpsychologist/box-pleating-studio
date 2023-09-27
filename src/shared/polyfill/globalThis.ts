// For Safari < 12.1

//=================================================================
/**
 * Polyfill for {@link globalThis}.
 * https://caniuse.com/mdn-javascript_builtins_globalthis
 */
//=================================================================
if(typeof globalThis === "undefined") {
	Object.defineProperty(window, "globalThis", {
		value: window,
		writable: false,
	});
}

export {};
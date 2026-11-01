type LogContext = Record<string, unknown>;
type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogScope extends Disposable {
	readonly label: string;
	readonly context: LogContext;
	/** Attach more context to this scope after it's opened. Chainable. */
	add(key: string, value: unknown): LogScope;
	add(context: LogContext): LogScope;
}

/**
 * Active scopes, outermost first. Follows the synchronous call stack only: across an `await`,
 * other code may push/pop its own scopes, so logs after an `await` can show a sibling's scope.
 * Capture `currentChain()` before the `await` if that matters.
 */
const chain: LogScope[] = [];

/** Open a log scope. Use with `using` so it pops itself when the block exits. */
export function logScope(label: string, context: LogContext = {}): LogScope {
	const scope: LogScope = {
		label,
		context: { ...context },
		add(keyOrContext: string | LogContext, value?: unknown) {
			if (typeof keyOrContext === "string") {
				scope.context[keyOrContext] = value;
			} else {
				Object.assign(scope.context, keyOrContext);
			}
			return scope;
		},
		[Symbol.dispose]() {
			// splice from this scope down, so a leaked inner scope can't outlive its parent
			const index = chain.lastIndexOf(scope);
			if (index !== -1) chain.splice(index);
		},
	};
	chain.push(scope);
	return scope;
}

/** Snapshot of the current chain — useful to stash on an error or pass to another log. */
export function currentChain(): { labels: string[]; context: LogContext } {
	const labels: string[] = [];
	const context: LogContext = {};
	for (const scope of chain) {
		labels.push(scope.label);
		Object.assign(context, scope.context);
	}
	return { labels, context };
}

function write(level: LogLevel, message: string, args: unknown[]) {
	const { labels, context } = currentChain();
	const prefix = labels.length ? `[${labels.join(" > ")}] ` : "";
	const extra = Object.keys(context).length ? [context] : [];
	console[level](prefix + message, ...args, ...extra);
}

export const log = {
	debug: (message: string, ...args: unknown[]) => {
		write("debug", message, args);
	},
	info: (message: string, ...args: unknown[]) => {
		write("info", message, args);
	},
	warn: (message: string, ...args: unknown[]) => {
		write("warn", message, args);
	},
	error: (message: string, ...args: unknown[]) => {
		write("error", message, args);
	},
};

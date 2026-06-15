/**
 * Serialise a value for embedding in a <script type="application/ld+json">
 * block. Escapes the characters that could break out of the script context
 * so JSON-LD built from live data can never inject markup.
 */
export function safeJsonLd(value: unknown): string {
	return JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026');
}

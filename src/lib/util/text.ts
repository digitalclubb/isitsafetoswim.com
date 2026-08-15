/**
 * Join a list into a sentence the house style allows: no Oxford comma and no
 * comma before "and". Both are non-negotiable copy rules and both are easy to
 * reintroduce by hand, so every list that reaches a reader goes through here.
 *
 *   []                     -> ""
 *   ["a"]                  -> "a"
 *   ["a", "b"]             -> "a and b"
 *   ["a", "b", "c"]        -> "a, b and c"
 */
export function joinList(items: string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

import type { Verdict } from '$lib/data/types';

interface VerdictStyle {
	hex: string;
	label: string;
	meaning: string;
}

// Hex values mirror the verdict tokens in tokens.css. MapLibre paints in WebGL
// and cannot read CSS custom properties, so the colours are repeated here as
// literals for the map, the legend and the popups.
const STYLES: Record<Verdict, VerdictStyle> = {
	yes: { hex: '#1f6f4b', label: 'Yes', meaning: 'Good to swim today' },
	caution: { hex: '#7a4a08', label: 'Caution', meaning: 'Check before you swim' },
	no: { hex: '#9b2c2c', label: 'No', meaning: 'Avoid swimming today' }
};

export function verdictHex(verdict: Verdict): string {
	return STYLES[verdict].hex;
}

export function verdictLabel(verdict: Verdict): string {
	return STYLES[verdict].label;
}

export const VERDICT_LEGEND: ReadonlyArray<{ verdict: Verdict } & VerdictStyle> = (
	['yes', 'caution', 'no'] as const
).map((verdict) => ({ verdict, ...STYLES[verdict] }));

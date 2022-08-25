import { twind, jiknoTheme } from './deps.ts'

export function makeColors() {
	return {
		transparent: 'transparent',
		light: jiknoTheme.makeVariants(247, 247, 247),
		dark: jiknoTheme.makeVariants(23, 22, 22),
		secondary: jiknoTheme.makeVariants(242, 208, 73),
		primary: jiknoTheme.makeVariants(62, 137, 164),
		danger: jiknoTheme.makeVariants(184, 0, 0),
		success: jiknoTheme.makeVariants(44, 151, 17),
	}
}

export const theme: Partial<twind.Theme> = {
	colors: makeColors(),
	spacing: jiknoTheme.spacing,

	...jiknoTheme.defaultTheme.tailwindConfiguration,

	fontFamily: {
		head: ['Yellowtail', 'cursive'],
		body: ['Lora', 'serif'],
	},
}

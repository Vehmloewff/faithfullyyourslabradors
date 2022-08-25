import { h } from './deps.ts'

const title = 'Faithfully Yours Labradors'
const description = 'Purebred English Polar Bear White Labradors\nPurebred American Black/Yellow/Chocolate Labradors'
const site = 'https://faithfullyyourslabradors.com'
const heroImagePath = `${site}/hero.webp`

const reviewStyles = `<style>.bTduCZ, .fFcWqO { background-color: rgb(247, 247, 247) !important } .gduAeC { color: rgb(247, 247, 247) !important } </style>`

export const makeTemplate = (styleTag: string, bodyTag: string, includeReload: boolean) => (
	<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta http-equiv="X-UA-Compatible" content="IE=edge" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />

			<meta property="og:title" content={title} />
			<meta property="og:description" content={description} />
			<meta property="og:type" content="website" />
			<meta property="og:url" content={site} />
			<meta property="og:image" content={heroImagePath} />

			<meta name="twitter:card" content="summary" />
			<meta name="twitter:site" content="@faithfullyyou17" />
			<meta name="twitter:title" content={title} />
			<meta name="twitter:description" content={description} />
			<meta name="twitter:image" content={heroImagePath} />
			<meta name="twitter:image:alt" content={title} />
			<meta name="theme-color" content="#3e89a4" />

			<title>{title}</title>

			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
			<link href="https://fonts.googleapis.com/css2?family=Lora&family=Yellowtail&display=swap" rel="stylesheet"></link>

			{styleTag}

			{reviewStyles}

			{includeReload ? <script>{reloadScript}</script> : ''}
		</head>
		{bodyTag}
	</html>
)

// ChIJecRWw2A9socR4FF6ZeVT8sw

const reloadScript = `

const ws = new WebSocket(\`ws://\${location.host}/dev.ws\`)

ws.onclose = () => location.reload()

`

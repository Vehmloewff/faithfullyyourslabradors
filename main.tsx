import { BadgeRow } from './BadgeRow.tsx'
import { fileServer, setClassFilter, twind, twindSheet, h, http } from './deps.ts'
import { Hero } from './Hero.tsx'
import { makeTemplate } from './make-template.tsx'
import { Slideshow } from './Slideshow.tsx'
import { link } from './styles.ts'
import { theme } from './theme.ts'
import { facebookLogo, instagramLogo, twitterLogo } from './vectors.ts'

const isDev = !!Deno.env.get('DEV')

setClassFilter(twind.tw)
const sheet = twindSheet.virtualSheet()
twind.setup({ theme, sheet })

http.serve(handle, {
	port: 3000,
	onListen({ port }) {
		console.log(`Listening at http://localhost:${port}`)
	},
	onError(error) {
		console.error('Error:', error)

		// TODO email elijah

		return new Response(
			'<div style="position: fixed; top: 0; right: 0; left: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 25px">Oops! We had an error!</div>',
			{
				headers: { 'Content-Type': 'text/html' },
			}
		)
	},
})

async function handle(request: Request): Promise<Response> {
	const { pathname } = new URL(request.url)

	if (request.method === 'GET' && pathname === '/') {
		sheet.reset()

		const bodyTag = await (
			<body class="text-dark bg-light dark:bg-dark dark:text-light transition-colors font-body">
				<HomePage />
			</body>
		)
		const styleTag = twindSheet.getStyleTag(sheet)
		const template = await makeTemplate(styleTag, bodyTag, isDev)

		return new Response(template, { headers: { 'Content-Type': 'text/html' } })
	}

	if (pathname === '/dev.ws') return Deno.upgradeWebSocket(request).response

	return await fileServer.serveDir(request, { fsRoot: 'assets' })
}

function HomePage() {
	return (
		<main>
			<Hero />

			<Header text="About Us" />
			<section class="px-20">
				<BadgeRow />
				<div class="h-100"></div>
			</section>

			<Section mixup={true} header="Recent Puppy Photos">
				<Slideshow images={generateAssetPaths('puppy', 9)} />
			</Section>

			<Section mixup={false} header="Photos of our now grown puppies!!">
				<Slideshow images={generateAssetPaths('grown', 10)} />
			</Section>

			<Section mixup={true} header="Sire and Dames">
				<Slideshow images={generateAssetPaths('sd', 4)} />
			</Section>

			<Section mixup={false} header="Contact Us (918)724-2125">
				<div class="px-20 text-center">
					<p class="text-dark-30 dark:text-light-30">
						Do you have questions concerning our Labradors? Call or text us and we will get back to you as soon as we can.
						Texting is answered promptly.
					</p>
					<div class="h-20"></div>
					<h3 class="text-xl md:text-3xl">Faithfully Yours Labradors</h3>
					<div class="h-10"></div>
					<a href="https://goo.gl/maps/9FT2bKxAbDZWQ448A" class={link}>
						McLoud, Oklahoma, United States
					</a>
					<div class="h-20"></div>
					<div class="flex gap-8 justify-center">
						Call/Text:
						<a href="tel:9187242125" class={link}>
							(918)724-2125
						</a>
					</div>
					<div class="flex gap-8 justify-center">
						Email:
						<a href="mailto:faithfullyyourslabs@gmail.com" class={link}>
							faithfullyyourslabs@gmail.com
						</a>
					</div>
					<div class="h-20"></div>
					<h3 class="text-xl md:text-3xl">Better yet, see us in person!</h3>
					<p>We love our customers, so feel free to visit during the day sometime.</p>
				</div>
			</Section>

			<Section mixup={true} header="Price List">
				<h2 class="text-xl md:text-2xl text-dark-50 dark:text-light-50">English Labrador Prices ( Limited Registration)</h2>

				<div class="h-40"></div>
				<div class="grid md:grid-cols-2 gap-40">
					<ItemPricing
						title="Cream/ Yellow English Labrador puppies"
						description="Cream/ yellow Labradors will be CKC registered."
						price={1000}
					/>
					<ItemPricing title="Chocolate labs" description="Chocolate puppies will be CKC registered." price={1000} />
					<ItemPricing title="Black labs" description="Black puppies will be CKC registered." price={1000} />
					<ItemPricing
						title="English Polar Bear White Puppies"
						description="Polar Bear White puppies will be AKC limited registration."
						price={2200}
					/>
				</div>
			</Section>

			<section class="bg-center bg-cover relative">
				<script src="https://apps.elfsight.com/p/platform.js" defer></script>
				<div class="elfsight-app-a6fd074c-7fe2-4fb5-ae3b-9c6131949093 px-20 pt-100 relative z-10"></div>

				<div class="absolute inset-0">
					<img class="absolute inset-0 object-fit-center object-fit-cover" src="/relax.webp" />
					<div class="absolute inset-0 bg-dark-30" />
				</div>
			</section>

			<footer class="p-20 flex flex-col items-center md:flex-row gap-20">
				<div class="flex gap-10">
					<a href="https://www.facebook.com/Faithfully-Yours-Labradors-Kennel-108725407603731">{facebookLogo(40)}</a>
					<a href="https://www.instagram.com/faithfullyyourslabradors/">{instagramLogo(40)}</a>
					<a href="https://www.twitter.com/faithfullyyou17">{twitterLogo(40)}</a>
				</div>
				<div class="text-dark-30 dark:text-light-30 flex-auto text-center md:text-right">
					Copyright © 2020-{new Date().getFullYear()} Faithfully Yours Labradors - All Rights Reserved
				</div>
			</footer>
		</main>
	)
}

interface HeaderProps {
	text: string
}

function Header(props: HeaderProps) {
	return (
		<div class="pt-50 pb-30 px-20">
			<h2 class="text-2xl font-head">{props.text}</h2>
			<div class="h-15"></div>
			<div class="h-2 bg-dark-10 dark:bg-light-10"></div>
		</div>
	)
}

export interface SectionProps {
	mixup: boolean
	header: string
}

function Section(props: SectionProps, slot: string) {
	return (
		<section class={`${props.mixup ? 'bg-primary' : ''}`}>
			<div class="h-40"></div>
			<Header text={props.header} />
			<div class="px-20">{slot}</div>
			<div class="h-100"></div>
		</section>
	)
}

export interface ItemPricingProps {
	title: string
	description: string
	price: number
}

function ItemPricing(props: ItemPricingProps) {
	return (
		<div class="flex gap-20">
			<div class="flex-auto flex flex-col gap-10">
				<div class="text-xl md:text-2xl">{props.title}</div>
				<div class="text-dark-50 dark:text-light-50">{props.description}</div>
			</div>
			<div class="text-xl md:text-2xl">${props.price}</div>
		</div>
	)
}

function generateAssetPaths(prefix: string, amount: number) {
	const paths: string[] = []

	for (let num = 1; num <= amount; num++) paths.push(`/${prefix}${num}.webp`)

	return paths
}

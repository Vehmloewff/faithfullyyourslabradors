import { h } from './deps.ts'

export function BadgeRow() {
	return (
		<div class="flex gap-40 flex-col md:flex-row py-20">
			<Badge
				title="Family"
				image="/family.webp"
				text="A large family with a big heart for Labradors.  We are governed by a standard of ethics and honesty that ensures you are getting a dog that has been cared for."
			/>
			<Badge
				title="Labradors"
				image="/labradors.webp"
				text="We desire to provide a dog that will create the same love and laughter that comes from a Labrador in the home. Our sire is of a Champion English Lab bloodline and has a gentle disposition and is great around older and young people! We have many reports that our puppies are the same way. Let us know if know if we can help you find a furr baby that fits you!"
			/>
			<Badge
				title="Contact Us"
				image="/grown10.webp"
				text="Text or email us to make arrangements for a new addition to your family! (918)724-2125"
			/>
		</div>
	)
}

export interface BadgeProps {
	title: string
	image: string
	text: string
}

export function Badge(props: BadgeProps) {
	return (
		<div class="flex flex-col gap-10 flex-1">
			<img src={props.image} class="rounded-full" />
			<div class="text-2xl text-center">{props.title}</div>
			<div class="text-md text-dark-30 dark:text-light-30 text-center">{props.text}</div>
		</div>
	)
}

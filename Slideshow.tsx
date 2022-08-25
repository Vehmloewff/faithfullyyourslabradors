import { h } from './deps.ts'

export interface SlideshowProps {
	images: string[]
}

export async function Slideshow(props: SlideshowProps) {
	return (
		<div class="overflow-x-auto flex gap-20" style="scroll-snap-type: x mandatory;">
			{(
				await Promise.all(props.images.map(image => <img class="h-200 md:h-400" style="scroll-snap-align: start;" src={image} />))
			).join('')}
		</div>
	)
}

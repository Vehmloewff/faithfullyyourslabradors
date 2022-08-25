import { h } from './deps.ts'

export function Hero() {
	return (
		<header>
			<div class="h-300 md:h-[100vh] bg-top-left bg-cover" style="background-image: url('/hero.webp')">
				<div class="relative h-full w-full hidden md:block">
					<div class="absolute inset-0 bg-dark-40"></div>
					<div class="flex flex-col justify-center items-center absolute inset-0">
						<Header />
					</div>
				</div>
			</div>
			<div class="md:hidden">
				<div class="h-40"></div>
				<Header></Header>
			</div>
		</header>
	)
}

function Header() {
	return (
		<div class="text-center px-20">
			<h3 class="text-lg md:text-2xl">Text or call at (918) 724-2125</h3>
			<div class="h-50"></div>

			<h1 class="font-head text-3xl md:text-6xl px-20">Faithfully Yours Labradors</h1>

			<div class="h-20"></div>
			<div class="h-2 bg-light"></div>

			<div class="h-20"></div>

			<h4 class="text-md md:text-xl">Purebred English Polar Bear White Labradors</h4>
			<h4 class="text-md md:text-xl">Purebred American Black/Yellow/Chocolate Labradors</h4>
		</div>
	)
}

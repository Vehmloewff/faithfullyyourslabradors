import { h } from './deps.ts'

export function CurrentSpecial() {
	return (
		<div>
			<div class="p-20 flex flex-col gap-20 bg-[#fff]">
				<div class="flex gap-10 items-center">
					<img src="/santa-hat.jpeg" alt="Santa Hat" class="w-50 h-50" />
					<h3 class="text-2xl text-dark">Christmas Puppies</h3>
				</div>

				<p class="text-dark">New litter of Christmas puppies just born! Call our text us for more information.</p>
			</div>

			<div class="flex gap-10 flex-col md:flex-row">
				<img src="/puppies-on-bench.png" alt="Christmas Puppies" />
			</div>
		</div>
	)
}

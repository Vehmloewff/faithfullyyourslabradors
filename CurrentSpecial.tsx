import { h } from './deps.ts'

export function CurrentSpecial() {
	return (
		<div class="p-20 flex flex-col gap-20 bg-[#fff]">
			<div class="flex gap-10 items-center">
				<img src="/santa-hat.jpeg" alt="Santa Hat" class="w-50 h-50" />
				<h3 class="text-2xl text-dark">Christmas Puppies</h3>
			</div>

			{/* <p class="text-dark">Treat a loved one to a special Christmas gift!</p> */}
			<p class="text-dark">
				Christmas puppies ready to go home the first week of December. These three little ladies are still available. Text or call
				us for more information!!
			</p>

			<div class="flex gap-10 flex-col md:flex-row">
				<div>
					<img src="/christmas-pup1.png" alt="Christmas Puppy" />
				</div>
				<div>
					<img src="/christmas-pup2.png" alt="Christmas Puppy" />
				</div>
				<div>
					<img src="/christmas-pup3.png" alt="Christmas Puppy" />
				</div>
			</div>
		</div>
	)
}

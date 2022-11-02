# Resource Panel

A panel that opens in from the side of the website, presenting forms for the purpose of editing or creating a resource.

## Usage

Somewhere in your template, preferably in a `_layout.ejs` file, include the panel template.

> NOTE: Adjust the path to the actual destination of `panel.ejs` relative to the importing directory. Because it is out of the `routes` folder, '..' must be used to traverse to the location, not '/'.

```ejs
{{ partial "../../lib/panel.ejs" }}
```

The JS code must be initialized in the top level of the sync block of any page that makes use of the panel.

```ts
initPanel(on)

on.someAction = () => {
	// ...
}
```

To validate fields against a mongoose schema, call pass in mongoose model into the validation option.

```ts
initPanel(on, {
	validation: MongooseModel
})
```

Opening the panel is rather simple...

```ts
openPanel(ctx, $, options)
```

And closing it is even simpler.

```ts
closePanel(ctx, $)
```

> NOTE: Panel will be automatically, closed when the form is submitted or when one of it's buttons are pressed.

## Options

So that input fields and buttons may be correctly displayed on the panel, a configurations object can be passed.

```ts
const options = {
	title: 'Create Resource',
	submitAction: 'handleSubmission', // The action to call when the form is submitted.
	easyClose: true, // Enables the panel to be easily closed by clicking out of it
	state: 'whatever', // anything. This is accessible via ctx.panelState in the submit/button action handlers
	fields: [
		{
			label: 'Label for the input', // The label to display for the input
			type: 'text', // The type of input to display
			name: 'my_field', // The name to assign to the input
		},
		{
			type: 'hidden',
			value: 'this value is pre-specified into the input'
		},
		{
			// ...
		}
	],
	buttons: [
		{
			type: 'submit', // either "submit" or "button"
			coloring: 'primary', // either "primary", "secondary", or "error"
			label: 'Save',
		},
		{
			type: 'button',
			coloring: 'error',
			label: 'Delete',
			pressedAction: 'doSomething', // Action to call when this button is pressed.
		}
	]
}
```

## CTX

Action handlers are passed some extra info in the `ctx` object.

### `ctx.panelButton`

If the form was not submitted, this is a number representing the index of the button that was pressed.

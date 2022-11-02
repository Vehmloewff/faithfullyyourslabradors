module.exports = function validate(ctx, $, Model) {
  // Create a new model instance with only this one field.
  let instance = new Model({
    [ctx.trigger.name]: ctx.trigger.value
  })

  // By convention, the parent fieldset id is the id of this element plus '-fs'.
  let fieldsetId = `#${ctx.trigger.id}-fs`

  // Validate the schema and get validation error properties for just this field only.
  let invalid = instance.validateSync()?.errors?.[ctx.trigger.name]?.properties

  // Has state of this form's validity not changed?
  if ($._formErrors[ctx.trigger.id] == invalid?.message) return $

  // Is this field invalid?
  if (invalid) {
    // Render fieldset with 'invalid' class and $._formErrors[<fieldName>] messsage.
    $._formErrors[ctx.trigger.id] = invalid.message
    ctx.addClass(fieldsetId, '.invalid')
  }
  // Otherwise, render fieldset with no errors.
  else {
    delete $._formErrors[ctx.trigger.id]
    ctx.removeClass(fieldsetId, '.invalid')
  }
  // Enable/Disable the submit button.
  let hasErrors = Boolean(Object.keys($._formErrors).length)
  hasErrors ? ctx.setAttribute('#submit-btn', 'disabled') : ctx.removeAttribute('#submit-btn', 'disabled')

  // Render this fieldset and return state.
  ctx.render($, fieldsetId)
  return $
}

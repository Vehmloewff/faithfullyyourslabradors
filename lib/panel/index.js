const uuid = require('@lukeed/uuid')
const validate = require('~/lib/validate')

const panels = {}

function stashPanelAndSetState($, options) {
  const id = uuid.v4()

  panels[id] = {
    state: options.state,
    easyClose: options.easyClose,
    submitAction: options.submitAction,
    buttonActions: options.buttons.map((button) => button.pressedAction),
    checkboxNames: options.fields.filter((field) => field.type === 'checkbox').map((field) => field.name),
    numberNames: options.fields.filter((field) => field.type === 'number').map((field) => field.name)
  }

  $.panel = {
    id,
    title: options.title,
    fields: options.fields,
    buttons: options.buttons
  }
}

function removePanel($) {
  const id = $.panel?.id
  if (!id) throw new Error('There is no panel to remove')

  panels[id] = null
  $.panel = null
}

/**
 * Opens a panel for the purpose of creating or editing a resource. For information on the
 * options it takes, see ./lib/panel/readme.md#options
 */
module.exports.openPanel = (ctx, $, options) => {
  ctx.addClass('#panel-container', '.is-open')

  stashPanelAndSetState($, options)

  ctx.include('#panel')
}

/**
 * Close the panel if it is currently inactive.
 * NOTE: Panel does close automatically when one of it's submit buttons are pressed
 */
module.exports.closePanel = (ctx, $) => {
  ctx.removeClass('#panel-container', '.is-open')

  removePanel($)

  ctx.include('#panel')
}

/** Setup the panel */
module.exports.initPanel = (on, options = {}) => {
  on._panelSubmit = (ctx, $) => {
    const panelId = $.panel?.id
    if (!panelId) throw new Error('Cannot handle panel submission. There is no panel open')

    const panel = panels[panelId]
    if (!panel)
      throw new Error('There must be an id mismatch. There is no stashed panel that satisfies the incoming id')

    ctx.panelState = panel.state

    const submitAction = panel.submitAction
    const submitActionFn = on[submitAction]

    for (const checkboxName of panel.checkboxNames) {
      ctx.payload[checkboxName] = ctx.payload[checkboxName] === 'on'
    }

    for (const numberName of panel.numberNames) {
      ctx.payload[numberName] = parseInt(ctx.payload[numberName])
    }

    module.exports.closePanel(ctx, $)

    if (!submitActionFn)
      throw new Error(`${submitAction} was specified as the submitAction for panel, but it doesn't exist`)

    return submitActionFn(ctx, $)
  }

  on._panelValidate = (ctx, $) => {
    if (!options.validate) return $

    return validate(ctx, $, Book)
  }

  on._panelBtn = (ctx, $) => {
    const panelId = $.panel?.id
    if (!panelId) throw new Error('Cannot handle panel submission. There is no panel open')

    const panel = panels[panelId]
    if (!panel)
      throw new Error('There must be an id mismatch. There is no stashed panel that satisfies the incoming id')

    ctx.panelState = panel.state

    const buttonIndex = ctx.payload
    if (!buttonIndex) throw new Error('Buttons without an index in their payload should not call _panelBtn')

    ctx.buttonIndex = buttonIndex

    const buttonActionFn = on[panel.buttonActions[buttonIndex]]

    module.exports.closePanel(ctx, $)

    if (buttonActionFn) return buttonActionFn(ctx, $)

    return ctx.render($)
  }

  on._panelEasyClose = (ctx, $) => {
    const panelId = $.panel?.id
    if (!panelId) throw new Error('Cannot handle panel submission. There is no panel open')

    const panel = panels[panelId]
    if (!panel)
      throw new Error('There must be an id mismatch. There is no stashed panel that satisfies the incoming id')

    if (panel.easyClose) module.exports.closePanel(ctx, $)

    return ctx.render($)
  }
}

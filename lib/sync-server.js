const fs = require('fs')
const { join, dirname, normalize, resolve, extname } = require('path')
const ejs = require('ejs')
const { parse } = require('node-html-parser')
const listenForSocketEvents = require('./socket.js')
const logger = require('./logger')
const e = require('express')

const routesDir = join(__dirname, '../routes')
const reSlotTag = /(?<!\\){{[ \t]*slot[ \t]*}}/
const rePartialTag = /(?<!\\){{[ \t]*partial[ \t]*['"]?([\w\-_\/\.]+)['"]?[ \t]*}}/g
const reNoLayoutTag = /(?<!\\){{[ \t]*nolayout[ \t]*}}/

let cachedRoutes = {}

async function getFileBasedRoutes() {
  // Return routes array of objects with props:
  // [ { endpoint, absPath, render(), listen() }, { ...etc } ]
  let routes = []

  // Read routes directory.
  await readRoutesInDir(routesDir)

  async function readRoutesInDir(thisDir) {
    // List all files and dirs in this directory.
    let files = await fs.promises.readdir(thisDir)

    for (let fileName of files) {
      // Set the full absolute path and URL endpoint for this file.
      let absPath = join(thisDir, fileName)
      let endpoint = absPath.replace(routesDir, '').replace(/\.ejs$/, '')

      // Ignore files starting with an underscore.
      if (fileName.startsWith('_')) continue

      // Recurse into nested directory?
      let thisPathIsADirectory = await (await fs.promises.stat(absPath)).isDirectory()
      if (thisPathIsADirectory) {
        await readRoutesInDir(absPath)
        continue
      }

      // Ignore files not ending with .ejs
      if (!fileName.endsWith('.ejs')) continue

      // If endpoint contains '+' for route params placeholders, change them to Express-friendly '/:' instead.
      endpoint = endpoint.replace('+', '/:').replace('//', '/') // Prevent this after first replacement: docs//:name

      // Create the props including render and listen functions to be invoked by Express.
      let route = {
        absPath: absPath,
        endpoint: endpoint,
        render: getRenderFunction(absPath, endpoint),
        listen: getListenFunction(absPath, endpoint)
      }

      // Add this route to routes array.
      routes.push(route)

      // For <endpoint>/index, add a clone of this route for '/' access without '/index'.
      if (absPath.endsWith('index.ejs')) {
        routes.push({ ...route, endpoint: route.endpoint.replace(/\/index$/, '') })
      }
    }
  }
  return routes
}

async function render404(error, absPath, env) {
  let template = await getNearestSiblingOrParent(absPath, '_404.ejs')
  template = await wrapWithLayout(template, absPath)
  template = await processPartials(template, absPath)
  return ejs.render(template, { $: {}, flash: {}, error, env }, { filename: absPath })
}

async function render500(error, endpoint, env) {
  let absPath = join(routesDir, endpoint)
  let template = await getNearestSiblingOrParent(absPath, '_500.ejs')
  template = await wrapWithLayout(template, absPath)
  template = await processPartials(template, absPath)
  error.title = 'Internal Server Error'
  return ejs.render(template, { $: {}, flash: {}, error, env }, { filename: absPath })
}

// ==========================================

function getRenderFunction(absPath, endpoint) {
  // Return the `render` function that Express will invoke to render the page.
  return async (req, res, next) => {
    let { dom, on, wasCompiled } = await getTemplateAndOn(absPath, endpoint)

    // If there's no mount function, just render the page.
    if (!on.mount) {
      on.mount = async (ctx, $) => {
        return ctx.render($)
      }
    }

    // Create the env object.
    let env = { path: req.path, hostname: req.hostname, ip: req.ip }

    // Set up the initial ctx object for `on.mount` handler.
    let ctx = {
      render: ($, notAllowed) => {
        if (notAllowed) {
          throw Error(
            `In on.mount function, ctx.render() always renders full HTML. Please remove second argument: '${notAllowed}'`
          )
        }

        // Render flash from session?
        let flash = {}
        if (req.session._flash_ && Object.keys(req.session._flash_).length) {
          flash = { ...req.session._flash_ }
          req.session._flash_ = {}
        }

        // Initialize error object.
        let error = {}

        res.send(ejs.render(dom.toString(), { $, flash, error, env }, { filename: absPath }))
        let renderType = req.headers['s-morph'] ? 'RENDER (morph)' : 'RENDER'
        let logMessage = wasCompiled ? `GET ${req.path} ▷ COMPILE ▷ ${renderType}` : `GET ${req.path} ▷ ${renderType}`
        logger.request(logMessage)
        return $
      },
      redirect: (url) => {
        // If we're in morph mode, just send the url in a header and that's it.
        let renderType = req.headers['s-morph'] ? 'REDIRECT (morph)' : 'REDIRECT'
        logger.request(`GET ${endpoint} ▷ ${renderType}`)
        if (req.headers['s-morph']) {
          res.set('s-redirect', url)
          res.send('')
          // For standard HTTP request, use plain old Express redirect.
        } else {
          res.redirect(url)
        }
        let $ = {}
        return $
      },
      _404: async ($ = {}) => {
        logger.error(` ▷ 404 ${ctx.path} ▷ 404 NOT FOUND`)
        let error = { env: process.env.NODE_ENV, path: ctx.path }
        res.send(ejs.render(await render404(error, absPath)), { $ }, { filename: absPath })
        return {}
      },
      _500: async (name, message, stack, env) => {
        let error = {
          env: process.env.NODE_ENV,
          name,
          message
        }
        res.send(await render500(error, ctx.path, ctx.env))
        return {}
      },
      flash: (arg1, arg2) => {
        let isKeyValStrings = typeof arg1 === 'string' && typeof arg2 === 'string'
        let argsObject = isKeyValStrings ? { [arg1]: arg2 } : arg1
        let isNonEmptyObject = typeof argsObject === 'object' && argsObject !== null && Object.keys(argsObject).length
        if (!isNonEmptyObject) {
          logger.error('Warning: ctx.flash() accepts key/val strings or object of key/vals')
          return
        }
        req.session._flash_ = req.session._flash_ || {}
        for (let key in argsObject) {
          req.session._flash_[key] = argsObject[key]
        }
        return ctx
      },
      addClass: () => showNotAvailableWarning(ctx, 'addClass'),
      removeClass: () => showNotAvailableWarning(ctx, 'removeClass'),
      setAttribute: () => showNotAvailableWarning(ctx, 'setAttribute'),
      removeAttribute: () => showNotAvailableWarning(ctx, 'removeAttribute'),
      payload: {}, // Only relevant in actions.
      path: req.path,
      absPath: absPath,
      query: req.query,
      params: req.params,
      session: req.session,
      env,
      req,
      res,
      next
    }

    // Invoke on.mount() and return $ and route params so they can be set to socket.
    let $ = await on.mount(ctx, {})
    if (!$)
      logger.error(
        'WARNING: Remember to always `return $` from on.mount() so that subsequent actions can access state variables\n'
      )
    return { ctx, $ }
  }
}

function showNotAvailableWarning(ctx, method) {
  logger.error(`Warning: ctx.${method} is not available in on.mount function`)
  return ctx
}

function getListenFunction(absPath, endpoint) {
  // Return the `listen` function that Express will invoke to add listeners for socket events.
  return async (ctxFromRender, $, io, socketId) => {
    // First, get the template w/o sync block as a string AND the on object defined in sync block.
    let { dom, on } = await getTemplateAndOn(absPath, endpoint)

    // Add listeners for new socket connection or existing.
    if (!socketId) {
      io.on('connection', (socket) => {
        listenForSyncActions(ctxFromRender, $, dom, on, socket)
      })
    }
    // Request includes socketId?
    else {
      // Use existing socket and just reset action listeners.
      let socket = io.sockets.sockets.get(socketId)
      if (socket) {
        listenForSyncActions(ctxFromRender, $, dom, on, socket)
      }
    }
  }
}

async function listenForSyncActions(ctxFromRender, $, dom, on, socket) {
  // For all actions on this page, we'll keep a DOM object of the template in memory
  // and update it as needed with addClass, removeAttibute, etc.
  socket.removeAllListeners('_syncAction_')
  socket.on('_syncAction_', async ({ actionName, trigger, payload }) => {
    // Always reload session.
    socket.request.session.reload((err) => {
      if (err) socket.disconnect()
    })

    let cssClassesToAdd = {}
    let cssClassesToRemove = {}
    let attributesToSet = {}
    let attributesToRemove = {}

    // Make sure this action was defined in sync block.
    if (!(actionName in on)) {
      logger.error(`No action handler found in sync block: on.${actionName}`)
      return
    }

    // Stash of elements pre-applied for re-rendering
    let preAppliedElements = []

    // Build context object for 'on.<action>' handlers.
    let ctx = {
      socket,
      payload,
      include: (elementId) => preAppliedElements.push(elementId),
      render: ($, elements = []) => {
        // If elements is a single string, convert to array.
        elements = Array.isArray(elements) ? elements : [elements]
        elements.push(...preAppliedElements)

        preAppliedElements = []

        // Render flash from session?
        let flash = {}
        if (socket.request.session._flash_ && Object.keys(socket.request.session._flash_).length) {
          flash = { ...socket.request.session._flash_ }
          socket.request.session._flash_ = {}
        }

        // Render full HTML or specified elements with EJS.
        let elementsToSync = {}
        if (elements == ['html']) {
          elementsToSync = {
            html: ejs.render(dom.querySelector('html'), { $, flash, env }, { filename: ctxFromRender.absPath })
          }
        } else {
          elements.forEach((elementId) => {
            if (!isValidId(elementId)) return
            let elementTemplate = dom.querySelector(elementId)?.outerHTML
            elementsToSync[elementId] = ejs.render(
              elementTemplate,
              { $, flash, env: ctx.env },
              { filename: ctxFromRender.absPath }
            )
          })
        }

        // Emit before updating cached dom.
        socket.emit('_syncMorph_', {
          elementsToSync,
          cssClassesToAdd,
          cssClassesToRemove,
          attributesToSet,
          attributesToRemove
        })
        let elementsToSyncNames = Object.keys(elementsToSync)
        let elementsToSyncPretty = elementsToSyncNames.length ? elementsToSyncNames.join(', ') : 'html'

        logger.request(` ▷ ACTION ${actionName} ▷ RENDER ${elementsToSyncPretty}`)
        return $
      },
      redirect: (url) => {
        logger.request(` ▷ ACTION ${actionName} ▷ REDIRECT ▷ ${url}`)
        socket.emit('_syncRedirect_', url)
        return $
      },
      _404: async () => {
        logger.error(` ▷ ACTION ${actionName} ▷ 404 NOT FOUND`)
        let error = { env: process.env.NODE_ENV, path: ctx.path }
        socket.emit('_syncMorph_', { elementsToSync: { html: await render404(error, ctx.absPath, ctx.env) } })
        return {}
      },
      _500: async (name, message, stack, env) => {
        logger.error(` ▷ ACTION ${actionName} ▷ 500 INTERNAL SERVER ERROR`)
        let error = {
          env: process.env.NODE_ENV,
          path: ctx.url,
          name,
          message,
          stack
        }
        socket.emit('_syncMorph_', { elementsToSync: { html: await render500(error, ctx.absPath, ctx.env) } })
        return {}
      },
      addClass: (id, classNames) => {
        if (!isValidId(id)) return ctx
        if (typeof classNames === 'string') classNames = [classNames]
        cssClassesToAdd[id] = cssClassesToAdd[id] || []
        classNames.forEach((className) => {
          if (!isValidClass(className)) return ctx
          if (!cssClassesToAdd[id].includes(className)) cssClassesToAdd[id].push(className)
        })
        return ctx
      },
      removeClass: (id, classNames) => {
        if (!isValidId(id)) return ctx
        if (typeof classNames === 'string') classNames = [classNames]
        cssClassesToRemove[id] = cssClassesToRemove[id] || []
        classNames.forEach((className) => {
          if (!isValidClass(className)) return ctx
          if (!cssClassesToRemove[id].includes(className)) cssClassesToRemove[id].push(className)
        })
        return ctx
      },
      setAttribute: (id, attributeName, value) => {
        if (!isValidId(id)) return ctx
        attributesToSet[id] = attributesToSet[id] || {}
        attributesToSet[id][attributeName] = value || ''
        return ctx
      },
      removeAttribute: (id, attrNames) => {
        if (!isValidId(id)) return ctx
        if (typeof attrNames === 'string') attrNames = [attrNames]
        attributesToRemove[id] = attributesToRemove[id] || []
        attrNames.forEach((attrName) => {
          if (!attributesToRemove[id].includes(attrName)) attributesToRemove[id].push(attrName)
        })
        return ctx
      },
      flash: (arg1, arg2) => {
        let isKeyValStrings = typeof arg1 === 'string' && typeof arg2 === 'string'
        let argsObject = isKeyValStrings ? { [arg1]: arg2 } : arg1
        let isNonEmptyObject = typeof argsObject === 'object' && argsObject !== null && Object.keys(argsObject).length
        if (!isNonEmptyObject) {
          logger.error('Warning: ctx.flash() accepts key/val strings or object of key/vals')
          return
        }
        socket.request.session._flash_ = socket.request.session._flash_ || {}
        for (let key in argsObject) {
          socket.request.session._flash_[key] = argsObject[key]
          socket.request.session.save()
        }
        return ctx
      },
      params: ctxFromRender.params,
      path: ctxFromRender.path,
      absPath: ctxFromRender.absPath,
      host: ctxFromRender.host,
      session: socket.request.session,
      trigger: trigger,
      env: ctxFromRender.env
    }
    try {
      $ = await on[actionName](ctx, $)
    } catch (error) {
      logger.error(error.stack)
      ctx._500(error.name, error.message, error.stack)
    }
    if (!$)
      logger.error(
        `WARNING: Remember to \`return $\` from on.${actionName}() so that subsequent actions can access state variables\n`
      )
  })
}

function isValidId(id) {
  let isValid = /^#[A-Za-z]+[\w\-\:\.]*$/.test(id)
  if (!isValid) logger.error(`Warning: Invalid id reference \`${id}\` used in Sync Block`)
  return isValid
}

function isValidClass(className) {
  let isValid = /^\.-?[_a-zA-Z]+[_a-zA-Z0-9-\/]*$/.test(className)
  if (!isValid) logger.error(`Warning: Invalid CSS class reference \`${className}\` used in Sync Block`)
  return isValid
}

async function getTemplateAndOn(absPath, endpoint) {
  let wasCompiled = false
  // Do we need to compile this template?
  if (!cachedRoutes[endpoint]) {
    // Read the route file and return the layout wrapped template plus the sync object.
    let innerTemplateAndSyncBlock = await fs.promises.readFile(absPath, 'utf-8')
    let syncBlockMatch = innerTemplateAndSyncBlock.match(/<script[\s]sync>([\s\S]+?)<\/script>/m)
    let syncBlock = (syncBlockMatch && syncBlockMatch[1]) || null
    let innerTemplate = syncBlock
      ? innerTemplateAndSyncBlock.replace(syncBlockMatch[0], '').trim()
      : innerTemplateAndSyncBlock

    // Wrap with layout?
    let template = await wrapWithLayout(innerTemplate, absPath)

    // Process partials?
    template = await processPartials(template, absPath)

    // Parse template text to DOM object.
    let dom = parse(template)

    // Process Class and Fieldset helpers.
    dom = processClassHelpers(dom)
    // dom = processFieldsetHelpers(dom)

    // Get the `on` object defined in the sync block.
    const syncBlockFunction = getSyncBlockFunction(syncBlock, absPath)
    let on = await syncBlockFunction(require, { action: {} }) // Receives Node require, init sync object.

    // Save to cache.
    cachedRoutes[endpoint] = { dom, on }
    wasCompiled = true
  }
  let { dom, on } = cachedRoutes[endpoint]
  return { dom, on, wasCompiled }
}

async function wrapWithLayout(innerTemplate, absPath) {
  if (reNoLayoutTag.test(innerTemplate)) {
    return innerTemplate.replace(reNoLayoutTag, '')
  } else {
    let layoutTemplate = await getNearestSiblingOrParent(absPath, '_layout.ejs')
    return layoutTemplate.replace(reSlotTag, innerTemplate)
  }
}

async function processPartials(template, absPath) {
  let partialTags = template.matchAll(rePartialTag)
  for (let tag of partialTags) {
    let partialTag = tag[0]
    let partialRoute = tag[1]
    let partialRouteWithExt = extname(partialRoute) ? partialRoute : partialRoute + '.ejs'
    let partialTemplate, partialFile
    // Is path absolute or relative?
    let dirName = partialRouteWithExt.startsWith('/') ? routesDir : dirname(absPath)
    try {
      partialFile = join(dirName, partialRouteWithExt)
      partialTemplate = await fs.promises.readFile(partialFile, 'utf-8')
    } catch (error) {
      logger.error(`\nFailed to process partial tag ${partialTag}\nNo file found at: ${partialFile}\n`)
      continue
    }
    template = template.replace(partialTag, partialTemplate)
  }
  return template
}

function processClassHelpers(dom) {
  // Process s-class="<className> | <condition>".
  let sClass = dom.querySelectorAll('[s-class]')
  sClass.forEach((el) => {
    let attrValue = el.getAttribute('s-class')
    let attrValueParts = attrValue.split(/\|(.+)/)
    if (attrValueParts.length < 2) {
      logger.error(`Warning: Unable to parse s-class="${attrValue}" (missing pipe character)`)
      return
    }
    let className = attrValueParts[0].trim()
    let condition = attrValueParts[1].trim()
    let updatedClasses = getUpdatedClasses(el, className, condition)
    el.removeAttribute('s-class').setAttribute('class', updatedClasses)
  })

  // Process s-active="<condition>"
  let sActive = dom.querySelectorAll('[s-active]')
  sActive.forEach((el) => {
    let condition = el.getAttribute('s-active')
    let updatedClasses = getUpdatedClasses(el, 'active', condition)
    el.removeAttribute('s-active').setAttribute('class', updatedClasses)
  })

  // Process s-active-path="<condition>"
  let sActivePath = dom.querySelectorAll('[s-active-path]')
  sActivePath.forEach((el) => {
    let condition = `env.path.startsWith('${el.getAttribute('s-active-path') || el.getAttribute('href') || ''}')`
    let updatedClasses = getUpdatedClasses(el, 'active', condition)
    el.removeAttribute('s-active-path').setAttribute('class', updatedClasses)
  })

  function getUpdatedClasses(el, className, condition) {
    let currentClasses = el.getAttribute('class')?.toString()
    let classNameWithOptionalSpace = currentClasses ? ' ' + className : className
    let ejs = `<%= ${condition} ? '${classNameWithOptionalSpace}' : '' %>`
    let updatedClasses = currentClasses ? currentClasses + ejs : ejs
    return updatedClasses.trim()
  }
  return dom
}

function processFieldsetHelpers(dom) {
  // Todo
  return dom
}

function getSyncBlockFunction(syncBlock, absPath) {
  // Use syncBlock code to build a function which will be called with intital `sync` state as arg.

  // Note on.render should simply RETURN the rendered template! # template = syncBlockFunction.mount()
  let syncBlockFunction
  try {
    syncBlockFunction = new Function('require', 'on', syncBlock + '\n\nreturn on')
  } catch (error) {
    logger.error(`\n ** Unable to parse server block in: ${absPath}\n\n${error.stack}`)
  }
  return syncBlockFunction
}

async function getNearestSiblingOrParent(absPath, targetTemplate, isRecursing = false) {
  // When initially invoked and no file extension, try using the absPath as parentDir.
  let parentDir = !isRecursing && !extname(absPath) ? absPath : dirname(absPath)
  let pathToTarget = join(parentDir, targetTemplate)

  try {
    let targetFile = await fs.promises.readFile(pathToTarget, 'utf-8')
    return targetFile
  } catch (error) {}
  let reachedTop = normalize(parentDir) == normalize(routesDir) || normalize(parentDir) == '/'
  return reachedTop ? '' : await getNearestSiblingOrParent(parentDir, targetTemplate, true)
}

module.exports = { getFileBasedRoutes, render404, render500 }

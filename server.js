const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const connectToMongo = require('./lib/mongoConnection')
const socketIO = require('socket.io')
const { getFileBasedRoutes, render404, render500 } = require('./lib/sync-server')
const { join } = require('path')
const livereload = require('livereload')
const connectLivereload = require('connect-livereload')
const logger = require('./lib/logger')
const dotenv = require('dotenv')
const socket = require('./lib/socket')
dotenv.config()

// Create Express app in module scope.
const app = express()
const staticDir = join(__dirname, 'static')

run()

async function run() {
  // Require Node 16+.
  const nodeVersion = process.versions.node.split('.')[0]
  if (nodeVersion < 16) {
    console.error(`Node 16 or higher is required. (Detected: Node v${process.versions.node})`)
    process.exit()
  }

  // Require necessary .env values.
  const hasRequiredEnvValues = checkForRequiredEnvValues()
  if (!hasRequiredEnvValues) process.exit()

  // Ignore /favicon.ico requests from Chrome.
  app.use((req, res, next) => {
    if (req.url === '/favicon.ico') {
      res.type('image/x-icon')
      res.status(204)
      res.end()
      return
    }
    next()
  })

  // Serve static resources like images and css.
  app.use(express.static(staticDir))

  // Use gzip compression.
  app.use(compression())

  // Modify response headers for better security.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))

  // Allow use of modern browser form data and JSON responses.
  app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }))
  app.use(express.json())

  // Use Express Session Middleware.
  const sessionMiddleware = getSessionMiddleware()
  // app.enable('trust proxy')
  app.use(sessionMiddleware)
  // app.use(session({ secret: 'ssshhhhh' }))

  // Start the Express server.
  const expressServer = startExpressServer()

  // Connect to Mongo
  if (process.env.MONGO_URI) connectToMongo()

  // Add socket.io to Express server.
  const io = socketIO(expressServer, { cors: { origin: '*' } })

  // Make session available to socket.io connections
  io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res, next)
  })

  // Add file-based routes.
  let routes = await getFileBasedRoutes()
  for (let route of routes) {
    app.get(route.endpoint, async (req, res, next) => {
      // Render the template using on.mount if present, then pass in the mounted state vars to set to socket.$
      let { ctx, $ } = await route.render(req, res, next)
      // Add socket listeners for sync actions or reset for existing socket id.
      route.listen(ctx, $, io, req.headers['socket-id'])
    })
  }

  // Use simple request logger if not handled by file-based routes.
  app.use(async (req, res, next) => {
    if (req.url == '/service-worker.js') return next()
    logger.request(req.method.toUpperCase(), req.url)
    next()
  })

  // Handle simple 404.
  app.use(async (req, res, next) => {
    if (req.url == '/service-worker.js') return next()
    logger.error(`404 NOT FOUND: ${req.method} ${req.url}`)
    let absPath = join(__dirname, 'routes', req.url)
    let error = { path: req.url }
    let env = { path: req.path, hostname: req.hostname, ip: req.ip }
    let _404page = await render404(error, absPath, env)
    res.status(404).send(_404page)
  })

  // Handle 500 errors.
  app.use(async (error, req, res, next) => {
    // Is this a MongoDB castError?
    // Ex: /usersById/not-a-real-id causes Mongo to throw this error.
    if (error?.name == 'CastError') {
      // Handle as a regular 404.
      logger.error('MongoDB CastError (invalid ObjectID)')
      logger.error(`404 NOT FOUND: ${req.method} ${req.url}`)
      let absPath = join(__dirname, 'routes', req.url)
      let error = { path: req.url }
      let _404page = await render404(error, absPath)
      res.status(404).send(_404page)
      return
    }
    logger.error(error.message, error.stack)
    error.env = process.env.NODE_ENV
    let env = { path: req.path, hostname: req.hostname, ip: req.ip }
    let _500page = await render500(error, req.url, env)
    res.status(500).send(_500page)
  })
}

// Use LiveReload for dev environment only.
if (app.get('env') === 'dev') {
  const liveReloadServer = livereload.createServer()
  // Only directly watch the static directory.
  liveReloadServer.watch(staticDir)
  // When Nodemon restarts, refresh the browser.
  liveReloadServer.server.once('connection', () => {
    setTimeout(() => {
      liveReloadServer.refresh('/')
    }, 100)
  })
  // Inject the JS snippet into page <head>.
  app.use(connectLivereload())
}
/* ------------------------------------------ */

function checkForRequiredEnvValues() {
  const requiredEnvs = ['PORT', 'NAME', 'NODE_ENV', 'MONGO_URI', 'SESSION_SECRET']
  const missingEnvs = requiredEnvs.filter((e) => !process.env[e])
  if (missingEnvs.length) {
    console.log('\nBefore running SyncJS, please set the following values in your .env:\n')
    for (const v of missingEnvs) logger.error('-', v)
    console.log('')
    return false
  }
  return true
}

function getSessionMiddleware() {
  return session({
    name: 'session_id',
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
    proxy: true,
    store: new MongoDBStore({
      uri: process.env.MONGO_URI,
      collection: '_express_sessions'
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 2 // 2 hours
    },
    rolling: true
  })
}

function startExpressServer() {
  const port = process.env.PORT || 3000
  return app.listen(port, () => {
    console.log('\x1b[33m', `\n👍 Listening at http://localhost:${port}\n`, '\x1b[0m')
  })
}

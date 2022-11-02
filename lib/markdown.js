/**
 * Accepts path from routes as in: markdown('/posts/about-me')
 * The .md file extension is optional.
 *
 * Returns an object containing { content, data } where content
 * is the actual markdown template and data is any values set in
 * front-matter.
 *
 * Example:
 * ////////////////////////
 * ---
 * title: About Me
 * ___
 *
 * ## Hello!
 *
 * ////////////////////////
 *
 * Would be returned as:
 * {
 *    content: '<h2>Hello!</h2>',
 *    data: { title: 'About Me' }
 * }
 *
 */

const fs = require('fs')
const { join, extname } = require('path')
const logger = require('./logger')
const matter = require('gray-matter')
const md = require('markdown-it')().use(require('markdown-it-highlightjs'), {})

let cache = {}

module.exports = async function markdown(pathFromRoutes) {
  pathFromRoutes = extname(pathFromRoutes) ? pathFromRoutes : pathFromRoutes + '.md'
  if (!cache[pathFromRoutes]) {
    try {
      let absPath = join(__dirname, '../routes', pathFromRoutes)
      let mdFile = await fs.promises.readFile(absPath, 'utf-8')
      let grayMatterParsed = matter(mdFile)
      if (!grayMatterParsed) return undefined
      cache[pathFromRoutes] = {
        content: md.render(grayMatterParsed.content),
        data: grayMatterParsed.data
      }
    } catch (error) {
      logger.error('Error parsing markdown file:', error)
    }
  }
  return cache[pathFromRoutes]
}

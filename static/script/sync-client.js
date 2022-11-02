// Connect to socket and make the `socket` object globally available.
const socket = io.connect('/')

document.addEventListener('DOMContentLoaded', () => {
  let eventListeners = []

  let morphableAnchorSelector = 'a[href]:not([href^="http://"]):not([href^="https://"]):not([target]):not([download])'

  let eventTypes = [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'mouseover',
    'mousemove',
    'mouseout',
    'dragstart',
    'drag',
    'dragenter',
    'dragleave',
    'dragover',
    'drop',
    'dragend',
    'select',
    'change',
    'input',
    'reset',
    'focus',
    'blur'
  ]

  // Use page morphing for navigation?
  let htmlWithSMorph = document.querySelector('html[s-morph]')
  let useMorph = htmlWithSMorph && htmlWithSMorph.getAttribute('s-morph') === 'true'
  if (useMorph) addMorphListeners()

  // Add action listeners: s-<action>
  addActionListeners()

  // Listen for browser back/fwd buttons
  window.addEventListener('popstate', async (e) => {
    e.preventDefault()
    await morphToRoute(window.location.pathname)
  })

  // Listen for _syncMorph_ events from sync-server.js.
  socket.on('_syncMorph_', (options) => {
    let {
      elementsToSync,
      cssClassesToAdd = {},
      cssClassesToRemove = {},
      attributesToSet = {},
      attributesToRemove = {}
    } = options

    // Full page morph?
    if (elementsToSync['html']) {
      morphAndResetListeners(document.querySelector('html'), elementsToSync['html'])
      return
    }

    // Otherwise, update for each key as an element id.
    removeListeners()
    for (let id in elementsToSync) {
      let currentEl = document.querySelector(id)
      if (!currentEl) {
        console.warn(`Sync action failed: No such element in current document: ${id}`)
        continue
      }
      morphOneElement(currentEl, elementsToSync[id])
      currentEl.getBoundingClientRect()
      // let updatedHeadEl = document.createElement('head')
      // updatedHeadEl.innerHTML = updatedEl
      // let currentTitle = document.querySelector('title')
      // let updatedTitle = updatedHeadEl.querySelector('title')
      // morphdom(currentTitle, updatedTitle)
    }
    addMorphListeners()
    addActionListeners()

    // Add and remove CSS classes.
    for (let id in cssClassesToAdd) {
      let el = document.querySelector(id)
      if (!el) continue
      el.getBoundingClientRect() // Note: This ensures DOM is loaded before next line.
      cssClassesToAdd[id].forEach((className) => el.classList.add(className.replace(/^\./, '')))
    }
    for (let id in cssClassesToRemove) {
      let el = document.querySelector(id)
      if (!el) continue
      el.getBoundingClientRect()
      cssClassesToRemove[id].forEach((className) => el.classList.remove(className.replace(/^\./, '')))
    }

    // Add and remove attributes.
    for (let id in attributesToSet) {
      let el = document.querySelector(id)
      if (!el) continue
      el.getBoundingClientRect()
      for (let attrName in attributesToSet[id]) {
        el.setAttribute(attrName, attributesToSet[id][attrName])
      }
    }
    for (let id in attributesToRemove) {
      let el = document.querySelector(id)
      if (!el) continue
      el.getBoundingClientRect()
      attributesToRemove[id].forEach((attrName) => el.removeAttribute(attrName))
    }
  })

  // Listen for _syncRedirect_ events from sync-server.js
  socket.on('_syncRedirect_', (url) => {
    morphToRoute(url)
    history.pushState(null, null, url)
  })

  // Scroll to hash if defined otherwise scroll to top.
  scrollToHashOrTop(location.hash)

  /* FUNCTIONS
  ==================================== */

  function addMorphListeners() {
    let morphAnchors = document.querySelectorAll(morphableAnchorSelector)

    morphAnchors.forEach((el) => {
      // Does this link to a filename like /files/my-file.zip ?
      let endOfPath = el.href.split('/').pop()
      if (endOfPath.includes('.')) return

      let handler = (e) => {
        e.preventDefault()
        morphToRoute(el.href)
        history.pushState(null, null, el.href)
      }
      let eventType = 'click'
      el.addEventListener(eventType, handler)
      eventListeners.push({ eventType, el, handler })
    })
  }

  function removeListeners() {
    ;[...eventTypes, 'submit'].forEach((eventType) => {
      listenersForThisEvent = eventListeners.filter((obj) => obj.eventType === eventType)
      listenersForThisEvent.forEach(({ el, handler }) => {
        el.removeEventListener(eventType, handler)
      })
    })
    eventListeners = []
  }

  function addActionListeners() {
    // Add all action handlers except submit.
    eventTypes.forEach((eventType) => {
      document.querySelectorAll(`[s-${eventType}]`).forEach((el) => {
        const actionName = el.getAttribute(`s-${eventType}`)
        const payload = el.getAttribute('s-payload')
        let handler = (e) => {
          e.preventDefault()
          let trigger = { id: e.target.id, name: e.target.name, value: e.target.value }
          socket.emit('_syncAction_', { actionName, trigger, payload })
        }
        el.addEventListener(eventType, handler)

        // Add to array so it can be removed later.
        eventListeners.push({ eventType, el, handler })
      })
    })

    // Add submit event handler and get form values.
    document.querySelectorAll('form[s-submit]').forEach((el) => {
      const actionName = el.getAttribute('s-submit')
      let handler = (e) => {
        e.preventDefault()
        let payload = {}
        let formData = new FormData(el)
        for ([key, val] of formData) {
          payload[key] = val
        }
        socket.emit('_syncAction_', { actionName, payload })
      }
      el.addEventListener('submit', handler)

      // Add to map so it can be removed later.
      eventListeners.push({ eventType: 'submit', el, handler })
    })
  }

  async function morphToRoute(url) {
    let res = await fetch(url, { headers: { 's-morph': 'true', 'socket-id': socket.id } })
    // Is this just a s-redirect header? If so, recursively call that URL instead.
    let redirectUrl = res.headers.get('s-redirect')
    if (redirectUrl) {
      morphToRoute(redirectUrl)
      history.pushState(null, null, redirectUrl) // TODO: Is this redundant? morphToRoute (above) does this too.
      return
    }

    // Morph new content.
    let currentHtml = document.querySelector('html')
    let newHtml = await res.text()
    morphAndResetListeners(currentHtml, newHtml)

    // Scroll to hash if present or top.
    scrollToHashOrTop(location.hash)

    // Dispatch event for any listeners who may need it.
    let sMorphEvent = new Event('s-morph')
    document.dispatchEvent(sMorphEvent)
  }

  function scrollToHashOrTop(hash) {
    if (hash) {
      let scrollToElem = document.querySelector(hash)
      scrollToElem && scrollToElem.scrollIntoView({ behavior: 'smooth' })
    } else {
      let elemToScrollToTop = document.querySelector('main')
      elemToScrollToTop.scrollTop = 0
    }
  }

  function morphOneElement(fromNode, toNode) {
    morphdom(fromNode, toNode, {
      onBeforeElUpdated: function (fromEl, toEl) {
        // spec - https://dom.spec.whatwg.org/#concept-node-equals
        if (fromEl.isEqualNode(toEl)) {
          return false
        }
        return true
      }
    })
  }

  function morphAndResetListeners(fromNode, toNode) {
    // Remove all morph and action listeners.
    removeListeners()

    morphOneElement(fromNode, toNode)

    // Add morph and action listeners.
    addMorphListeners()
    addActionListeners()
  }

  /* Morphdom
  ==================================== */

  /**
   * Minified by jsDelivr using Terser v3.14.1.
   * Original file: /npm/morphdom@2.6.1/dist/morphdom.js
   *
   * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
   */
  ;('use strict')
  var range,
    DOCUMENT_FRAGMENT_NODE = 11
  function morphAttrs(e, t) {
    var n,
      r,
      o,
      a,
      i = t.attributes
    if (t.nodeType !== DOCUMENT_FRAGMENT_NODE && e.nodeType !== DOCUMENT_FRAGMENT_NODE) {
      for (var d = i.length - 1; d >= 0; d--)
        (r = (n = i[d]).name),
          (o = n.namespaceURI),
          (a = n.value),
          o
            ? ((r = n.localName || r),
              e.getAttributeNS(o, r) !== a && ('xmlns' === n.prefix && (r = n.name), e.setAttributeNS(o, r, a)))
            : e.getAttribute(r) !== a && e.setAttribute(r, a)
      for (var l = e.attributes, c = l.length - 1; c >= 0; c--)
        (r = (n = l[c]).name),
          (o = n.namespaceURI)
            ? ((r = n.localName || r), t.hasAttributeNS(o, r) || e.removeAttributeNS(o, r))
            : t.hasAttribute(r) || e.removeAttribute(r)
    }
  }
  var NS_XHTML = 'http://www.w3.org/1999/xhtml',
    doc = 'undefined' == typeof document ? void 0 : document,
    HAS_TEMPLATE_SUPPORT = !!doc && 'content' in doc.createElement('template'),
    HAS_RANGE_SUPPORT = !!doc && doc.createRange && 'createContextualFragment' in doc.createRange()
  function createFragmentFromTemplate(e) {
    var t = doc.createElement('template')
    return (t.innerHTML = e), t.content.childNodes[0]
  }
  function createFragmentFromRange(e) {
    return range || (range = doc.createRange()).selectNode(doc.body), range.createContextualFragment(e).childNodes[0]
  }
  function createFragmentFromWrap(e) {
    var t = doc.createElement('body')
    return (t.innerHTML = e), t.childNodes[0]
  }
  function toElement(e) {
    return (
      (e = e.trim()),
      HAS_TEMPLATE_SUPPORT
        ? createFragmentFromTemplate(e)
        : HAS_RANGE_SUPPORT
        ? createFragmentFromRange(e)
        : createFragmentFromWrap(e)
    )
  }
  function compareNodeNames(e, t) {
    var n,
      r,
      o = e.nodeName,
      a = t.nodeName
    return (
      o === a ||
      ((n = o.charCodeAt(0)),
      (r = a.charCodeAt(0)),
      n <= 90 && r >= 97 ? o === a.toUpperCase() : r <= 90 && n >= 97 && a === o.toUpperCase())
    )
  }
  function createElementNS(e, t) {
    return t && t !== NS_XHTML ? doc.createElementNS(t, e) : doc.createElement(e)
  }
  function moveChildren(e, t) {
    for (var n = e.firstChild; n; ) {
      var r = n.nextSibling
      t.appendChild(n), (n = r)
    }
    return t
  }
  function syncBooleanAttrProp(e, t, n) {
    e[n] !== t[n] && ((e[n] = t[n]), e[n] ? e.setAttribute(n, '') : e.removeAttribute(n))
  }
  var specialElHandlers = {
      OPTION: function (e, t) {
        var n = e.parentNode
        if (n) {
          var r = n.nodeName.toUpperCase()
          'OPTGROUP' === r && (r = (n = n.parentNode) && n.nodeName.toUpperCase()),
            'SELECT' !== r ||
              n.hasAttribute('multiple') ||
              (e.hasAttribute('selected') &&
                !t.selected &&
                (e.setAttribute('selected', 'selected'), e.removeAttribute('selected')),
              (n.selectedIndex = -1))
        }
        syncBooleanAttrProp(e, t, 'selected')
      },
      INPUT: function (e, t) {
        syncBooleanAttrProp(e, t, 'checked'),
          syncBooleanAttrProp(e, t, 'disabled'),
          e.value !== t.value && (e.value = t.value),
          t.hasAttribute('value') || e.removeAttribute('value')
      },
      TEXTAREA: function (e, t) {
        var n = t.value
        e.value !== n && (e.value = n)
        var r = e.firstChild
        if (r) {
          var o = r.nodeValue
          if (o == n || (!n && o == e.placeholder)) return
          r.nodeValue = n
        }
      },
      SELECT: function (e, t) {
        if (!t.hasAttribute('multiple')) {
          for (var n, r, o = -1, a = 0, i = e.firstChild; i; )
            if ('OPTGROUP' === (r = i.nodeName && i.nodeName.toUpperCase())) i = (n = i).firstChild
            else {
              if ('OPTION' === r) {
                if (i.hasAttribute('selected')) {
                  o = a
                  break
                }
                a++
              }
              !(i = i.nextSibling) && n && ((i = n.nextSibling), (n = null))
            }
          e.selectedIndex = o
        }
      }
    },
    ELEMENT_NODE = 1,
    DOCUMENT_FRAGMENT_NODE$1 = 11,
    TEXT_NODE = 3,
    COMMENT_NODE = 8
  function noop() {}
  function defaultGetNodeKey(e) {
    if (e) return (e.getAttribute && e.getAttribute('id')) || e.id
  }
  function morphdomFactory(e) {
    return function (t, n, r) {
      if ((r || (r = {}), 'string' == typeof n))
        if ('#document' === t.nodeName || 'HTML' === t.nodeName || 'BODY' === t.nodeName) {
          var o = n
          ;(n = doc.createElement('html')).innerHTML = o
        } else n = toElement(n)
      var a = r.getNodeKey || defaultGetNodeKey,
        i = r.onBeforeNodeAdded || noop,
        d = r.onNodeAdded || noop,
        l = r.onBeforeElUpdated || noop,
        c = r.onElUpdated || noop,
        u = r.onBeforeNodeDiscarded || noop,
        N = r.onNodeDiscarded || noop,
        m = r.onBeforeElChildrenUpdated || noop,
        f = !0 === r.childrenOnly,
        E = Object.create(null),
        s = []
      function p(e) {
        s.push(e)
      }
      function T(e, t, n) {
        !1 !== u(e) &&
          (t && t.removeChild(e),
          N(e),
          (function e(t, n) {
            if (t.nodeType === ELEMENT_NODE)
              for (var r = t.firstChild; r; ) {
                var o = void 0
                n && (o = a(r)) ? p(o) : (N(r), r.firstChild && e(r, n)), (r = r.nextSibling)
              }
          })(e, n))
      }
      function v(e) {
        d(e)
        for (var t = e.firstChild; t; ) {
          var n = t.nextSibling,
            r = a(t)
          if (r) {
            var o = E[r]
            o && compareNodeNames(t, o) ? (t.parentNode.replaceChild(o, t), A(o, t)) : v(t)
          } else v(t)
          t = n
        }
      }
      function A(t, n, r) {
        var o = a(n)
        if ((o && delete E[o], !r)) {
          if (!1 === l(t, n)) return
          if ((e(t, n), c(t), !1 === m(t, n))) return
        }
        'TEXTAREA' !== t.nodeName
          ? (function (e, t) {
              var n,
                r,
                o,
                d,
                l,
                c = t.firstChild,
                u = e.firstChild
              e: for (; c; ) {
                for (d = c.nextSibling, n = a(c); u; ) {
                  if (((o = u.nextSibling), c.isSameNode && c.isSameNode(u))) {
                    ;(c = d), (u = o)
                    continue e
                  }
                  r = a(u)
                  var N = u.nodeType,
                    m = void 0
                  if (
                    (N === c.nodeType &&
                      (N === ELEMENT_NODE
                        ? (n
                            ? n !== r &&
                              ((l = E[n])
                                ? o === l
                                  ? (m = !1)
                                  : (e.insertBefore(l, u), r ? p(r) : T(u, e, !0), (u = l))
                                : (m = !1))
                            : r && (m = !1),
                          (m = !1 !== m && compareNodeNames(u, c)) && A(u, c))
                        : (N !== TEXT_NODE && N != COMMENT_NODE) ||
                          ((m = !0), u.nodeValue !== c.nodeValue && (u.nodeValue = c.nodeValue))),
                    m)
                  ) {
                    ;(c = d), (u = o)
                    continue e
                  }
                  r ? p(r) : T(u, e, !0), (u = o)
                }
                if (n && (l = E[n]) && compareNodeNames(l, c)) e.appendChild(l), A(l, c)
                else {
                  var f = i(c)
                  !1 !== f &&
                    (f && (c = f), c.actualize && (c = c.actualize(e.ownerDocument || doc)), e.appendChild(c), v(c))
                }
                ;(c = d), (u = o)
              }
              !(function (e, t, n) {
                for (; t; ) {
                  var r = t.nextSibling
                  ;(n = a(t)) ? p(n) : T(t, e, !0), (t = r)
                }
              })(e, u, r)
              var s = specialElHandlers[e.nodeName]
              s && s(e, t)
            })(t, n)
          : specialElHandlers.TEXTAREA(t, n)
      }
      !(function e(t) {
        if (t.nodeType === ELEMENT_NODE || t.nodeType === DOCUMENT_FRAGMENT_NODE$1)
          for (var n = t.firstChild; n; ) {
            var r = a(n)
            r && (E[r] = n), e(n), (n = n.nextSibling)
          }
      })(t)
      var h = t,
        O = h.nodeType,
        C = n.nodeType
      if (!f)
        if (O === ELEMENT_NODE)
          C === ELEMENT_NODE
            ? compareNodeNames(t, n) || (N(t), (h = moveChildren(t, createElementNS(n.nodeName, n.namespaceURI))))
            : (h = n)
        else if (O === TEXT_NODE || O === COMMENT_NODE) {
          if (C === O) return h.nodeValue !== n.nodeValue && (h.nodeValue = n.nodeValue), h
          h = n
        }
      if (h === n) N(t)
      else {
        if (n.isSameNode && n.isSameNode(h)) return
        if ((A(h, n, f), s))
          for (var b = 0, g = s.length; b < g; b++) {
            var S = E[s[b]]
            S && T(S, S.parentNode, !1)
          }
      }
      return (
        !f &&
          h !== t &&
          t.parentNode &&
          (h.actualize && (h = h.actualize(t.ownerDocument || doc)), t.parentNode.replaceChild(h, t)),
        h
      )
    }
  }
  var morphdom = morphdomFactory(morphAttrs)
})

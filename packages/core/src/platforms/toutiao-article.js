// Keep all helpers inside the function: chrome.scripting serializes it into the target page.
export async function prepareToutiaoArticle(html, markdown = '') {
  if (typeof html !== 'string') throw new Error('头条正文必须是 HTML 字符串')
  if (!/<img(?=[\s/>])|katex-(inline|block)|mjx-container|MathJax_SVG/i.test(html))
    return { html, images: [] }

  // Template contents are inert. Parsing an article must not load its images or execute its scripts.
  const template = document.createElement('template')
  template.innerHTML = html
  const article = template.content
  const selector = '.katex-inline, .katex-block, mjx-container[jax="SVG" i], .MathJax_SVG'
  const formulas = Array.from(article.querySelectorAll(selector)).filter(
    node => node.querySelector('svg') && !node.parentElement?.closest(selector)
  )
  const candidates = Array.from(article.querySelectorAll(`img, ${selector}`)).filter(node =>
    node.matches('img') ? !formulas.includes(node.closest(selector)) : formulas.includes(node)
  )
  if (!candidates.length) return { html, images: [] }

  function isBlock(node) {
    return node.matches('.katex-block, [display="true"]') || !!node.closest('.MathJax_SVG_Display')
  }

  // Use Markdown as a hint only when the number and display mode match the rendered nodes.
  const withoutCode = String(markdown || '').replace(
    /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\2[ \t]*$|(`+)[^\n]*?\3/gm,
    ''
  )
  // Block delimiters normally sit on separate lines, including whitespace around the expression.
  const blocksAndInline = Array.from(
    withoutCode.matchAll(
      /(?<![\\$])(?:\$\$([\s\S]+?)(?<!\\)\$\$|\$(?![\s$])([^$\n]+?)(?<![\\\s])\$(?!\$))/g
    )
  )
  const matchedMarkdown =
    blocksAndInline.length === formulas.length &&
    formulas.every((node, i) => isBlock(node) === (blocksAndInline[i][1] !== undefined))

  const symbols = {
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    epsilon: 'ϵ',
    varepsilon: 'ε',
    theta: 'θ',
    lambda: 'λ',
    mu: 'μ',
    pi: 'π',
    rho: 'ρ',
    sigma: 'σ',
    phi: 'ϕ',
    varphi: 'φ',
    omega: 'ω',
    Gamma: 'Γ',
    Delta: 'Δ',
    Sigma: 'Σ',
    Omega: 'Ω',
    times: '×',
    cdot: '·',
    pm: '±',
    le: '≤',
    leq: '≤',
    ge: '≥',
    geq: '≥',
    ne: '≠',
    neq: '≠',
    approx: '≈',
    infty: '∞',
    to: '→',
    in: '∈',
  }
  function readableInline(source) {
    if (!source) return null
    const value = source
      .trim()
      .replace(/\\hat\{([A-Za-z])\}/g, (_, letter) => (letter + '\u0302').normalize('NFC'))
      .replace(/\\([A-Za-z]+)/g, (token, name) =>
        Object.hasOwn(symbols, name) ? symbols[name] : token
      )
      .replace(/([_^])(?:\{([0-9+\-=()]+)\}|([0-9]))/g, (_, operator, digits, digit) => {
        const alphabet = operator === '^' ? '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾' : '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎'
        return Array.from(digits || digit, ch => alphabet['0123456789+-=()'.indexOf(ch)]).join('')
      })
    return /^[\p{L}0-9\u0302¹²³⁰-₉., +\-−*/=()[\]|<>×·±≤≥≠≈∞→∈]+$/u.test(value) ? value : null
  }

  const ns = 'http://www.w3.org/2000/svg'
  const xlink = 'http://www.w3.org/1999/xlink'
  const elements = new Set(
    'svg g defs use path rect circle ellipse line polyline polygon text tspan clipPath'.split(' ')
  )
  const attributes = new Set(
    'id viewBox preserveAspectRatio d transform x y x1 y1 x2 y2 cx cy r rx ry width height points dx dy fill-rule clip-rule stroke-width stroke-linecap stroke-linejoin stroke-dasharray opacity fill-opacity stroke-opacity text-anchor font-size font-style font-weight vector-effect'.split(
      ' '
    )
  )
  const color =
    /^(?:#(?:[a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})|[A-Za-z]+|(?:rgb|hsl)a?\([\d\s.,%/+-]+\))$/i

  // MathJax SVG carries semantic groups even if the editor supplies no original Markdown.
  // Flatten only simple token sequences; fractions, accents and scripts need their layout.
  function renderedText(svg) {
    const math = svg.querySelector('[data-mml-node="math"]')
    if (
      math &&
      Array.from(math.querySelectorAll('[data-mml-node]')).every(node =>
        ['mrow', 'mi', 'mn', 'mo', 'mtext', 'TeXAtom'].includes(node.getAttribute('data-mml-node'))
      )
    ) {
      const glyphs = Array.from(math.querySelectorAll('[data-c], text'))
      if (
        glyphs.length &&
        !math.querySelector('path:not([data-c]),use:not([data-c]),line,rect,polygon,polyline')
      ) {
        const tokens = glyphs.map(node => {
          if (node.localName === 'text') return node.textContent
          const hex = node.getAttribute('data-c')
          const point = parseInt(hex, 16)
          if (!/^[0-9a-f]{1,6}$/i.test(hex) || point > 0x10ffff) return ''
          const character = String.fromCodePoint(point)
          // Ordinary math italics are presentation; keep semantic variants such as blackboard bold.
          return (point >= 0x1d434 && point <= 0x1d467) || (point >= 0x1d6e2 && point <= 0x1d71b)
            ? character.normalize('NFKC')
            : character
        })
        if (tokens.every(Boolean)) return tokens.join('')
      }
    }
    const text = svg.querySelectorAll('text')
    if (
      text.length === 1 &&
      !svg.querySelector('path,use,line,rect,circle,ellipse,polygon,polyline,tspan')
    ) {
      return text[0].textContent
    }
    return ''
  }

  function pixelLength(value) {
    const match = /^(\d+(?:\.\d+)?|\.\d+)(px|em|ex|pt)?$/.exec((value || '').trim())
    return match ? Number(match[1]) * ({ em: 16, ex: 8, pt: 4 / 3 }[match[2]] || 1) : 0
  }

  // Preserve article-local caches even if an earlier formula owns the definitions.
  const glyphCache = new Map(
    Array.from(article.querySelectorAll('svg defs [id]'), node => [node.id, node])
  )
  async function rasterize(original, wrapper) {
    const ids = new Set()
    const references = new Set()
    function copy(node) {
      if (!elements.has(node.localName) || node.namespaceURI !== ns) return null
      const result = document.createElementNS(ns, node.localName)
      for (const attr of node.attributes) {
        if (attributes.has(attr.name) && !/url\s*\(/i.test(attr.value)) {
          result.setAttribute(attr.name, attr.value)
        }
      }
      if (node.id) ids.add(node.id)
      for (const name of ['color', 'fill', 'stroke']) {
        const value = node.style.getPropertyValue(name) || node.getAttribute(name)
        if (value && color.test(value)) result.setAttribute(name, value)
      }
      if (node.localName === 'use') {
        const href = node.getAttribute('href') || node.getAttributeNS(xlink, 'href')
        if (!href || !/^#[\w.:-]+$/.test(href)) throw new Error('公式包含外部或缺失的字形引用')
        references.add(href.slice(1))
        result.setAttribute('href', href)
      }
      const clip = node.getAttribute('clip-path') || node.style.clipPath
      if (clip) {
        const local = /^url\(["']?#([\w.:-]+)["']?\)$/.exec(clip)
        if (!local) throw new Error('公式包含外部裁剪引用')
        references.add(local[1])
        result.setAttribute('clip-path', 'url(#' + local[1] + ')')
      }
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (['title', 'desc', 'metadata', 'style'].includes(child.localName)) continue
          const clean = copy(child)
          if (!clean) throw new Error('不支持的 SVG 元素 ' + child.localName)
          result.append(clean)
        } else if (child.nodeType === 3 && ['text', 'tspan'].includes(node.localName)) {
          result.append(child.textContent)
        }
      }
      return result
    }

    const svg = copy(original)
    const defs = document.createElementNS(ns, 'defs')
    for (const id of references) {
      if (ids.has(id)) continue
      // MathJax can place a glyph cache elsewhere in the same article.
      const cached = glyphCache.get(id) || article.getElementById(id)
      if (!cached || !['path', 'clipPath'].includes(cached.localName))
        throw new Error('缺少公式字形 ' + id)
      const glyph = copy(cached)
      if (!glyph) throw new Error('公式字形无效')
      defs.append(glyph)
    }
    if (defs.childNodes.length) svg.prepend(defs)
    const ink = original.style.color || wrapper.style.color || '#111'
    if (!svg.hasAttribute('color')) svg.setAttribute('color', color.test(ink) ? ink : '#111')
    const viewBox = (original.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number)
    const ratio =
      viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0 ? viewBox[2] / viewBox[3] : 0
    const widthHint = pixelLength(original.getAttribute('width') || original.style.width)
    const heightHint = pixelLength(original.getAttribute('height') || original.style.height)
    const height = heightHint || (ratio && widthHint ? widthHint / ratio : ratio ? 32 : 150)
    const width = widthHint || (ratio ? height * ratio : 300)
    const scale = Math.min(3, 2400 / width, 1000 / height)
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    if (!ratio) svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    )
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0, w, h)
      const pixels = ctx.getImageData(0, 0, w, h).data
      if (!pixels.some((value, i) => i % 4 === 3 && value)) throw new Error('公式图像为空')
      return canvas.toDataURL('image/png')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function insertMarker(node, marker) {
    const placeholder = document.createElement('p')
    placeholder.textContent = marker
    const paragraph = node.parentElement?.closest('p,h1,h2,h3,h4,h5,h6')
    if (!paragraph) {
      node.replaceWith(placeholder)
      return
    }
    // Split the paragraph around the image, retaining formatting and adjacent text.
    const range = paragraph.ownerDocument.createRange()
    range.selectNodeContents(paragraph)
    range.setEndBefore(node)
    const before = paragraph.cloneNode(false)
    before.removeAttribute('id')
    before.append(range.extractContents())
    node.remove()
    if (before.textContent.trim() || before.querySelector('img,svg,br')) paragraph.before(before)
    paragraph.before(placeholder)
    if (!paragraph.textContent.trim() && !paragraph.querySelector('img,svg,br')) paragraph.remove()
  }

  const images = []
  const batch = crypto.randomUUID()
  for (const [index, node] of candidates.entries()) {
    const marker = 'COSEIMAGE' + batch.replaceAll('-', '') + 'N' + index + 'END'
    if (node.matches('img')) {
      const src = (node.getAttribute('src') || '').trim()
      images.push({ marker, src: src.startsWith('//') ? 'https:' + src : src })
      insertMarker(node, marker)
      continue
    }

    const i = formulas.indexOf(node)
    const svg = node.querySelector('svg')
    const embedded =
      node.getAttribute('data-latex') ||
      node.getAttribute('data-tex') ||
      node.querySelector('annotation[encoding="application/x-tex"]')?.textContent
    const source = embedded || (matchedMarkdown ? blocksAndInline[i][2] : '')
    const text = isBlock(node) ? null : readableInline(source || renderedText(svg))
    if (text) {
      node.replaceWith(document.createTextNode(text))
      continue
    }
    try {
      const dataUrl = await rasterize(svg, node)
      images.push({ marker, dataUrl })
      insertMarker(node, marker)
    } catch (error) {
      throw new Error('第 ' + (i + 1) + ' 个头条公式转换失败：' + error.message)
    }
  }
  return { html: template.innerHTML, images }
}

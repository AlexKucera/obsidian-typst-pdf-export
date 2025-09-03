// Email block styling function
#let email-block(from: none, to: none, subject: none, date: none, body) = {
  block(
    width: 100%, 
    inset: 8pt, 
    fill: rgb("#f1f5f9"),
    stroke: 1pt + rgb("#cbd5e1"), 
    radius: 6pt,
    breakable: true
  )[
    #grid(
      columns: (auto, 1fr),
      row-gutter: 4pt,
      column-gutter: 12pt,
      if from != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#64748b"))[From:]
      ] else [],
      if from != none [
        #text(size: 0.9em, weight: "medium")[#from]
      ] else [],
      if to != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#64748b"))[To:]
      ] else [],
      if to != none [
        #text(size: 0.9em, weight: "medium")[#to]
      ] else [],
      if subject != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#64748b"))[Subject:]
      ] else [],
      if subject != none [
        #text(size: 0.9em, weight: "semibold")[#subject]
      ] else [],
      if date != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#64748b"))[Date:]
      ] else [],
      if date != none [
        #text(size: 0.9em)[#date]
      ] else [],
    )
    #if body != none [
      #v(6pt)
      #block(
        width: 100%,
        inset: (left: 8pt, top: 8pt, bottom: 4pt),
        stroke: (left: 3pt + rgb("#3b82f6")),
        fill: white,
        radius: (right: 4pt),
      )[
        #body
      ]
    ]
  ]
}

#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  region: "US", 
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  cols: 2,
  font: ("Concourse OT", "Georgia", "Times New Roman"),
  fontsize: 11pt,
  sectionnumbering: none,
  pagenumbering: "1",
  // Support for UI-configurable options
  heading_font: none,
  monospace_font: none,
  heading_fontsize: none,
  small_fontsize: none,
  margin_top: none,
  margin_right: none,
  margin_bottom: none,
  margin_left: none,
  orientation: "portrait",
  export_format: none,
  doc,
) = {
  // Set document properties
  set document(
    title: title
  )
  
  // Magazine-style layout with header
  // Use UI-configured margins if available, otherwise fall back to template defaults
  let page-margin = if margin_top != none {
    (
      top: if margin_top != none { margin_top } else { 2.5cm },
      right: if margin_right != none { margin_right } else { 2cm },
      bottom: if margin_bottom != none { margin_bottom } else { 2.5cm },
      left: if margin_left != none { margin_left } else { 2cm },
    )
  } else {
    margin
  }
  
  // Set page layout with conditional height based on export format
  set page(
    paper: paper,
    flipped: orientation == "landscape",
    margin: page-margin,
    ..if export_format == "single-page" and orientation == "landscape" { 
      (width: auto,) 
    } else if export_format == "single-page" { 
      (height: auto,) 
    } else { 
      (:) 
    },
    numbering: pagenumbering,
    header: context {
      if counter(page).get().first() > 1 [
        #line(length: 100%, stroke: 0.5pt + rgb("#2563eb"))
        #v(-0.5em)
        #grid(
          columns: (1fr, auto, 1fr),
          [], 
          text(9pt, fill: rgb("#2563eb"), style: "italic")[#title], 
          align(right)[#text(9pt)[#counter(page).display("1")]]
        )
        #v(0.5em)
        #line(length: 100%, stroke: 0.5pt + rgb("#2563eb"))
      ]
    }
  )
  
  // Mixed fonts - serif body, sans-serif headings
  // Use UI-configured font if available, otherwise use template default
  let body-font = if font != none and type(font) == str { 
    (font, "Concourse OT", "Georgia", "Times New Roman") 
  } else { 
    font 
  }
  
  let body-fontsize = fontsize
  
  set text(
    font: body-font,
    size: body-fontsize,
    lang: lang,
    region: region
  )
  
  // Magazine-style paragraphs
  set par(justify: false, leading: 0.7em, first-line-indent: 0.8em)
  
  // No heading numbering for magazine style
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Magazine-style heading styles
  // Use UI-configured heading font and size if available
  let heading-font = if heading_font != none and type(heading_font) == str { 
    (heading_font, "SF Pro Text", "Helvetica Neue", "Arial") 
  } else if heading_font != none { 
    heading_font 
  } else { 
    ("SF Pro Text", "Helvetica Neue", "Arial") 
  }
  
  let heading-fontsize = if heading_fontsize != none { heading_fontsize } else { 15pt }
  
  show heading.where(level: 1): it => block(
    width: 100%,
    below: 1.2em,
    above: 1.8em,
    fill: rgb("#f8fafc"),
    inset: 8pt,
    radius: 4pt,
    stroke: 1pt + rgb("#e2e8f0"),
  )[
    #set align(left)
    #set text(font: heading-font, size: heading-fontsize, weight: "bold", fill: rgb("#1e40af"))
    #block(
      width: 100%,
      inset: (bottom: 4pt),
      stroke: (bottom: 2pt + rgb("#3b82f6")),
    )[#it.body]
  ]

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 0.8em,
    above: 1.2em,
  )[
    #set text(font: heading-font, size: heading-fontsize * 0.87, weight: "semibold", fill: rgb("#1e40af"))
    #it.body #h(0.5em) #line(length: 3cm, stroke: 1pt + rgb("#93c5fd"))
  ]

  // Apply monospace font to code blocks and inline code
  let code-font = if monospace_font != none and type(monospace_font) == str {
    (monospace_font, "Courier New", "Monaco")
  } else {
    ("Courier New", "Monaco")
  }
  
  show raw: set text(font: code-font)

  // Decorative title block with background
  if title != none and title != "" [
    #block(
      width: 100%,
      fill: gradient.linear(rgb("#1e40af"), rgb("#3b82f6")),
      inset: 16pt,
      radius: 8pt,
    )[
      #align(center, text(22pt, weight: "bold", fill: white)[#title])
    ]
    #v(1.2em)
  ]

  // Authors in magazine style
  if authors != () and authors != none [
    #align(center, text(
      font: ("SF Pro Text", "Helvetica Neue", "Arial"), 
      13pt, 
      style: "italic",
      fill: rgb("#64748b")
    )[
      By #for author in authors [
        #if author.name != none and author.name != "" [#author.name]
      ]
    ])
    #v(0.6em)
  ]

  // Date with styling
  if date != none [
    #align(center, text(
      10pt, 
      style: "italic", 
      fill: rgb("#64748b")
    )[#date])
    #v(1.8em)
  ]

  // Two-column layout for content
  columns(cols, gutter: 1.2em)[#doc]
}
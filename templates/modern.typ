// Horizontal rule definition for Pandoc compatibility
#let horizontalrule = line(start: (25%,0%), end: (75%,0%))

// Email block styling function - compact for single page
#let email-block(from: none, to: none, subject: none, date: none, body) = {
  block(
    width: 100%, 
    inset: 8pt, 
    fill: white,
    stroke: 1pt + rgb("#e5e7eb"), 
    radius: 4pt,
    breakable: true
  )[
    #text(size: 0.8em, weight: "semibold", fill: rgb("#374151"))[Email]
    #v(0.2em)
    #grid(
      columns: (auto, 1fr),
      row-gutter: 2pt,
      column-gutter: 8pt,
      if from != none [
        #text(style: "italic", size: 0.8em, fill: rgb("#6b7280"))[From:]
      ] else [],
      if from != none [
        #text(size: 0.8em)[#from]
      ] else [],
      if to != none [
        #text(style: "italic", size: 0.8em, fill: rgb("#6b7280"))[To:]
      ] else [],
      if to != none [
        #text(size: 0.8em)[#to]
      ] else [],
      if subject != none [
        #text(style: "italic", size: 0.8em, fill: rgb("#6b7280"))[Subject:]
      ] else [],
      if subject != none [
        #text(size: 0.8em, weight: "medium")[#subject]
      ] else [],
    )
    #if body != none [
      #v(0.3em)
      #block(
        width: 100%,
        inset: 4pt,
        fill: rgb("#f8f9fa"),
        radius: 2pt,
      )[
        #text(size: 0.8em)[#body]
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
  margin: (x: 1.8cm, y: 1.5cm),
  cols: 1,
  font: ("Concourse OT", "Helvetica Neue", "Arial"),
  fontsize: 10pt,
  sectionnumbering: none,
  pagenumbering: none, // Single page doesn't need page numbers
  // Support for UI-configurable options
  heading_font: none,
  monospace_font: none,
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
  
  // Modern single page layout with auto height
  // Use UI-configured margins if available, otherwise fall back to template defaults
  let page-margin = if margin_top != none {
    (
      top: if margin_top != none { margin_top } else { 1.5cm },
      right: if margin_right != none { margin_right } else { 1.8cm },
      bottom: if margin_bottom != none { margin_bottom } else { 1.5cm },
      left: if margin_left != none { margin_left } else { 1.8cm },
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
    fill: rgb("#fafafa")
  )
  
  // Modern sans-serif fonts
  // Use UI-configured font if available, otherwise use template default
  let body-font = if font != none and type(font) == str { 
    (font, "Concourse OT", "Helvetica Neue", "Arial") 
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
  
  // Tight paragraph spacing for CV style
  set par(justify: false, leading: 0.5em)
  
  // No section numbering for modern look
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Modern heading styles with color accents
  // Use UI-configured heading font and size if available
  let heading-font = if heading_font != none and type(heading_font) == str { 
    (heading_font, "SF Pro Text", "Helvetica Neue", "Arial") 
  } else if heading_font != none { 
    heading_font 
  } else { 
    ("SF Pro Text", "Helvetica Neue", "Arial") 
  }
  
  let heading-fontsize = body-fontsize * 1.4
  
  show heading.where(level: 1): it => block(
    width: 100%,
    below: 1em,
    above: 1.2em,
    fill: rgb("#0d9488"),
    inset: (x: 12pt, y: 8pt),
    radius: 6pt,
  )[
    #set text(font: heading-font, size: heading-fontsize, weight: "bold", fill: white)
    #upper[#it.body]
  ]

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 0.6em,
    above: 1em,
    inset: (bottom: 3pt),
    stroke: (bottom: 2pt + rgb("#0d9488")),
  )[
    #set text(font: heading-font, size: heading-fontsize * 0.85, weight: "semibold", fill: rgb("#0f766e"))
    #it.body
  ]

  show heading.where(level: 3): it => block(
    width: 100%,
    below: 0.4em,
    above: 0.8em,
  )[
    #set text(size: 10pt, weight: "medium", fill: rgb("#374151"))
    #it.body
  ]

  // Apply monospace font to code blocks and inline code
  let code-font = if monospace_font != none and type(monospace_font) == str {
    (monospace_font, "Courier New", "Monaco")
  } else {
    ("Courier New", "Monaco")
  }
  
  show raw: set text(font: code-font)

  // Modern title header with sidebar design
  if title != none and title != "" [
    #block(
      width: 100%,
      fill: gradient.linear(rgb("#0f766e"), rgb("#14b8a6"), angle: 45deg),
      inset: 16pt,
      radius: (top: 8pt),
    )[
      #grid(
        columns: (2fr, 1fr),
        column-gutter: 16pt,
        // Main title area
        [
          #text(24pt, weight: "bold", fill: white)[#title]
          #if authors != () and authors != none [
            #v(0.3em)
            #for author in authors [
              #if author.name != none and author.name != "" [
                #text(14pt, fill: rgb("#ccfbf1"))[#author.name]
              ]
            ]
          ]
        ],
        // Contact info sidebar
        align(right + top)[
          #if date != none [
            #text(11pt, fill: rgb("#ccfbf1"), style: "italic")[#date]
          ]
        ]
      )
    ]
    #v(1em)
  ] else [
    // If no title, still show authors and date in a header
    #if authors != () and authors != none or date != none [
      #block(
        width: 100%,
        fill: rgb("#f1f5f9"),
        inset: 12pt,
        radius: 6pt,
        stroke: 1pt + rgb("#e2e8f0"),
      )[
        #grid(
          columns: (1fr, auto),
          if authors != () and authors != none [
            #for author in authors [
              #if author.name != none and author.name != "" [
                #text(14pt, weight: "semibold", fill: rgb("#0f766e"))[#author.name]
              ]
            ]
          ] else [],
          if date != none [
            #text(10pt, style: "italic", fill: rgb("#64748b"))[#date]
          ] else []
        )
      ]
      #v(1em)
    ]
  ]

  // Document content in a clean container
  block(
    width: 100%,
    fill: white,
    inset: 16pt,
    radius: (bottom: 8pt),
    stroke: 1pt + rgb("#e5e7eb"),
  )[
    #doc
  ]
}
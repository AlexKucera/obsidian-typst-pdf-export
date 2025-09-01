// Email block styling function
#let email-block(from: none, to: none, subject: none, date: none, body) = {
  block(
    width: 100%, 
    inset: 6pt, 
    stroke: 1pt + gray, 
    radius: 5pt,
    breakable: true
  )[
    #grid(
      columns: (auto, 1fr),
      row-gutter: 3pt,
      column-gutter: 8pt,
      if from != none [
        #text(style: "italic", size: 0.9em)[From:]
      ] else [],
      if from != none [
        #text(size: 0.9em)[#from]
      ] else [],
      if to != none [
        #text(style: "italic", size: 0.9em)[To:]
      ] else [],
      if to != none [
        #text(size: 0.9em)[#to]
      ] else [],
      if subject != none [
        #text(style: "italic", size: 0.9em)[Subject:]
      ] else [],
      if subject != none [
        #text(size: 0.9em)[#subject]
      ] else [],
      if date != none [
        #text(style: "italic", size: 0.9em)[Date:]
      ] else [],
      if date != none [
        #text(size: 0.9em)[#date]
      ] else [],
    )
    #if body != none [
      #block(
        width: 100%,
        inset: (left: 5pt, top: 6pt),
        stroke: (left: 2pt + gray),
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
  margin: (x: 1.5cm, y: 1.5cm),
  cols: 1,
  font: ("Afraty Stencil", "Concourse OT 3", "Helvetica Neue", "Arial", "sans-serif"),
  fontsize: 11pt,
  sectionnumbering: "1.",
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
    // Skip author in document metadata to avoid type issues
  )
  
  // Set page layout - Clean minimal style
  // Use UI-configured margins if available, otherwise fall back to template defaults
  let page-margin = if margin_top != none {
    (
      top: if margin_top != none { margin_top } else { 1.5cm },
      right: if margin_right != none { margin_right } else { 1.5cm },
      bottom: if margin_bottom != none { margin_bottom } else { 1.5cm },
      left: if margin_left != none { margin_left } else { 1.5cm },
    )
  } else {
    margin
  }
  
  
  // Set page layout with conditional height based on export format
  set page(
    paper: paper,
    margin: page-margin,
    ..if export_format == "single-page" { (height: auto,) } else { (:) },
    numbering: pagenumbering,
    header: context {
      if counter(page).get().first() > 1 [
        #h(1fr) #counter(page).display("1")
      ]
    }
  )
  
  // Set text properties - Sans-serif for clean look
  // Use UI-configured font if available, otherwise use template default
  let body-font = if font != none and type(font) == str { 
    (font, "Afraty Stencil", "Concourse OT 3", "Helvetica Neue", "Arial", "sans-serif") 
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
  
  // Set paragraph properties - Clean spacing
  set par(justify: true, leading: 0.6em)
  
  // Set heading numbering
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Clean heading styles
  // Use UI-configured heading font and size if available
  let heading-font = if heading_font != none and type(heading_font) == str { 
    (heading_font, "SF Pro Text", "Helvetica Neue", "Arial", "sans-serif") 
  } else if heading_font != none { 
    heading_font 
  } else { 
    ("SF Pro Text", "Helvetica Neue", "Arial", "sans-serif") 
  }
  
  let heading-fontsize = if heading_fontsize != none { heading_fontsize } else { 14pt }
  
  show heading.where(level: 1): it => block(
    width: 100%,
    below: 1em,
    above: 1.5em,
  )[
    #set text(font: heading-font, size: heading-fontsize, weight: "bold")
    #it
  ]

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 0.8em,
    above: 1.2em,
  )[
    #set text(font: heading-font, size: heading-fontsize * 0.85, weight: "semibold")
    #it
  ]


  // Title block - Clean and minimal
  if title != none and title != "" [
    #align(center, text(16pt, weight: "bold")[#title])
    #v(0.8em)
  ]

  // Authors - Simple layout
  if authors != () and authors != none [
    #align(center, text(11pt)[
      #for author in authors [
        #if author.name != none and author.name != "" [#author.name]
      ]
    ])
    #v(0.4em)
  ]

  // Date - Understated
  if date != none [
    #align(center, text(10pt, style: "italic")[#date])
    #v(1.5em)
  ]

  // Document content
  doc
}
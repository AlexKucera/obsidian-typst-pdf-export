// Horizontal rule definition for Pandoc compatibility
#let horizontalrule = pad(y: 11pt, (line(stroke: 2pt + gray, length: 75%)))

// Email block styling function
#let email-block(from: none, to: none, subject: none, date: none, body) = {
  block(
    width: 100%, 
    inset: 16pt, 
    stroke: 0.5pt + blue, 
    radius: 5pt,
    breakable: true
  )[
    #grid(
      columns: (auto, 1fr),
      row-gutter: 13pt,
      column-gutter: 8pt,
      if from != none [
        #text(style: "italic", size: 1em)[From:]
      ] else [],
      if from != none [
        #text(size: 1em)[#from]
      ] else [],
      if to != none [
        #text(style: "italic", size: 1em)[To:]
      ] else [],
      if to != none [
        #text(size: 1em)[#to]
      ] else [],
      if subject != none [
        #text(style: "italic", size: 1em)[Subject:]
      ] else [],
      if subject != none [
        #text(size: 1em)[#subject]
      ] else [],
      if date != none [
        #text(style: "italic", size: 1em)[Date:]
      ] else [],
      if date != none [
        #text(size: 1em)[#date]
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
  margin: (x: 2.5cm, y: 2cm),
  cols: 2,
  font: ("Libertinus Serif", "Times New Roman", "Times"),
  fontsize: 10pt,
  sectionnumbering: "1.",
  pagenumbering: "1",
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
    // Skip author in document metadata to avoid type issues
  )
  
  // Use UI-configured margins if available, otherwise fall back to template defaults
  let page-margin = if margin_top != none {
    (
      top: if margin_top != none { margin_top } else { 2cm },
      right: if margin_right != none { margin_right } else { 2.5cm },
      bottom: if margin_bottom != none { margin_bottom } else { 2cm },
      left: if margin_left != none { margin_left } else { 2.5cm },
    )
  } else {
    margin
  }
  
  // globally set the gutter between page columns
  set columns(gutter: 4% + 11pt)

  // Single-column page layout
  // Two-column page layout with configurable orientation
  set page(
    paper: paper,
    flipped: orientation == "landscape",
    margin: page-margin,
    columns: 2,
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
        #h(1fr) #counter(page).display("1")
      ]
    }
  )
  
  // Academic typography - serif font with good readability
  let body-font = if font != none and type(font) == str { 
    (font, "Libertinus Serif", "Times New Roman", "Times") 
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
  
  // Justified paragraphs with proper spacing for columns
  set par(justify: true, leading: 0.65em, spacing: 0.65em)
  
  // Set heading numbering
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Academic heading styles
  let heading-font = if heading_font != none and type(heading_font) == str { 
    (heading_font, "Libertinus Serif", "Times New Roman", "Times") 
  } else if heading_font != none { 
    heading_font 
  } else { 
    ("Libertinus Serif", "Times New Roman", "Times") 
  }
  
  let heading-fontsize = body-fontsize * 1.3
  
  show heading.where(level: 1): it => {
    // Level 1 headings span both columns and create section breaks
    place(
      top + left,
      scope: "parent",
      float: true,
      clearance: 1em,
      block(
        width: 100%,
        below: 1.2em,
        above: 1.5em,
        breakable: false,
      )[
        #set text(font: heading-font, size: heading-fontsize * 1.2, weight: "bold")
        #set align(left)
        #it
        #v(0.3em)
        #line(length: 100%, stroke: 1pt + gray)
      ]
    )
  }

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 0.8em,
    above: 1em,
  )[
    #set text(font: heading-font, size: heading-fontsize, weight: "bold")
    #it
  ]

  show heading.where(level: 3): it => block(
    width: 100%,
    below: 0.6em,
    above: 0.8em,
  )[
    #set text(font: heading-font, size: heading-fontsize * 0.9, weight: "semibold", style: "italic")
    #it
  ]

  // Code styling with monospace font
  let code-font = if monospace_font != none and type(monospace_font) == str {
    (monospace_font, "Courier New", "Monaco", "Menlo")
  } else {
    ("Courier New", "Monaco", "Menlo")
  }
  
  show raw: set text(font: code-font, size: body-fontsize * 0.9)
  
  // Code blocks with background
  show raw.where(block: true): block.with(
    width: 100%,
    fill: luma(250),
    inset: 8pt,
    radius: 3pt,
    breakable: true,
  )

  // Full-width title and author section spanning both columns
  if title != none and title != "" [
    #place(
      top + center,
      scope: "parent",
      float: true,
      clearance: 2em,
      block(
        width: 100%,
        breakable: false,
      )[
        #set align(center)
        #text(18pt, weight: "bold", font: heading-font)[#title]
        
        #if authors != () and authors != none [
          #v(0.8em)
          #for (i, author) in authors.enumerate() [
            #if author.name != none and author.name != "" [
              #text(12pt, style: "italic")[#author.name]
              #if i < authors.len() - 1 [, ]
            ]
          ]
        ]
        
        #if date != none [
          #v(0.5em)
          #text(10pt, style: "italic")[#date]
        ]
        
        #v(1.5em)
        #line(length: 60%, stroke: 0.5pt + gray)
      ]
    )
  ] else [
    // If no title, still show authors and date in header if present
    #if authors != () and authors != none or date != none [
      #place(
        top + center,
        scope: "parent", 
        float: true,
        clearance: 1em,
        block(width: 100%)[
          #set align(center)
          #if authors != () and authors != none [
            #for (i, author) in authors.enumerate() [
              #if author.name != none and author.name != "" [
                #text(12pt, weight: "semibold")[#author.name]
                #if i < authors.len() - 1 [, ]
              ]
            ]
          ]
          #if date != none [
            #v(0.3em)
            #text(10pt, style: "italic")[#date]
          ]
          #v(1em)
          #line(length: 40%, stroke: 0.5pt + gray)
        ]
      )
    ]
  ]

  // Enhanced figure styling for two-column layout
  show figure: it => {
    block(
      width: 100%,
      breakable: false,
    )[
      #set align(center)
      #it.body
      #if it.caption != none [
        #v(0.5em)
        #text(size: body-fontsize * 0.9, style: "italic")[
          Figure #counter(figure).display("1"): #it.caption
        ]
      ]
    ]
  }

  // Footnote styling for columns
  show footnote.entry: it => {
    block(
      width: 100%,
      inset: (top: 0.3em),
    )[
      #text(size: body-fontsize * 0.8)[
        #super[#it.note.counter.display("1")] #it.note.body
      ]
    ]
  }

  // Document content
  doc
}
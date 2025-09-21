// Horizontal rule definition for Pandoc compatibility
#let horizontalrule = pad(y: 11pt, (line(stroke: 2pt + gray, length: 75%)))

// Email block styling function with modern sidebar-appropriate styling
#let email-block(from: none, to: none, subject: none, date: none, body) = {
  block(
    width: 100%, 
    inset: 14pt, 
    fill: rgb("#f8fafc"),
    stroke: 1pt + rgb("#e2e8f0"), 
    radius: 8pt,
    breakable: true
  )[
    #text(size: 0.9em, weight: "semibold", fill: rgb("#475569"))[Email]
    #v(0.3em)
    #grid(
      columns: (auto, 1fr),
      row-gutter: 6pt,
      column-gutter: 12pt,
      if from != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#64748b"))[From:]
      ] else [],
      if from != none [
        #text(size: 0.9em, fill: rgb("#1e293b"))[#from]
      ] else [],
      if to != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#64748b"))[To:]
      ] else [],
      if to != none [
        #text(size: 0.9em, fill: rgb("#1e293b"))[#to]
      ] else [],
      if subject != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#64748b"))[Subject:]
      ] else [],
      if subject != none [
        #text(size: 0.9em, weight: "medium", fill: rgb("#0f172a"))[#subject]
      ] else [],
    )
    #if body != none [
      #v(0.5em)
      #block(
        width: 100%,
        inset: 8pt,
        fill: rgb("#ffffff"),
        radius: 4pt,
        stroke: 0.5pt + rgb("#e2e8f0"),
      )[
        #text(size: 0.85em, fill: rgb("#374151"))[#body]
      ]
    ]
  ]
}

// Sidebar navigation component
#let sidebar-nav(title: none, authors: (), date: none, body-fontsize: 11pt, pagenumbering: "1") = {
  let sidebar-bg = gradient.linear(
    rgb("#dc2626"), 
    rgb("#ea580c"), 
    rgb("#f97316"), 
    angle: 160deg
  )
  
  place(
    top + left,
    dx: 0pt,
    dy: 0pt,
    block(
      width: 4.5cm,
      height: 27cm,
      fill: sidebar-bg,
      inset: 18pt,
      radius: (right: 12pt),
    )[
      #set text(fill: white, size: body-fontsize * 0.9)
      
      // Document title in sidebar
      #if title != none and title != "" [
        #text(15pt, weight: "bold", tracking: 0.5pt)[#upper(title)]
        #v(1.2em)
        #line(length: 100%, stroke: 1.5pt + rgb("#dbeafe"))
        #v(1.2em)
      ]
      
      // Author information in sidebar
      #if authors != () and authors != none [
        #text(9pt, weight: "medium", fill: rgb("#dbeafe"), tracking: 1pt)[AUTHORS]
        #v(0.5em)
        #for (i, author) in authors.enumerate() [
          #if author.name != none and author.name != "" [
            #text(10pt, weight: "regular")[#author.name]
            #if i < authors.len() - 1 [#v(0.3em)]
          ]
        ]
        #v(1.5em)
      ]
      
      // Date in sidebar
      #if date != none [
        #text(9pt, weight: "medium", fill: rgb("#dbeafe"), tracking: 1pt)[DATE]
        #v(0.5em)
        #text(10pt)[#date]
        #v(1.5em)
      ]
      
      // Enhanced Table of contents in sidebar
      #text(9pt, weight: "medium", fill: rgb("#dbeafe"), tracking: 1pt)[CONTENTS]
      #v(0.7em)
      
      #context {
        let headings-1 = query(heading.where(level: 1))
        let headings-2 = query(heading.where(level: 2))
        
        for h1 in headings-1 {
          block(
            width: 100%,
            inset: (y: 0.2em),
            fill: rgb(255, 255, 255, 10%),
            radius: 3pt
          )[
            #text(9pt, weight: "semibold")[#h1.body]
          ]
          
          // Show level 2 headings under this level 1
          for h2 in headings-2 {
            if h2.location().page() >= h1.location().page() {
              text(8pt, fill: rgb("#dbeafe"))[  • #h2.body]
              v(0.15em)
            }
          }
          v(0.4em)
        }
      }
      
      #v(1fr)
      
      // Progress indicator
      #context {
        let current-page = counter(page).get().first()
        let total-pages = counter(page).final().first()
        let progress = current-page / total-pages * 100
        
        text(8pt, fill: rgb("#dbeafe"))[Progress]
        v(0.3em)
        block(
          width: 100%,
          height: 4pt,
          fill: rgb(255, 255, 255, 20%),
          radius: 2pt
        )[
          #place(
            left,
            block(
              width: progress * 1%,
              height: 100%,
              fill: rgb("#fbbf24"),
              radius: 2pt
            )
          )
        ]
        v(0.5em)
      }
      
      // Page number at bottom of sidebar
      #if pagenumbering != none [
        #line(length: 100%, stroke: 1pt + rgb("#dbeafe"))
        #v(0.7em)
        #set align(center)
        #context {
          let current = counter(page).get().first()
          let total = counter(page).final().first()
          text(13pt, weight: "bold")[#current]
          v(0.2em)
          text(8pt, fill: rgb("#dbeafe"))[of #total]
        }
      ]
    ]
  )
}

#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  region: "US", 
  paper: "a4",
  margin: (left: 8cm, right: 1.5cm, top: 1.5cm, bottom: 1.5cm),
  cols: 1,
  font: ("Inter", "SF Pro", "Helvetica Neue", "Arial"),
  fontsize: 11pt,
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
  )
  
  // Sidebar layout with fixed left margin for floating sidebar
  let page-margin = (
    top: if margin_top != none { margin_top } else { 1.5cm },
    right: if margin_right != none { margin_right } else { 1.5cm },
    bottom: if margin_bottom != none { margin_bottom } else { 1.5cm },
    left: 5cm, // Fixed for sidebar - not configurable
  )
  
  // Page layout optimized for sidebar
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
    background: {
      // Add the floating sidebar
      sidebar-nav(
        title: title, 
        authors: authors, 
        date: date, 
        body-fontsize: fontsize,
        pagenumbering: pagenumbering
      )
    }
  )
  
  // Modern sans-serif typography
  let body-font = if font != none and type(font) == str { 
    (font, "Inter", "SF Pro", "Helvetica Neue", "Arial") 
  } else { 
    font 
  }
  
  let body-fontsize = fontsize
  
  set text(
    font: body-font,
    size: body-fontsize,
    lang: lang,
    region: region,
    fill: rgb("#111827")
  )
  
  // Clean paragraph settings
  set par(justify: true, leading: 0.65em, spacing: 0.8em)
  
  // Set heading numbering
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Modern heading fonts
  let heading-font = if heading_font != none and type(heading_font) == str { 
    (heading_font, "Inter", "SF Pro", "Helvetica Neue", "Arial") 
  } else if heading_font != none { 
    heading_font 
  } else { 
    ("Inter", "SF Pro", "Helvetica Neue", "Arial") 
  }
  
  let heading-fontsize = body-fontsize * 1.3
  
  // Color palette coordinated with orange-red sidebar
  let primary-color = rgb("#dc2626")
  let secondary-color = rgb("#ea580c") 
  let accent-color = rgb("#f97316")
  let text-color = rgb("#374151")
  
  show heading.where(level: 1): it => block(
    width: 100%,
    below: 1.4em,
    above: 2em,
    breakable: false,
  )[
    #set text(font: heading-font, size: heading-fontsize * 1.2, weight: "bold", fill: primary-color)
    #it
    #v(0.5em)
    #line(length: 100%, stroke: 2pt + gradient.linear(primary-color, secondary-color))
  ]

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 1em,
    above: 1.6em,
    inset: (left: 0pt, bottom: 8pt),
  )[
    #set text(font: heading-font, size: heading-fontsize, weight: "semibold", fill: text-color)
    #it
    #v(0.3em)
    #line(length: 40%, stroke: 1pt + primary-color)
  ]

  show heading.where(level: 3): it => block(
    width: 100%,
    below: 0.8em,
    above: 1.2em,
  )[
    #set text(font: heading-font, size: heading-fontsize * 0.85, weight: "medium", fill: accent-color)
    #it
  ]

  // Enhanced code styling
  let code-font = if monospace_font != none and type(monospace_font) == str {
    (monospace_font, "SF Mono", "JetBrains Mono", "Courier New")
  } else {
    ("SF Mono", "JetBrains Mono", "Courier New")
  }
  
  show raw: set text(font: code-font, size: body-fontsize * 0.9, fill: rgb("#374151"))
  
  show raw.where(block: true): block.with(
    width: 100%,
    fill: rgb("#f8fafc"),
    stroke: 1pt + rgb("#e2e8f0"),
    inset: 14pt,
    radius: 6pt,
    breakable: true,
  )

  // Enhanced list styling
  set list(indent: 1em, body-indent: 0.5em)
  show list: it => {
    set text(fill: rgb("#374151"))
    it
  }

  // Enhanced quote styling
  show quote: it => block(
    width: 100%,
    fill: rgb("#f1f5f9"),
    inset: (left: 16pt, right: 16pt, top: 12pt, bottom: 12pt),
    stroke: (left: 4pt + accent-color),
    radius: (right: 6pt),
  )[
    #set text(style: "italic", fill: rgb("#4b5563"))
    #it
  ]

  // Figure styling
  show figure: it => block(
    width: 100%,
    breakable: false,
  )[
    #set align(center)
    #it.body
    #if it.caption != none [
      #v(0.7em)
      #text(
        size: body-fontsize * 0.9, 
        style: "italic",
        fill: rgb("#6b7280")
      )[
        Figure #counter(figure).display("1"): #it.caption
      ]
    ]
  ]

  // Don't show title/authors in main content since they're in sidebar
  // Just start with the document content
  doc
}
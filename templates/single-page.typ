#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  region: "US", 
  paper: "a4",
  margin: (x: 2.5cm, y: 2cm),
  cols: 1,
  font: ("Times New Roman"),
  fontsize: 12pt,
  sectionnumbering: "1.",
  pagenumbering: none, // Single page doesn't need page numbers
  doc,
) = {
  // Set document properties
  set document(
    title: title
    // Skip author in document metadata to avoid type issues
  )
  
  // Set page layout - single page with auto height
  set page(
    paper: paper,
    margin: margin,
    height: auto,
    numbering: pagenumbering
  )
  
  // Set text properties
  set text(
    font: font,
    size: fontsize,
    lang: lang,
    region: region
  )
  
  // Set paragraph properties
  set par(justify: true, leading: 0.65em)
  
  // Set heading numbering
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Custom heading styles for single page
  show heading.where(level: 1): it => block(
    width: 100%,
    below: 1.5em,
    above: 1.5em,
  )[
    #set text(16pt, weight: "bold")
    #it
  ]

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 1em,
    above: 1em,
  )[
    #set text(14pt, weight: "bold")
    #it
  ]

  // Title block (inline, not separate page)
  if title != none and title != "" [
    #align(center, text(18pt, weight: "bold")[#title])
    #v(1em)
  ]

  if authors != () and authors != none [
    #align(center, text(14pt)[
      #for author in authors [
        #if author.name != none and author.name != "" [#author.name]
      ]
    ])
    #v(0.5em)
  ]

  if date != none [
    #align(center, text(12pt)[#date])
    #v(2em)
  ]

  // Document content
  doc
}
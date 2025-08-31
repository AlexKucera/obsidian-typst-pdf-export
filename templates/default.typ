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
  pagenumbering: "1",
  doc,
) = {
  // Set document properties
  set document(
    title: title
    // Skip author in document metadata to avoid type issues
  )
  
  // Set page layout
  set page(
    paper: paper,
    margin: margin,
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

  // Title block
  if title != none and title != "" [
    #align(center, text(18pt, weight: "bold")[#title])
    #v(1em)
  ]

  // Authors (handle Pandoc author structure)
  if authors != () and authors != none [
    #align(center, text(14pt)[
      #for author in authors [
        #if author.name != none and author.name != "" [#author.name]
      ]
    ])
    #v(0.5em)
  ]

  // Date
  if date != none [
    #align(center, text(12pt)[#date])
    #v(2em)
  ]

  // Document content
  doc
}
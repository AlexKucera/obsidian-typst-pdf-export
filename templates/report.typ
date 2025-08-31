#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  region: "US", 
  paper: "a4",
  margin: (x: 2.5cm, y: 2.5cm),
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
  
  // Set page layout with header
  set page(
    paper: paper,
    margin: margin,
    numbering: pagenumbering,
    header: context {
      if counter(page).get().first() > 1 [
        #align(right, title)
        #line(length: 100%)
      ]
    }
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

  // Custom heading styles
  show heading.where(level: 1): it => pagebreak(weak: true) + block(
    width: 100%,
    below: 2em,
    above: 0pt,
  )[
    #set align(center)
    #set text(18pt, weight: "bold")
    #counter(heading).display()
    #h(0.5em)
    #it.body
  ]

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 1em,
    above: 1.5em,
  )[
    #set text(14pt, weight: "bold")
    #it
  ]

  // Title page
  if title != none and title != "" [
    page()[
      #align(center + horizon)[
        #text(24pt, weight: "bold")[#title]
        #v(2em)
        
        #if authors != () and authors != none [
          #text(16pt)[
            #for author in authors [
              #if author.name != none and author.name != "" [#author.name]
            ]
          ]
          #v(1em)
        ]
        
        #if date != none [
          #text(14pt)[#date]
        ]
      ]
    ]
  ]

  // Document content
  doc
}
// Horizontal rule definition for Pandoc compatibility
#let horizontalrule = pad(y: 11pt, (line(stroke: 2pt + gray, length: 75%)))

// Email block styling function - elegant book style
#let email-block(from: none, to: none, subject: none, date: none, body) = {
  block(
    width: 100%, 
    inset: 18pt, 
    fill: rgb("#fafaf9"),
    stroke: 1pt + rgb("#d6d3d1"), 
    radius: 0pt, // Square corners for book style
    breakable: true
  )[
    #text(size: 1em, weight: "medium", style: "italic", fill: rgb("#57534e"))[Correspondence]
    #v(0.4em)
    #grid(
      columns: (auto, 1fr),
      row-gutter: 8pt,
      column-gutter: 16pt,
      if from != none [
        #text(size: 0.9em, fill: rgb("#78716c"))[From:]
      ] else [],
      if from != none [
        #text(size: 0.9em)[#from]
      ] else [],
      if to != none [
        #text(size: 0.9em, fill: rgb("#78716c"))[To:]
      ] else [],
      if to != none [
        #text(size: 0.9em)[#to]
      ] else [],
      if subject != none [
        #text(size: 0.9em, fill: rgb("#78716c"))[Subject:]
      ] else [],
      if subject != none [
        #text(size: 0.9em, style: "italic")[#subject]
      ] else [],
      if date != none [
        #text(size: 0.9em, fill: rgb("#78716c"))[Date:]
      ] else [],
      if date != none [
        #text(size: 0.9em)[#date]
      ] else [],
    )
    #if body != none [
      #v(0.6em)
      #line(length: 100%, stroke: 0.5pt + rgb("#d6d3d1"))
      #v(0.6em)
      #block(
        width: 100%,
        inset: 0pt,
      )[
        #text(size: 0.9em)[#body]
      ]
    ]
  ]
}

// Drop cap function for chapter openings
#let drop-cap(text-content) = {
  if type(text-content) != str {
    text-content
  } else {
    let first-letter = text-content.slice(0, 1)
    let rest = text-content.slice(1)
    
    block(
      width: 100%,
      inset: 0pt,
    )[
      #grid(
        columns: (auto, 1fr),
        column-gutter: 8pt,
        align: (left + top, left + top),
        // Large decorative first letter
        text(
          size: 48pt, 
          weight: "bold",
          font: ("Baskerville", "Times New Roman"),
          fill: rgb("#7c2d12")
        )[#first-letter],
        // Rest of the paragraph
        text(size: 11pt)[#rest]
      )
    ]
  }
}

// Decorative section divider
#let section-divider = {
  v(1em)
  align(center)[
    #text(20pt, fill: rgb("#a8a29e"))[❦ ❦ ❦]
  ]
  v(1em)
}

#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  region: "US", 
  paper: "a4",
  margin: (inside: 3cm, outside: 2.5cm, top: 2.5cm, bottom: 2.5cm),
  cols: 1,
  font: ("Baskerville", "Times New Roman", "Times"),
  fontsize: 11pt,
  sectionnumbering: none, // Chapters typically don't use numbered sections
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
  
  // Book-style alternating margins for binding
  let page-margin = if margin_top != none {
    (
      top: if margin_top != none { margin_top } else { 2.5cm },
      right: if margin_right != none { margin_right } else { 2.5cm },
      bottom: if margin_bottom != none { margin_bottom } else { 2.5cm },
      left: if margin_left != none { margin_left } else { 3cm },
    )
  } else {
    margin
  }
  
  // Book page layout with alternating margins
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
    // Running headers for book style
    header: context {
      let page-num = counter(page).get().first()
      if page-num > 1 [
        #set text(size: 9pt, style: "italic", fill: rgb("#6b7280"))
        #if calc.even(page-num) [
          // Even pages: book title on left
          #if title != none [#title] else [Document]
          #h(1fr)
          #page-num
        ] else [
          // Odd pages: chapter title on right
          #page-num
          #h(1fr)
          #context {
            let headings = query(heading.where(level: 1))
            if headings.len() > 0 [
              #headings.last().body
            ] else [
              Chapter
            ]
          }
        ]
        #v(-0.5em)
        #line(length: 100%, stroke: 0.5pt + rgb("#d1d5db"))
      ]
    }
  )
  
  // Classic book typography - serif fonts
  let body-font = if font != none and type(font) == str { 
    (font, "Baskerville", "Times New Roman", "Times") 
  } else if font != none { 
    font 
  } else {
    ("Baskerville", "Times New Roman", "Times")
  }
  
  let body-fontsize = fontsize
  
  set text(
    font: body-font,
    size: body-fontsize,
    lang: lang,
    region: region,
    fill: rgb("#1f2937")
  )
  
  // Book-style paragraph settings with first-line indent
  set par(
    justify: true, 
    leading: 0.65em, 
    spacing: 0.65em,
    first-line-indent: 1.2em
  )
  
  // Chapter and section numbering
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Book-style heading fonts (same as body for classic look)
  let heading-font = if heading_font != none and type(heading_font) == str { 
    (heading_font, "Baskerville", "Times New Roman", "Times") 
  } else if heading_font != none { 
    heading_font 
  } else { 
    ("Baskerville", "Times New Roman", "Times") 
  }
  
  // Chapter styling (Level 1 headings)
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    v(3cm)
    block(
      width: 100%,
      above: 0em,
      below: 2em,
    )[
      #set align(center)
      #set par(first-line-indent: 0em)
      
      // Chapter number (if numbered)
      #if it.numbering != none [
        #text(
          size: 14pt, 
          weight: "regular", 
          font: heading-font,
          fill: rgb("#6b7280"),
          tracking: 2pt
        )[CHAPTER #counter(heading).display("I")]
        #v(1em)
      ]
      
      // Chapter title
      #text(
        size: 24pt, 
        weight: "bold",
        font: heading-font,
        fill: rgb("#111827")
      )[#it.body]
      
      #v(1.5em)
      
      // Decorative flourish
      #text(16pt, fill: rgb("#9ca3af"))[❦]
      
      #v(2em)
    ]
    
    // Reset paragraph indentation for first paragraph after chapter
    par(first-line-indent: 0em)[]
  }

  // Section styling (Level 2 headings)
  show heading.where(level: 2): it => {
    v(1.5em)
    block(
      width: 100%,
      below: 1em,
    )[
      #set align(center)
      #set par(first-line-indent: 0em)
      #text(
        size: 16pt, 
        weight: "semibold",
        font: heading-font,
        fill: rgb("#374151")
      )[#it.body]
      #v(0.5em)
      #line(length: 30%, stroke: 1pt + rgb("#9ca3af"))
    ]
  }

  // Subsection styling (Level 3 headings)
  show heading.where(level: 3): it => block(
    width: 100%,
    below: 0.8em,
    above: 1.2em,
  )[
    #set par(first-line-indent: 0em)
    #text(
      size: 13pt, 
      weight: "medium",
      font: heading-font,
      fill: rgb("#4b5563"),
      style: "italic"
    )[#it.body]
  ]

  // Code styling (rare in books but sometimes needed)
  let code-font = if monospace_font != none and type(monospace_font) == str {
    (monospace_font, "Courier New", "Monaco")
  } else {
    ("Courier New", "Monaco")
  }
  
  show raw: set text(font: code-font, size: body-fontsize * 0.9)
  
  show raw.where(block: true): block.with(
    width: 100%,
    fill: rgb("#f9fafb"),
    inset: 12pt,
    radius: 0pt,
    stroke: (left: 3pt + rgb("#d1d5db")),
    breakable: true,
  )

  // Enhanced quote styling for books
  show quote: it => {
    set par(first-line-indent: 0em)
    block(
      width: 100%,
      inset: (left: 2em, right: 2em, top: 1em, bottom: 1em),
    )[
      #set text(style: "italic", size: body-fontsize * 0.95)
      #set par(leading: 0.7em)
      #it.body
      #if it.attribution != none [
        #v(0.5em)
        #align(right)[
          #text(size: body-fontsize * 0.9, style: "normal")[— #it.attribution]
        ]
      ]
    ]
  }

  // Book title page (if title provided)
  if title != none and title != "" [
    #set align(center)
    #set par(first-line-indent: 0em)
    
    #v(4cm)
    
    // Main title
    #text(
      size: 28pt, 
      weight: "bold",
      font: heading-font,
      fill: rgb("#111827")
    )[#title]
    
    #v(2em)
    
    // Decorative line
    #line(length: 40%, stroke: 1pt + rgb("#6b7280"))
    
    #v(2em)
    
    // Authors
    #if authors != () and authors != none [
      #for (i, author) in authors.enumerate() [
        #if author.name != none and author.name != "" [
          #text(
            size: 16pt, 
            font: heading-font,
            fill: rgb("#374151")
          )[#author.name]
          #if i < authors.len() - 1 [
            #v(0.5em)
          ]
        ]
      ]
      #v(2em)
    ]
    
    // Date
    #if date != none [
      #text(
        size: 12pt, 
        style: "italic",
        fill: rgb("#6b7280")
      )[#date]
    ]
    
    #v(1fr)
    
    #pagebreak()
    
    // Copyright page (if authors provided)
    #if authors != () and authors != none [
      #v(1fr)
      #set align(left)
      #set text(size: 9pt, fill: rgb("#6b7280"))
      #set par(first-line-indent: 0em, leading: 0.6em)
      
      Copyright © #if date != none [#date] else [2024] by #if authors != () and authors != none [
        #for (i, author) in authors.enumerate() [
          #if author.name != none and author.name != "" [#author.name]#if i < authors.len() - 1 [, ]
        ]
      ] else [Author]
      
      #v(0.5em)
      All rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.
      
      #pagebreak()
    ]
  ]

  // Document content
  doc
}
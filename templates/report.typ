// Horizontal rule definition for Pandoc compatibility
#let horizontalrule = line(start: (25%,0%), end: (75%,0%))

// Email block styling function  
#let email-block(from: none, to: none, subject: none, date: none, body) = {
  block(
    width: 100%, 
    inset: 10pt, 
    fill: rgb("#f8f9fa"),
    stroke: 1pt + rgb("#dee2e6"), 
    radius: 4pt,
    breakable: true
  )[
    #text(size: 0.9em, weight: "semibold", fill: rgb("#495057"))[Email Communication]
    #v(0.3em)
    #line(length: 100%, stroke: 0.5pt + rgb("#adb5bd"))
    #v(0.5em)
    #grid(
      columns: (auto, 1fr),
      row-gutter: 4pt,
      column-gutter: 16pt,
      if from != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#6c757d"), weight: "medium")[From:]
      ] else [],
      if from != none [
        #text(size: 0.9em)[#from]
      ] else [],
      if to != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#6c757d"), weight: "medium")[To:]
      ] else [],
      if to != none [
        #text(size: 0.9em)[#to]
      ] else [],
      if subject != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#6c757d"), weight: "medium")[Subject:]
      ] else [],
      if subject != none [
        #text(size: 0.9em, weight: "medium")[#subject]
      ] else [],
      if date != none [
        #text(style: "italic", size: 0.85em, fill: rgb("#6c757d"), weight: "medium")[Date:]
      ] else [],
      if date != none [
        #text(size: 0.9em)[#date]
      ] else [],
    )
    #if body != none [
      #v(0.5em)
      #line(length: 100%, stroke: 0.5pt + rgb("#adb5bd"))
      #v(0.5em)
      #block(
        width: 100%,
        inset: 8pt,
        fill: white,
        stroke: 1pt + rgb("#e9ecef"),
        radius: 3pt,
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
  margin: (x: 3cm, y: 2.5cm),
  cols: 1,
  font: ("Concourse OT 3", "Helvetica Neue", "Arial"),
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
  
  // Professional report layout with wider margins for binding
  // Use UI-configured margins if available, otherwise fall back to template defaults
  let page-margin = if margin_top != none {
    (
      top: if margin_top != none { margin_top } else { 2.5cm },
      right: if margin_right != none { margin_right } else { 3cm },
      bottom: if margin_bottom != none { margin_bottom } else { 2.5cm },
      left: if margin_left != none { margin_left } else { 3cm },
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
      let page-num = counter(page).get().first()
      if page-num > 2 [
        #grid(
          columns: (1fr, auto, 1fr),
          text(9pt, style: "italic", fill: rgb("#4b5563"))[#title],
          text(9pt, weight: "medium")[Chapter #counter(heading).display("1")],
          align(right)[#text(9pt)[Page #page-num]]
        )
        #v(-0.3em)
        #line(length: 100%, stroke: 0.5pt + rgb("#d1d5db"))
      ]
    },
    footer: context {
      let page-num = counter(page).get().first()
      if page-num > 2 [
        #line(length: 100%, stroke: 0.5pt + rgb("#d1d5db"))
        #v(0.2em)
        #grid(
          columns: (1fr, auto, 1fr),
          text(8pt, fill: rgb("#6b7280"))[Document Date: #date],
          [],
          align(right)[#text(8pt, fill: rgb("#6b7280"))[Confidential]]
        )
      ]
    }
  )
  
  // Business document font
  // Use UI-configured font if available, otherwise use template default
  let body-font = if font != none and type(font) == str { 
    (font, "Concourse OT 3", "Helvetica Neue", "Arial") 
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
  
  // Professional paragraph formatting - use left alignment instead of full justification
  // Full justification can create ugly gaps in short lines and attachment text
  set par(justify: false, leading: 0.7em, first-line-indent: 0pt)
  
  // Chapter-style numbering
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // Professional report heading styles
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    block(
      width: 100%,
      below: 2.5em,
      above: 0pt,
      fill: rgb("#f9fafb"),
      inset: 12pt,
      stroke: (left: 4pt + rgb("#1f2937")),
    )[
      #set text(font: ("SF Pro Text", "Helvetica Neue", "Arial"), size: body-fontsize * 1.5, weight: "bold", fill: rgb("#1f2937"))
      #grid(
        columns: (auto, 1fr),
        column-gutter: 12pt,
        align(horizon)[#it.body]
      )
    ]
  }

  show heading.where(level: 2): it => block(
    width: 100%,
    below: 1.2em,
    above: 2em,
    inset: (bottom: 6pt),
    stroke: (bottom: 1pt + rgb("#e5e7eb")),
  )[
    #set text(font: ("SF Pro Text", "Helvetica Neue", "Arial"), size: body-fontsize * 1.3, weight: "semibold", fill: rgb("#374151"))
    #h(0.8em)
    #it.body
  ]

  show heading.where(level: 3): it => block(
    width: 100%,
    below: 0.8em,
    above: 1.5em,
  )[
    #set text(size: body-fontsize * 1.1, weight: "medium", fill: rgb("#4b5563"))
    #h(0.5em)
    #it.body
  ]

  // Apply monospace font to code blocks and inline code
  let code-font = if monospace_font != none and type(monospace_font) == str {
    (monospace_font, "Courier New", "Monaco")
  } else {
    ("Courier New", "Monaco")
  }
  
  show raw: set text(font: code-font)

  // Professional title page
  if title != none and title != "" [
    // Company header area
    #block(
      width: 100%,
      inset: 12pt,
      stroke: (bottom: 2pt + rgb("#1f2937")),
    )[
      #align(right)[
        #text(8pt, fill: rgb("#6b7280"))[CONFIDENTIAL BUSINESS DOCUMENT]
      ]
    ]
    
    #align(center + horizon)[
      #v(3em)
      
      // Main title
      #block(
        width: 100%,
        inset: 20pt,
        fill: rgb("#f9fafb"),
        stroke: 1pt + rgb("#e5e7eb"),
        radius: 8pt,
      )[
        #align(center)[
          #text(28pt, weight: "bold", fill: rgb("#1f2937"))[#title]
        ]
      ]
      
      #v(3em)
      
      // Authors/Prepared by
      #if authors != () and authors != none [
        #text(14pt, fill: rgb("#4b5563"))[Prepared by:]
        #v(0.5em)
        #for author in authors [
          #if author.name != none and author.name != "" [
            #text(18pt, weight: "medium")[#author.name]
            #v(0.3em)
          ]
        ]
        #v(2em)
      ]
      
      // Date
      #if date != none [
        #text(12pt, fill: rgb("#6b7280"))[Report Date:]
        #v(0.3em)
        #text(16pt, weight: "medium")[#date]
      ]
      
      #v(4em)
    ]
    
    // Footer with document info
    #place(
      bottom,
      block(
        width: 100%,
        inset: 12pt,
        stroke: (top: 1pt + rgb("#e5e7eb")),
      )[
        #text(8pt, fill: rgb("#9ca3af"))[
          This document contains confidential and proprietary information. 
          Distribution is restricted to authorized personnel only.
        ]
      ]
    )

    // Table of contents page
    #pagebreak()
    #align(center)[
      #text(20pt, weight: "bold")[Table of Contents]
    ]
    #v(2em)
    #outline(title: none)
    #v(2em)

    
  ]

  // Document content starts on page 3
  doc
}
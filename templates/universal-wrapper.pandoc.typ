// Universal Pandoc wrapper for all Typst templates
// This wrapper handles Pandoc's variable substitution and passes them to the actual Typst template

#import "$template_path$": conf

#show: doc => conf(
  $if(title)$title: [$title$],$else$title: none,$endif$
  $if(authors)$authors: ($for(authors)$(name: "$authors.name$", email: "$authors.email$", affiliation: "$authors.affiliation$")$sep$, $endfor$),$else$authors: (),$endif$
  $if(date)$date: [$date$],$else$date: none,$endif$
  $if(lang)$lang: "$lang$",$else$lang: "en",$endif$
  $if(region)$region: "$region$",$else$region: "US",$endif$
  $if(paper)$paper: "$paper$",$else$paper: "a4",$endif$
  $if(margin)$margin: (x: $margin.x$, y: $margin.y$),$else$$if(margin_top)$margin: (top: $margin_top$, right: $if(margin_right)$$margin_right$$else$1.5cm$endif$, bottom: $if(margin_bottom)$$margin_bottom$$else$1.5cm$endif$, left: $if(margin_left)$$margin_left$$else$1.5cm$endif$),$else$margin: (x: 1.5cm, y: 1.5cm),$endif$$endif$
  $if(cols)$cols: $cols$,$else$cols: 1,$endif$
  $if(font)$font: "$font$",$else$font: ("Concourse OT", "Helvetica Neue", "Arial", "sans-serif"),$endif$
  $if(fontsize)$fontsize: $fontsize$,$else$fontsize: 11pt,$endif$
  $if(sectionnumbering)$sectionnumbering: "$sectionnumbering$",$else$sectionnumbering: "1.",$endif$
  $if(pagenumbering)$pagenumbering: "$pagenumbering$",$else$pagenumbering: "1",$endif$
  // Support for UI-configurable options
  $if(heading_font)$heading_font: "$heading_font$",$else$heading_font: none,$endif$
  $if(monospace_font)$monospace_font: "$monospace_font$",$else$monospace_font: none,$endif$
  $if(heading_fontsize)$heading_fontsize: $heading_fontsize$,$else$heading_fontsize: none,$endif$
  $if(small_fontsize)$small_fontsize: $small_fontsize$,$else$small_fontsize: none,$endif$
  $if(margin_top)$margin_top: $margin_top$,$else$margin_top: none,$endif$
  $if(margin_right)$margin_right: $margin_right$,$else$margin_right: none,$endif$
  $if(margin_bottom)$margin_bottom: $margin_bottom$,$else$margin_bottom: none,$endif$
  $if(margin_left)$margin_left: $margin_left$,$else$margin_left: none,$endif$
  $if(orientation)$orientation: "$orientation$",$else$orientation: "portrait",$endif$
  export_format: "$if(export_format)$$export_format$$else$standard$endif$",
  [$body$]
)
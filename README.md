# Pedigree Studio

A pedigree chart builder that runs in the browser. Live at [pedigree.swofty.net](https://pedigree.swofty.net).

Charts are built by selecting a person and adding relatives to them. The layout is automatic and every symbol follows NSGC standardized pedigree nomenclature (Bennett et al. 2008, with the 2022 sex and gender update).

## Features

- Start from an empty grid with any person, or from the quick-start family sketch or an example chart
- Add partners (any number), children, siblings, parents, identical and fraternal twins, pregnancies, miscarriages, stillbirths and terminations
- Link existing people as partners or as parents, so consanguineous unions and joined families are supported
- Automatic layout with generation numerals and individual numbers (II-3)
- Consanguinity detected from shared ancestors and drawn as a double line
- Separation, divorce, no children by choice, infertility, adoption in and out, donors and surrogates, multiple individuals, documented evaluation
- Cancer history with age at diagnosis, drawn as colour-coded symbol fills (halves and quadrants for several diagnoses)
- Genetic test results (pathogenic, likely pathogenic, VUS, likely benign, negative) as badges and gene tags
- Custom conditions with affected, carrier, presymptomatic and suspected status, colours and print patterns
- Relationship labels computed from the proband (maternal aunt, first cousin once removed, sister-in-law)
- Auto-generated key containing only the symbols used in the chart
- Several canvases saved in browser storage with autosave, undo and redo
- Export to PNG (2×, 4×, transparent), clipboard image, SVG with embedded fonts, print or PDF, and JSON chart files

## Keyboard

| Key | Action |
| --- | --- |
| `M` `Shift F` `U` | Add an unconnected person |
| `P` `C` `S` | Partner, child and sibling menus for the selected person |
| `U` | Add parents to the selected person |
| `K` `G` | Add a cancer diagnosis or gene result |
| Arrow keys | Move between relatives |
| `Del` | Delete the selection |
| `Ctrl Z` `Ctrl Shift Z` | Undo and redo |
| `F` | Fit the chart to the screen |
| `?` | All shortcuts |

## Development

```sh
npm install
npm run dev      # http://127.0.0.1:5190
npm run build    # static site in dist/
```

Stack: React 19, TypeScript, Vite, Zustand and Immer. The chart is a single SVG renderer shared by the canvas, thumbnails and every export format.

Chart data stays in the browser's local storage. Nothing is sent to a server.

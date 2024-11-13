# What is the Dryfold CLI?

A tool to reinforce my C++ and Rust know-how, first and foremost!

But beyond that, Dryfold helps with:

1. Static code analysis
2. Complexity scores and estimated time - decide if migrating to a new language (like Rust) is worth it
3. Export to Github Projects - plan the work among the team. Everyone loves a kanban, right? I do.
4. Export to TSV if you want to view the source codebase in a dataviz app like Gephi.
5. Export to JSON for other project management/kanban board apps like Kanri.
6. Export to SVG, PNG and .dot.

## Install Graphviz Before Running

You need to have `graphviz` installed globally on your local machine for the reports to finish compiling without error. The SVG, PNG and .dot file generation all rely on `graphviz`.

I'll look at bundling graphviz into the app to remove this requirement soon. For now, to install locally:

### MacOS

```bash
brew install graphviz
```
### Windows

The recommended way is through Chocolatey:

```shell
choco install graphviz
```

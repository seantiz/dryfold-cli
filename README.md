# What is the Dryfold CLI?

A tool to reinforce my C++ and Rust know-how, first and foremost!

But beyond that, Dryfold helps with:

1. Static code analysis
2. Complexity scores and estimated time - decide if migrating to a new language (like Rust) is worth it
3. Export to Github Projects - plan the work among the team. Everyone loves a kanban, right? I do.
4. Export to CSV if you want to view the source codebase in a dataviz app like Gephi.
5. Export to JSON for other project management/kanban board apps like Kanri.
6. Export to TSV, SVG, PNG and .dot.

## Install Graphviz Before Running

You need to have `graphviz` installed globally on your local machine for the reports to finish compiling without error. The CSV, SVG, PNG and .dot file generation all rely on `graphviz`. I found that CSV spreadsheets were easier to write (with the nodes and edge relationships intact) when first reading from the .dot file rather than trying to write CSVs directly from the module map.

I'll look at bundling graphviz into the app to remove this requirement soon.

For now, to install Graphviz locally:

### MacOS

```bash
brew install graphviz
```
### Windows

The recommended way is through Chocolatey:

```shell
choco install graphviz
```
## Optional: Install Github's gh cli tool

If you want to publish a new Github project from your Dryfold maps, you'll need to have `gh` CLI tool installed locally so you can post to your Github profile. Your `gh` will also need permission to create and edit projects on your Github account.

Github has its own code verification process for doing this from the `gh` tool itself.

# Example: Dryfold Put to Use

A brief visual plan when you load the CSV data from Dryfold into an app like Gephi:

![PDF Poppler C++ codebase visualised in Gephi using Dryfold-CLI maps](/docs/gephi-viz.gif)


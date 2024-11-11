# Changelog

## 0.0.6 (2024-11-11)

ModuleMapValues type is no more.

Map structures are now separated into ComplexityValues and ReportValues, as any task further along the pipeline than analyseFeatureComplexity() does not need the tree AST as part of the returned map structure.

Added the ability to export tasks as JSON that conforms to Kanri app's kanban card schema.

## 0.0.5 (2024-11-11)

Bug fixing: Analysing feature complexity went under heavy refactoring as a task when processing its own local feature maps.

New features on the board: The app can now post all generated tasks as a new Github project for kanban project management, with estimated times and complexity scores (as well as grouping tasks by layer type) to help plan and divide the cost of the new project among the team.

## 0.0.3 (2024-11-04)

Added main() that uses Readline to prompt the user for an entry-point folder when beginning static analysis of the target repo. walkDirectory() now accepts that user input as its argument.

## 0.0.1 (2024-11-04)

We rewrote our original Javascript file in Typescript and split tasks up into modules. The main responsibilities of this app are to analyse time and complexity, and to generate reports and a .dot graph as well as SVG and PNG graph viz.
# Changelog

## 0.8.0 (2024-11-12) Major Version Jump

* Added extensive pattern matching to our layer-value classication logic with determineLayerType()

* determineLayerType() now processes the source files based on their module relationships first, but also handles filename-based pattern matching as a fallback for what looks like successful C++ codebase coverage. This looks like it might have solved the previous state where 77 C++ modules from our chosen source codebase (PDF Poppler) were repeatedly not being handled by the app's layer classification tasks.

* Improved createDot()'s layer values in line with the data being returned from determineLayerType()

* Similar improvements made to the nexus function findDesign() which sits at the heart of converting Complexity Maps to Design Maps

* Slightly extended the DesignValues map type to include optional filename-based layer values as well as the pre-existing module-relationship-based layer values

## 0.0.7 (2024-11-12)

* Removed the utility validateBinary() because checking our validating C++ files is now cleaner and the binary-file check became redundant.
* Removed linkedlibraries array from map structures.
* Removed generatePublicInterface() to de-duplicate methods being listed in both HTML report cards.
* Created a cleaner separation between the maps needed for the Complexity Report (with AST included) and the maps needed for codebase design reporting (without AST)
* Fixed createDependencyDot() thanks to the cleaner separation
* We now report any unprocessed modules with an "unknown" layer type in the Feature Report and the .dot file, but we don't let them take up any space in our graph dependencies section for the sake of clean visuals when importing the data into a dataviz app like Gephi
* Refactored routh paths just for our own internal feng shui between complexity analysis, design analysis and exporting options. Schema is also now at root level.

## 0.0.6 (2024-11-11)

* ModuleMapValues type is no more.
* Map structures are now separated into ComplexityValues and ReportValues, as any task further along the pipeline than analyseFeatureComplexity() does not need the tree AST as part of the returned map structure.
* Added the ability to export tasks as JSON that conforms to Kanri app's kanban card schema.

## 0.0.5 (2024-11-11)

* Bug fixing: Analysing feature complexity went under heavy refactoring as a task when processing its own local feature maps.
* New features on the board: The app can now post all generated tasks as a new Github project for kanban project management, with estimated times and complexity scores (as well as grouping tasks by layer type) to help plan and divide the cost of the new project among the team.

## 0.0.3 (2024-11-04)

* Added main() that uses Readline to prompt the user for an entry-point folder when beginning static analysis of the target repo. walkDirectory() now accepts that user input as its argument.

## 0.0.1 (2024-11-04)

* We rewrote our original Javascript file in Typescript and split tasks up into modules. The main responsibilities of this app are to analyse time and complexity, and to generate reports and a .dot graph as well as SVG and PNG graph viz.
import type { Tree } from "tree-sitter";
import type { MapValues } from "./schema";

export function calculateLogicTime(tree: Tree) {
    let totalMinutes = 0;

    // Analyze if statements
    tree.rootNode.descendantsOfType('if_statement').forEach((node) => {
      const lines = node.endPosition.row - node.startPosition.row + 1;
      totalMinutes +=
        lines <= 5
          ? 5 // 5 mins for small blocks
          : lines <= 15
          ? 10 // 10 mins for medium blocks
          : 15; // 15 mins for large blocks
    });

    // Analyze loops
    ['for_statement', 'while_statement'].forEach((loopType) => {
      tree.rootNode.descendantsOfType(loopType).forEach((node) => {
        const lines = node.endPosition.row - node.startPosition.row + 1;
        totalMinutes +=
          lines <= 5
            ? 7 // 7 mins for small loops
            : lines <= 15
            ? 12 // 12 mins for medium loops
            : 20; // 20 mins for complex loops
      });
    });

    return totalMinutes / 60; // Convert to hours
  }

  export function calculateTemplateComplexity(tree: Tree) {
    let templateComplexity = 0;

    tree.rootNode.descendantsOfType('template_declaration').forEach((node) => {
      // Base time - 1 minute for simple templates
      let time = 1 / 60;

      // Check for template parameter complexity
      const params = node.descendantsOfType('template_parameter_list');
      if (params.length > 1) {
        time += 0.25 * params.length; // Add 15 min per additional parameter
      }

      // Check for specializations
      const specializations = node.descendantsOfType('template_specialization');
      if (specializations.length > 0) {
        time += 0.5 * specializations.length; // Add 30 min per specialization
      }

      // Check for SFINAE or complex constraints
      const constraints = node.descendantsOfType('requires_clause').length;
      if (constraints > 0) {
        time += 0.75; // Add 45 min for complex constraints
      }

      templateComplexity += time;
    });

    return templateComplexity;
  }

export function analyseFeatureComplexity(moduleMap: Map<string, MapValues>) {
    const featureMap = new Map()

    // First pass: Register all features and their basic structure
    for (const [file, data] of moduleMap) {
        if (!data.complexity?.tree?.rootNode) continue

        const tree = data.complexity.tree

        // Analyse methods and inheritance
        tree.rootNode.descendantsOfType('class_specifier').forEach((classNode) => {
            const className = classNode.childForFieldName('name')?.text
            if (!className) return

            const methods = classNode.descendantsOfType('function_definition')
            const baseClause = classNode.descendantsOfType('base_class_clause')[0]
            const hasVirtualMethods = methods.some((m) => m.text.includes('virtual'))

            // Determine class type
            let classType
            if (baseClause) {
                classType = 'derived'
            } else if (hasVirtualMethods) {
                classType = 'base'
            } else if (className.startsWith('Goo') || className.includes('Utils')) {
                classType = 'utility'
            } else {
                classType = 'core'
            }

            if (!featureMap.has(className)) {
                featureMap.set(className, {
                    name: className,
                    type: classType, // Now using the determined type
                    occurrences: [],
                    totalMethods: methods.length,
                    metrics: {
                        loc: 0,
                        dependencies: new Set(),
                        inheritsFrom: new Set(),
                        usedBy: new Set(),
                        uses: new Set()
                    }
                })
            }

            const featureData = featureMap.get(className)
            featureData.occurrences.push(file)

            // Look for base class specifier
            classNode.descendantsOfType('base_class_clause').forEach((baseClause) => {
                // Check for qualified identifiers (like poppler::noncopyable)
                baseClause.descendantsOfType('qualified_identifier').forEach((qualifier) => {
                    featureData.metrics.inheritsFrom.add(qualifier.text)
                })

                // Also check for simple identifiers
                baseClause.descendantsOfType('type_identifier').forEach((type) => {
                    featureData.metrics.inheritsFrom.add(type.text)
                })
            })

            // Analyze method calls and member variable usage
            classNode.descendantsOfType('field_expression').forEach((fieldExpr) => {
                const object = fieldExpr.childForFieldName('argument')?.text
                if (object && object !== 'this') {
                    featureData.metrics.uses.add(object)
                }
            })

            // Analyze function calls
            classNode.descendantsOfType('call_expression').forEach((callExpr) => {
                const callee = callExpr.childForFieldName('function')?.text
                if (callee && !callee.startsWith('std::')) {
                    featureData.metrics.uses.add(callee.split('::')[0])
                }
            })
        })
    }

    // Second pass: Build dependency relationships
    for (const [className, featureData] of featureMap) {
        // Add inherited classes as dependencies
        featureData.metrics.inheritsFrom.forEach((baseClass: string) => {
            if (featureMap.has(baseClass)) {
                featureData.metrics.dependencies.add(baseClass)
                featureMap.get(baseClass).metrics.usedBy.add(className)
            }
        })

        // Add used classes as dependencies
        featureData.metrics.uses.forEach((usedClass: string) => {
            if (featureMap.has(usedClass)) {
                featureData.metrics.dependencies.add(usedClass)
                featureMap.get(usedClass).metrics.usedBy.add(className)
            }
        })
    }

    return featureMap
}
import type { Tree } from 'tree-sitter';
import type { MapValues } from './schema';
import Parser from 'tree-sitter';

export function calculateControlFlowTime(tree: Tree) {
  let totalMinutes = 0;

  tree.rootNode.descendantsOfType('if_statement').forEach((node) => {
    const lines = node.endPosition.row - node.startPosition.row + 1;
    totalMinutes +=
      lines <= 5
        ? 5
        : lines <= 15
        ? 10
        : 15;
  });

  ['for_statement', 'while_statement'].forEach((loopType) => {
    tree.rootNode.descendantsOfType(loopType).forEach((node) => {
      const lines = node.endPosition.row - node.startPosition.row + 1;
      totalMinutes +=
        lines <= 5
          ? 7
          : lines <= 15
          ? 12
          : 20;
    });
  });

  return totalMinutes / 60;
}

export function calculateTemplateComplexity(tree: Tree) {
  let templateComplexity = 0;

  tree.rootNode.descendantsOfType('template_declaration').forEach((node) => {
    // Base time - 1 minute for simple templates
    let time = 1 / 60;

    const params = node.descendantsOfType('template_parameter_list');
    if (params.length > 1) {
      time += 0.25 * params.length;
    }

    const specializations = node.descendantsOfType('template_specialization');
    if (specializations.length > 0) {
      time += 0.5 * specializations.length;
    }

    // Check for SFINAE or complex constraints
    const constraints = node.descendantsOfType('requires_clause').length;
    if (constraints > 0) {
      time += 0.75;
    }

    templateComplexity += time;
  });

  return templateComplexity;
}

export function analyseFeatureComplexity(moduleMap: Map<string, MapValues>) {
  const featureMap = new Map();

  // First pass: Register all features and their basic structure
  for (const [file, data] of moduleMap) {
    if (!data.complexity?.tree?.rootNode) continue;

    const tree = data.complexity.tree;
    tree.rootNode.descendantsOfType('class_specifier').forEach((classNode) => {
      const className = classNode.childForFieldName('name')?.text;
      if (!className) return;

      const methods = classNode.descendantsOfType('function_definition');
      const baseClause = classNode.descendantsOfType('base_class_clause')[0];
      const hasVirtualMethods = methods.some((m) => m.text.includes('virtual'));

      // Helper function to check if a class is likely an interface
      function isInterfaceClass(
        classNode: Parser.SyntaxNode,
        methods: Parser.SyntaxNode[]
      ): boolean {
        // Check for pure virtual methods (= 0)
        const hasPureVirtual = methods.some((m) => m.text.includes('= 0'));
        if (hasPureVirtual) return true;

        // Check if ALL methods are virtual (common interface pattern)
        const allMethodsVirtual =
          methods.length > 0 && methods.every((m) => m.text.includes('virtual'));
        if (allMethodsVirtual) return true;

        // Check interface naming patterns
        const className = classNode.childForFieldName('name')?.text;
        if (
          className &&
          ((className.startsWith('I') && // IRenderer pattern
            className.length > 1 &&
            className[1] === className[1].toUpperCase()) || // Check second char is uppercase
            className.endsWith('Interface') ||
            className.startsWith('Abstract'))
        )
          return true;

        // Check if class has no implementation (only declarations)
        const hasImplementations = methods.some(
          (m) => m.text.includes('{') && !m.text.includes('= 0')
        );
        return !hasImplementations && methods.length > 0;
      }

      let classType;
      if (isInterfaceClass(classNode, methods)) {
        classType = 'interface';
      } else if (baseClause) {
        if (className.includes('_private') || className.endsWith('Impl')) {
          classType = 'derived';
        } else if (methods.some((m) => m.text.includes('virtual'))) {
          // Classes with inheritance and virtual methods are likely core abstractions
          classType = 'core';
        } else {
          classType = 'derived';
        }
      } else if (
        className.startsWith('Goo') ||
        className.includes('Utils') ||
        className.endsWith('Helper') ||
        className.includes('Factory')
      ) {
        classType = 'utility';
      } else if (methods.length === 0 || className.includes('_private')) {
        // Data-only classes or implementation details
        classType = 'derived';
      } else {
        // Classes without inheritance but with implementation are likely core
        classType = 'core';
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
        });
      }

      const featureData = featureMap.get(className);
      featureData.occurrences.push(file);

      // Look for base class specifier
      classNode.descendantsOfType('base_class_clause').forEach((baseClause) => {
        // Check for qualified identifiers (like poppler::noncopyable)
        baseClause.descendantsOfType('qualified_identifier').forEach((qualifier) => {
          featureData.metrics.inheritsFrom.add(qualifier.text);
        });

        // Also check for simple identifiers
        baseClause.descendantsOfType('type_identifier').forEach((type) => {
          featureData.metrics.inheritsFrom.add(type.text);
        });
      });

      // Analyze method calls and member variable usage
      classNode.descendantsOfType('field_expression').forEach((fieldExpr) => {
        const object = fieldExpr.childForFieldName('argument')?.text;
        if (object && object !== 'this') {
          featureData.metrics.uses.add(object);
        }
      });

      // Analyze function calls
      classNode.descendantsOfType('call_expression').forEach((callExpr) => {
        const callee = callExpr.childForFieldName('function')?.text;
        if (callee && !callee.startsWith('std::')) {
          featureData.metrics.uses.add(callee.split('::')[0]);
        }
      });
    });
  }

  // Second pass: Build dependency relationships
  for (const [className, featureData] of featureMap) {
    // Add inherited classes as dependencies
    featureData.metrics.inheritsFrom.forEach((baseClass: string) => {
      if (featureMap.has(baseClass)) {
        featureData.metrics.dependencies.add(baseClass);
        featureMap.get(baseClass).metrics.usedBy.add(className);
      }
    });

    // Add used classes as dependencies
    featureData.metrics.uses.forEach((usedClass: string) => {
      if (featureMap.has(usedClass)) {
        featureData.metrics.dependencies.add(usedClass);
        featureMap.get(usedClass).metrics.usedBy.add(className);
      }
    });
  }

  return featureMap;
}

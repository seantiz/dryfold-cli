import { calculateControlFlowTime, calculateTemplateComplexity } from './complexity';
import fs from 'fs'
import Parser from 'tree-sitter'
import Cpp from 'tree-sitter-cpp'
import type { TasksAnalysis, ClassInfo, ModuleMapValues, ClassData } from "./schema";
import type { Tree } from 'tree-sitter'

const parser = new Parser()
parser.setLanguage(Cpp)

function sortTasks(tree: Tree): TasksAnalysis {
    const tasks: TasksAnalysis = {
      topLevelFunctions: [],
      callbackTasks: [],
      features: {
        baseClasses: [],
        derivedClasses: [],
        utilityClasses: [],
        coreClasses: []
      }
    };

    // Analyze top-level functions (unchanged)
    tree.rootNode.descendantsOfType('function_definition').forEach((node) => {
      const functionName = node.childForFieldName('declarator')?.text || 'anonymous';
      tasks.topLevelFunctions.push({
        name: functionName,
        lineStart: node.startPosition.row + 1,
        lineEnd: node.endPosition.row + 1
      });
    });

    // Handle callback tasks (unchanged)
    tree.rootNode.descendantsOfType('call_expression').forEach((node) => {
      const args = node.childForFieldName('arguments');
      if (args) {
        args.children.forEach((arg) => {
          if (arg.type === 'lambda_expression' || arg.type === 'function_definition') {
            tasks.callbackTasks.push({
              parentFunction: node.childForFieldName('function')?.text || 'unknown',
              lineStart: arg.startPosition.row + 1,
              lineEnd: arg.endPosition.row + 1
            });
          }
        });
      }
    });

    // Analyze classes with inheritance relationships
    tree.rootNode.descendantsOfType('class_specifier').forEach((classNode) => {
      const className = classNode.childForFieldName('name')?.text || 'anonymous';
      const baseClasses = classNode
        .descendantsOfType('base_class_clause')
        .map((base) => base.text.trim());
      const methods = classNode.descendantsOfType('function_definition').map((method) => ({
        name: method.childForFieldName('declarator')?.text || 'anonymous',
        lineStart: method.startPosition.row + 1,
        lineEnd: method.endPosition.row + 1,
        isVirtual: method.text.includes('virtual')
      }));

      const classInfo: ClassInfo = {
        name: className,
        methods: methods,
        baseClasses: baseClasses,
        isCore: false,
        isBase: baseClasses.length === 0 && methods.some((m) => m.isVirtual),
        isUtility: className.includes('Util') || className.includes('Helper')
      };

      // Categorize the class based on its characteristics
      if (baseClasses.length === 0 && methods.some((m) => m.isVirtual)) {
        tasks.features.baseClasses.push(classInfo);
      } else if (baseClasses.length > 0) {
        tasks.features.derivedClasses.push(classInfo);
      } else if (className.includes('Util') || className.includes('Helper')) {
        tasks.features.utilityClasses.push(classInfo);
      } else {
        tasks.features.coreClasses.push(classInfo);
      }
    });

    return tasks;
  }

  export function findTaskComplexity(filePath: string, code: string, tree: Tree) {
    const metrics = {
      loc: code.split('\n').length,
      functions: 0,
      classes: 0,
      templates: 0,
      conditionals: 0,
      loops: 0,
      includes: 0
    };

    const CLASS_TYPE_TIMES = {
      core: 1.5, // 1.5 hour base time
      utility: 1, // 1 hour base time
      base: 0.5, // 50 minute base time
      derived: 0.25 // 15 minute base time
    };

    const classTimeMetrics = {
      core: 0,
      utility: 0,
      base: 0,
      derived: 0
    };

    // Count different constructs
    tree.rootNode.descendantsOfType('function_definition').forEach(() => metrics.functions++);
    tree.rootNode.descendantsOfType('class_specifier').forEach(() => metrics.classes++);
    tree.rootNode.descendantsOfType('template_declaration').forEach(() => metrics.templates++);
    tree.rootNode.descendantsOfType('if_statement').forEach(() => metrics.conditionals++);
    tree.rootNode.descendantsOfType('for_statement').forEach(() => metrics.loops++);
    tree.rootNode.descendantsOfType('while_statement').forEach(() => metrics.loops++);
    tree.rootNode.descendantsOfType('preproc_include').forEach(() => metrics.includes++);

    // Add task analysis
    const taskAnalysis = sortTasks(tree);

    Object.values(taskAnalysis.features)
      .flat()
      .forEach((feature) => {
        const classLOC = feature.methods.reduce(
          (total, method) => total + (method.lineEnd - method.lineStart + 1),
          0
        );

        const baseLOCTime = (classLOC * 15) / 3600;

        // Determine class type
        const classType = feature.isCore
          ? 'core'
          : feature.isUtility
          ? 'utility'
          : feature.isBase
          ? 'base'
          : 'derived';

        const timeForClass = CLASS_TYPE_TIMES[classType] + baseLOCTime;

        classTimeMetrics[classType] += timeForClass;
      });

    // Adjusted time components
    const headerFileTime = (metrics.loc * 5) / 3600; // 5 seconds per line average
    const templateTime = calculateTemplateComplexity(tree);
    const logicTime = calculateControlFlowTime(tree);

    // Additional time components for thorough testing and documentation
    const testingTime = (classTimeMetrics.core + classTimeMetrics.utility) * 0.5;
    const documentationTime = (classTimeMetrics.core + classTimeMetrics.utility) * 0.3;

    // Total estimation
    const totalTime =
      (headerFileTime || 0) +
        Object.values(classTimeMetrics).reduce((sum, time) => sum + (time || 0), 0) +
        (templateTime || 0) +
        (logicTime || 0) +
        (testingTime || 0) +
        (documentationTime || 0) || 0;

    const hours = Math.floor(totalTime) || 0;
    const minutes = Math.round((totalTime - hours) * 60) || 0;

    // Complexity score calculation
    const complexityScore =
      metrics.functions * 2 +
      (taskAnalysis.features.coreClasses?.length * 4 || 0) +
      (taskAnalysis.features.utilityClasses?.length * 3 || 0) +
      (taskAnalysis.features.baseClasses?.length * 2 || 0) +
      (taskAnalysis.features.derivedClasses?.length * 1 || 0) +
      metrics.templates * 4 +
      metrics.conditionals * 1 +
      metrics.loops * 1.5 +
      metrics.includes * 0.5;

    return {
      metrics,
      complexityScore,
      estimatedTime: {
        hours,
        minutes
      },
      tasks: taskAnalysis,
      classRelationships: {},
      tree: tree
    };
  }

export function analyseCppDependencies(filePath: string): ModuleMapValues {
    try {
        const code = fs.readFileSync(filePath, 'utf-8')
        if (!code || code.length === 0) {
            return {
                error: 'Empty file',
                includes: [],
                linkedLibraries: [],
                complexity: null
            }
        }

        // Skip problematic files based on content analysis
        if (code.includes('/* This file is generated') ||
            code.includes('/* This is an automatically generated table') ||
            code.includes('// Generated by') ||
            code.includes('regenerated')) {
            return {
                includes: [],
                linkedLibraries: [],
                complexity: null,
                error: 'Skipped generated/table file'
            }
        }

        // New checks for complex header files
        const pragmaCount = (code.match(/#pragma/g) || []).length
        const classCount = (code.match(/\bclass\s+\w+/g) || []).length
        const deletedMethodCount = (code.match(/\bdelete\b/g) || []).length

        // Skip files with high complexity indicators
        if (pragmaCount > 2 && classCount > 5 ||
            classCount > 10 ||
            deletedMethodCount > 5) {
                return {
                    includes: [],
                    linkedLibraries: [],
                    complexity: null,
                    error: 'Skipped generated/table file'
                }
            }

        // Add new check for hex mapping tables
        const hexMapPattern = /{\s*0x[0-9a-fA-F]+\s*,\s*["'][^"']+["']\s*}/g
        const matches = code.match(hexMapPattern)
        if (matches && matches.length > 10) { // If file has many hex mappings
            return {
                includes: [],
                linkedLibraries: [],
                complexity: null,
                error: 'Skipped hex mapping table file'
            }
        }

        const tree = parser.parse(code);

        const dependencies: ModuleMapValues = {
            includes: [],
            linkedLibraries: [],
            complexity: {
                metrics: {
                    loc: 0,
                    functions: 0,
                    classes: 0,
                    templates: 0,
                    conditionals: 0,
                    loops: 0,
                    includes: 0
                },
                complexityScore: 0,
                estimatedTime: {
                    hours: 0,
                    minutes: 0
                },
                tasks: {
                    topLevelFunctions: [],
                    callbackTasks: [],
                    features: {
                        baseClasses: [],
                        derivedClasses: [],
                        utilityClasses: [],
                        coreClasses: []
                    }
                },
                classRelationships: {},
                tree: tree
            }
        };

        // Analyze includes
        tree.rootNode.descendantsOfType('preproc_include').forEach((node) => {
            const headerNode = node.descendantsOfType('string_literal')[0] ||
                node.descendantsOfType('system_lib_string')[0]
            if (headerNode) {
                const headerPath = headerNode.text.replace(/[<>"]/g, '')
                dependencies.includes.push(headerPath)
            }
        })

        // Add complexity analysis
        dependencies.complexity = findTaskComplexity(filePath, code, tree)

        return dependencies
    } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error)
        return {
            error: error as string,
            includes: [],
            linkedLibraries: [],
            complexity: null
        }
    }
}
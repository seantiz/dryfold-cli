import { calculateLogicTime, calculateTemplateComplexity } from './complexity';
import fs from 'fs';
import Parser from 'tree-sitter';
import Cpp from 'tree-sitter-cpp';
const parser = new Parser();
parser.setLanguage(Cpp);
function sortTasks(tree) {
    const tasks = {
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
        var _a;
        const functionName = ((_a = node.childForFieldName('declarator')) === null || _a === void 0 ? void 0 : _a.text) || 'anonymous';
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
                var _a;
                if (arg.type === 'lambda_expression' || arg.type === 'function_definition') {
                    tasks.callbackTasks.push({
                        parentFunction: ((_a = node.childForFieldName('function')) === null || _a === void 0 ? void 0 : _a.text) || 'unknown',
                        lineStart: arg.startPosition.row + 1,
                        lineEnd: arg.endPosition.row + 1
                    });
                }
            });
        }
    });
    // Analyze classes with inheritance relationships
    tree.rootNode.descendantsOfType('class_specifier').forEach((classNode) => {
        var _a;
        const className = ((_a = classNode.childForFieldName('name')) === null || _a === void 0 ? void 0 : _a.text) || 'anonymous';
        const baseClasses = classNode
            .descendantsOfType('base_class_clause')
            .map((base) => base.text.trim());
        const methods = classNode.descendantsOfType('function_definition').map((method) => {
            var _a;
            return ({
                name: ((_a = method.childForFieldName('declarator')) === null || _a === void 0 ? void 0 : _a.text) || 'anonymous',
                lineStart: method.startPosition.row + 1,
                lineEnd: method.endPosition.row + 1,
                isVirtual: method.text.includes('virtual')
            });
        });
        const classInfo = {
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
        }
        else if (baseClasses.length > 0) {
            tasks.features.derivedClasses.push(classInfo);
        }
        else if (className.includes('Util') || className.includes('Helper')) {
            tasks.features.utilityClasses.push(classInfo);
        }
        else {
            tasks.features.coreClasses.push(classInfo);
        }
    });
    return tasks;
}
export function findTaskComplexity(filePath, code, tree) {
    var _a, _b, _c, _d;
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
        const classLOC = feature.methods.reduce((total, method) => total + (method.lineEnd - method.lineStart + 1), 0);
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
    const logicTime = calculateLogicTime(tree);
    // Additional time components for thorough testing and documentation
    const testingTime = (classTimeMetrics.core + classTimeMetrics.utility) * 0.5;
    const documentationTime = (classTimeMetrics.core + classTimeMetrics.utility) * 0.3;
    // Total estimation
    const totalTime = (headerFileTime || 0) +
        Object.values(classTimeMetrics).reduce((sum, time) => sum + (time || 0), 0) +
        (templateTime || 0) +
        (logicTime || 0) +
        (testingTime || 0) +
        (documentationTime || 0) || 0;
    const hours = Math.floor(totalTime) || 0;
    const minutes = Math.round((totalTime - hours) * 60) || 0;
    // Complexity score calculation
    const complexityScore = metrics.functions * 2 +
        (((_a = taskAnalysis.features.coreClasses) === null || _a === void 0 ? void 0 : _a.length) * 4 || 0) +
        (((_b = taskAnalysis.features.utilityClasses) === null || _b === void 0 ? void 0 : _b.length) * 3 || 0) +
        (((_c = taskAnalysis.features.baseClasses) === null || _c === void 0 ? void 0 : _c.length) * 2 || 0) +
        (((_d = taskAnalysis.features.derivedClasses) === null || _d === void 0 ? void 0 : _d.length) * 1 || 0) +
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
        tree: tree
    };
}
export function analyseCppDependencies(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf-8');
        if (!code || code.length === 0) {
            return {
                error: 'Empty file',
                includes: [],
                complexity: null
            };
        }
        const dependencies = {
            includes: [],
            complexity: null
        };
        const tree = parser.parse(code);
        // Analyze includes
        tree.rootNode.descendantsOfType('preproc_include').forEach((node) => {
            const headerNode = node.descendantsOfType('string_literal')[0] ||
                node.descendantsOfType('system_lib_string')[0];
            if (headerNode) {
                const headerPath = headerNode.text.replace(/[<>"]/g, '');
                dependencies.includes.push(headerPath);
            }
        });
        // Add complexity analysis
        dependencies.complexity = findTaskComplexity(filePath, code, tree);
        return dependencies;
    }
    catch (error) {
        console.error(`Error analyzing ${filePath}:`, error);
        return {
            error: error,
            includes: [],
            complexity: null
        };
    }
}

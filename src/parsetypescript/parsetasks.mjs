import Parser from 'tree-sitter';
import TypescriptParser from 'tree-sitter-typescript';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);
const parser = new Parser();
parser.setLanguage(TypescriptParser.typescript);

function analyzeCodeTasks(tree) {
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

    const layerInfo = {
        name: '',
        type: '',
        methods: [],
        inheritance: {
            baseClasses: [],
            implements: []
        },
        characteristics: {
            isAbstract: false,
            isAPI: false,
            isMessageHandler: false,
            isParser: false,
            isUtility: false
        },
        complexity: 0
    };

    // Check for .d.ts file characteristics at module level
    const isDeclarationFile = tree.rootNode.text.includes('.d.ts');
    const hasInterfaces = tree.rootNode.descendantsOfType('interface_declaration').length > 0;
    const hasTypeAliases = tree.rootNode.descendantsOfType('type_alias_declaration').length > 0;

    // Handle declaration files at module level
    if (isDeclarationFile || hasInterfaces || hasTypeAliases) {
        const moduleLayerInfo = {...layerInfo};
        moduleLayerInfo.name = 'DeclarationModule';
        moduleLayerInfo.type = 'interface';
        moduleLayerInfo.characteristics.isAbstract = true;
        tasks.features.baseClasses.push(moduleLayerInfo);

        // If this is a declaration file, we can return early as we don't need to process classes
        if (isDeclarationFile) {
            return tasks;
        }
    }


    // Rule 4A: Utility Module Check
const isUtilityModule = (
    tree.rootNode.text.match(/runtime|utils|helpers|shims|parser|version/i) ||  // Added version
    tree.rootNode.descendantsOfType('export_statement')
        .some(node => node.text.match(/function\s+(get|is|has|create|parse|tokenize|format|convert|transform)/)) ||
    tree.rootNode.text.match(/(Util|Helper|Factory|Provider)s?\.ts$/) ||
    // Add check for simple export-only files
    (tree.rootNode.descendantsOfType('export_statement').length > 0)
);


    // Rule 4B: Handle utility modules at module level before processing classes
    if (isUtilityModule && !tree.rootNode.descendantsOfType('class_declaration').length) {
        const moduleLayerInfo = {...layerInfo};
        moduleLayerInfo.name = 'UtilityModule';
        moduleLayerInfo.type = 'utility';
        moduleLayerInfo.characteristics.isUtility = true;
        tasks.features.utilityClasses.push(moduleLayerInfo);
        return tasks;
    }


    // Rule 1: Base/Interface Module Check
    const isBaseInterfaceModule = (
        tree.rootNode.text.includes('.d.ts') ||
        tree.rootNode.text.match(/\b(Base|Abstract|Interface)\b/i) ||
        tree.rootNode.descendantsOfType('interface_declaration').length > 0 ||
        tree.rootNode.descendantsOfType('class_declaration')
            .some(node => {
                const classText = node.text;
                return (
                    classText.includes('abstract class') ||
                    classText.match(/class\s+\w+<[T\w\s,]+>/) ||
                    classText.match(/class\s+(\w+Base|Abstract\w+|Base\w+)/)
                );
            })
    );

    // Rule 2: Core Module Check
    const isCoreModule = (
        tree.rootNode.text.includes('extends APIResource') ||
        tree.rootNode.text.includes('import { APIResource }') ||
        tree.rootNode.text.match(/\/(api|core|resources)\//) ||
        tree.rootNode.descendantsOfType('export_statement')
            .some(node => node.text.match(/class\s+(Message|Stream|Resource|Client|API)/))
    );

    tree.rootNode.descendantsOfType('class_declaration').forEach(classNode => {
        const className = classNode.childForFieldName('name')?.text || 'anonymous';

        // Reset layerInfo for each class
        const newLayerInfo = {...layerInfo, name: className, type: 'class'};

        // Get methods
        newLayerInfo.methods = classNode.descendantsOfType('method_definition')
            .map(method => ({
                name: method.childForFieldName('name')?.text || 'anonymous',
                lineStart: method.startPosition.row + 1,
                lineEnd: method.endPosition.row + 1,
                isVirtual: method.text.includes('virtual') || method.text.includes('abstract')
            }));

        // Get inheritance info
        const extendsClause = classNode.descendantsOfType('extends_clause')[0];
        newLayerInfo.inheritance.baseClasses = extendsClause ?
            [extendsClause.childForFieldName('type')?.text].filter(Boolean) : [];

        const implementsClauses = classNode.descendantsOfType('implements_clause');
        newLayerInfo.inheritance.implements = implementsClauses.map(clause =>
            clause.descendantsOfType('type_identifier')
                .map(type => type.text)
        ).flat();

        // Set characteristics
        newLayerInfo.characteristics.isAbstract = classNode.text.includes('abstract class');
        newLayerInfo.characteristics.isAPI =
            className.endsWith('API') ||
            newLayerInfo.inheritance.baseClasses.some(base => base.includes('API') || base === 'APIResource');
        newLayerInfo.characteristics.isMessageHandler =
            className.match(/(Message|Stream|Resource)s?$/i) ||
            newLayerInfo.inheritance.baseClasses.some(base => base === 'APIResource');
        newLayerInfo.characteristics.isUtility = className.match(/(Util|Helper|Factory|Provider)s?$/);

        // Classification logic following the rules
        if (
            // Rule 1: Base/Interface criteria
            newLayerInfo.characteristics.isAbstract ||
            newLayerInfo.methods.some(m => m.isVirtual) ||
            className.match(/^(Base|Abstract|I)[A-Z]|[A-Z]Base$/) ||
            newLayerInfo.inheritance.implements.length > 0 ||
            isBaseInterfaceModule
        ) {
            tasks.features.baseClasses.push({...newLayerInfo});
        } else if (
            // Rule 2: Core criteria
            (isCoreModule && newLayerInfo.characteristics.isAPI) ||
            newLayerInfo.characteristics.isMessageHandler ||
            newLayerInfo.inheritance.baseClasses.includes('APIResource')
        ) {
            tasks.features.coreClasses.push({...newLayerInfo});
        } else if (
            // Rule 3: Derived criteria
            newLayerInfo.inheritance.baseClasses.length > 0
        ) {
            tasks.features.derivedClasses.push({...newLayerInfo});
        } else if (
            // Rule 4: Utility criteria
            newLayerInfo.characteristics.isUtility ||
            isUtilityModule
        ) {
            tasks.features.utilityClasses.push({...newLayerInfo});
        } else {
            // Default to core if no other rules match
            tasks.features.coreClasses.push({...newLayerInfo});
        }
    });

    return tasks;
}

function calculateLogicTime(tree) {
    let totalMinutes = 0;

    // Analyze if statements
    tree.rootNode.descendantsOfType('if_statement').forEach(node => {
        const lines = node.endPosition.row - node.startPosition.row + 1;
        totalMinutes += lines <= 5 ? 5 : // 5 mins for small blocks
                       lines <= 15 ? 10 : // 10 mins for medium blocks
                       15; // 15 mins for large blocks
    });

    // Analyze loops
    ['for_statement', 'while_statement'].forEach(loopType => {
        tree.rootNode.descendantsOfType(loopType).forEach(node => {
            const lines = node.endPosition.row - node.startPosition.row + 1;
            totalMinutes += lines <= 5 ? 7 : // 7 mins for small loops
                           lines <= 15 ? 12 : // 12 mins for medium loops
                           20; // 20 mins for complex loops
        });
    });

    return totalMinutes / 60; // Convert to hours
}


function analyzeComplexity(filePath, code, tree) {
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
        core: 1.5,      // 1.5 hour base time
        utility: 1,   // 1 hour base time
        base: 0.5,    // 50 minute base time
        derived: 0.25    // 15 minute base time
    };

    const classTimeMetrics = {
        core: 0,
        utility: 0,
        base: 0,
        derived: 0
    };

    // Count different constructs
    tree.rootNode.descendantsOfType('function_declaration').forEach(() => metrics.functions++);
    tree.rootNode.descendantsOfType('class_declaration').forEach(() => metrics.classes++);
    tree.rootNode.descendantsOfType('if_statement').forEach(() => metrics.conditionals++);
    tree.rootNode.descendantsOfType('for_statement').forEach(() => metrics.loops++);
    tree.rootNode.descendantsOfType('while_statement').forEach(() => metrics.loops++);
    tree.rootNode.descendantsOfType('preproc_include').forEach(() => metrics.includes++);


    // Add task analysis
    const taskAnalysis = analyzeCodeTasks(tree);

    Object.values(taskAnalysis.features).flat().forEach(feature => {
        const classLOC = feature.methods.reduce((total, method) =>
            total + (method.lineEnd - method.lineStart + 1), 0);

            const baseLOCTime = (classLOC * 15) / 3600;

            // Determine class type
            const classType = feature.isCore ? 'core' :
                            feature.isUtility ? 'utility' :
                            feature.isBase ? 'base' : 'derived';

            const timeForClass = CLASS_TYPE_TIMES[classType] + baseLOCTime;

            classTimeMetrics[classType] += timeForClass;
        }
    );

    // Adjusted time components
    const headerFileTime = (metrics.loc * 5) / 3600; // 5 seconds per line average
    const logicTime = calculateLogicTime(tree)

    // Additional time components for thorough testing and documentation
    const testingTime = (classTimeMetrics.core + classTimeMetrics.utility) * 0.5;
    const documentationTime = (classTimeMetrics.core + classTimeMetrics.utility) * 0.3;

    // Total estimation
    const totalTime = (
        (headerFileTime || 0) +
        (Object.values(classTimeMetrics).reduce((sum, time) => sum + (time || 0), 0)) +
        (logicTime || 0) +
        (testingTime || 0) +
        (documentationTime || 0)
    ) || 0;

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
        tree: tree
    };
}

function printComplexityReport(moduleMap) {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            .header {
                background-color: #333;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px;
            }
            .file-card {
                background-color: white;
                margin: 15px 0;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .metric {
                margin: 5px 0;
                color: #444;
            }
            .metric strong {
                color: #222;
            }
            .summary {
                background-color: #e0e0e0;
                padding: 20px;
                margin-top: 20px;
                border-radius: 5px;
            }
            .tasks-section {
                margin-top: 15px;
                padding: 10px;
                background-color: #f8f8f8;
            }
            .task-item {
                margin: 5px 0;
                padding: 5px;
                border-left: 3px solid #666;
            }
            .method.virtual {
                color: #0066cc;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Complexity Analysis Report</h1>
            </div>
    `;

    let totalEstimatedTime = {
        hours: 0,
        minutes: 0
    };

    for (const [file, data] of moduleMap) {
        if (data.complexity && data.complexity.estimatedTime) {  // Check if estimatedTime exists
            const {metrics, complexityScore, estimatedTime, tasks} = data.complexity;

            // Add time properly, with fallbacks to 0 if undefined
            totalEstimatedTime.hours += estimatedTime?.hours || 0;
            totalEstimatedTime.minutes += estimatedTime?.minutes || 0;

            // Handle minute overflow
            if (totalEstimatedTime.minutes >= 60) {
                totalEstimatedTime.hours += Math.floor(totalEstimatedTime.minutes / 60);
                totalEstimatedTime.minutes = totalEstimatedTime.minutes % 60;
            }

                html += `
                <div class="file-card">
                    <h2>${path.basename(file)}</h2>
        <div class="metric"><strong>Lines of Code:</strong> ${metrics.loc}</div>
        <div class="metric"><strong>Functions:</strong> ${metrics.functions}</div>
        <div class="metric"><strong>Classes:</strong> ${metrics.classes}</div>
        <div class="metric"><strong>Templates:</strong> ${metrics.templates}</div>
        <div class="metric"><strong>Complexity Score:</strong> ${complexityScore.toFixed(2)}</div>
    <div class="metric"><strong>Estimated Rust Rewrite Time:</strong> ${
        estimatedTime.hours < 1
        ? `${estimatedTime.minutes} minutes`
        : `${estimatedTime.hours} hours${estimatedTime.minutes > 0 ? ` ${estimatedTime.minutes} minutes` : ''}`
    }</div>
                </div>

                <div class="tasks-section">
                    ${tasks.features?.baseClasses?.length > 0 ? `
                        <h3>Base/Interface Classes (${tasks.features.baseClasses.length})</h3>
                        ${tasks.features.baseClasses.map(feature => `
                            <div class="task-item">
                                <strong>${feature.name}</strong>
                                <div class="methods">
                                    ${feature.methods.map(method => `
                                        <div class="method ${method.isVirtual ? 'virtual' : ''}">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    ` : ''}

                    ${tasks.features?.derivedClasses?.length > 0 ? `
                        <h3>Derived Classes (${tasks.features.derivedClasses.length})</h3>
                        ${tasks.features.derivedClasses.map(feature => `
                            <div class="task-item">
                                <strong>${feature.name}</strong> extends ${feature.inheritance.baseClasses.join(', ')}
                                <div class="methods">
                                    ${feature.methods.map(method => `
                                        <div class="method">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    ` : ''}

                    ${tasks.features?.utilityClasses?.length > 0 ? `
                        <h3>Utility Classes (${tasks.features.utilityClasses.length})</h3>
                        ${tasks.features.utilityClasses.map(feature => `
                            <div class="task-item">
                                <strong>${feature.name}</strong>
                                <div class="methods">
                                    ${feature.methods.map(method => `
                                        <div class="method">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    ` : ''}

                    ${tasks.features?.coreClasses?.length > 0 ? `
                        <h3>Core Classes (${tasks.features.coreClasses.length})</h3>
                        ${tasks.features.coreClasses.map(feature => `
                            <div class="task-item">
                                <strong>${feature.name}</strong>
                                <div class="methods">
                                    ${feature.methods.map(method => `
                                        <div class="method">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    ` : ''}

                    ${tasks.topLevelFunctions?.length > 0 ? `
                        <h3>Top-Level Functions (${tasks.topLevelFunctions.length})</h3>
                        ${tasks.topLevelFunctions.map(func => `
                            <div class="task-item">
                                ${func.name} (lines ${func.lineStart}-${func.lineEnd})
                            </div>
                        `).join('')}
                    ` : ''}

                    ${tasks.callbackTasks?.length > 0 ? `
                        <h3>Callback Tasks (${tasks.callbackTasks.length})</h3>
                        ${tasks.callbackTasks.map(callback => `
                            <div class="task-item">
                                Callback in ${callback.parentFunction} (lines ${callback.lineStart}-${callback.lineEnd})
                            </div>
                        `).join('')}
                    ` : ''}
                </div>`;
            }
        }

    html += `
            <div class="summary">
    <h2>Project Summary</h2>
    <div class="metric">
        <strong>Total Estimated Project Rewrite Time:</strong>
        ${totalEstimatedTime.hours} hours ${totalEstimatedTime.minutes} minutes
    </div>
    <div class="metric">
        <strong>Approximately:</strong>
        ${Math.ceil((totalEstimatedTime.hours + (totalEstimatedTime.minutes / 60)) / 40)} work weeks
    </div>
</div>
    </body>
    </html>`;

    if (!fs.existsSync('./viz')) {
        fs.mkdirSync('./viz', { recursive: true });
    }

    fs.writeFileSync('./viz/tasks_complexity_report.html', html);
    console.log(`Report generated: ${path.resolve('./viz/complexity_report.html')}`);
}


function analyzeFeatureComplexity(moduleMap) {
    const featureMap = new Map();

    // First pass: Register all features and their basic structure
    for (const [file, data] of moduleMap) {
        if (!data.complexity?.tree?.rootNode) continue;

        const tree = data.complexity.tree;

        // Analyse methods and inheritance
        tree.rootNode.descendantsOfType('class_declaration').forEach(classNode => {
            const className = classNode.childForFieldName('name')?.text;
            if (!className) return;

            const methods = classNode.descendantsOfType('function_declaration');
            const baseClause = classNode.descendantsOfType('extends_clause')[0];
            const hasVirtualMethods = methods.some(m => m.text.includes('virtual'));

            // Determine class type
            let classType;
            if (baseClause) {
                classType = 'derived';
            } else if (hasVirtualMethods) {
                classType = 'base';
            } else if (className.startsWith('Goo') || className.includes('Utils')) {
                classType = 'utility';
            } else {
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
            classNode.descendantsOfType('extends_clause').forEach(baseClause => {

                // Check for qualified identifiers (like poppler::noncopyable)
                baseClause.descendantsOfType('qualified_identifier').forEach(qualifier => {
                    featureData.metrics.inheritsFrom.add(qualifier.text);
                });

                // Also check for simple identifiers
                baseClause.descendantsOfType('type_identifier').forEach(type => {
                    featureData.metrics.inheritsFrom.add(type.text);
                });
            });

            // Analyze method calls and member variable usage
            classNode.descendantsOfType('field_expression').forEach(fieldExpr => {
                const object = fieldExpr.childForFieldName('argument')?.text;
                if (object && object !== 'this') {
                    featureData.metrics.uses.add(object);
                }
            });

            // Analyze function calls
            classNode.descendantsOfType('call_expression').forEach(callExpr => {
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
        featureData.metrics.inheritsFrom.forEach(baseClass => {
            if (featureMap.has(baseClass)) {
                featureData.metrics.dependencies.add(baseClass);
                featureMap.get(baseClass).metrics.usedBy.add(className);
            }
        });

        // Add used classes as dependencies
        featureData.metrics.uses.forEach(usedClass => {
            if (featureMap.has(usedClass)) {
                featureData.metrics.dependencies.add(usedClass);
                featureMap.get(usedClass).metrics.usedBy.add(className);
            }
        });
    }

    return featureMap;
}


function printFeatureReport(moduleMap) {
    const featureAnalysis = analyzeFeatureComplexity(moduleMap);

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            .header {
                background-color: #333;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px;
            }
            .feature-card {
                background-color: white;
                margin: 15px 0;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .metric {
                margin: 5px 0;
                color: #444;
            }
            .dependencies {
                margin-top: 10px;
                padding: 10px;
                background-color: #f8f8f8;
                border-left: 3px solid #666;
            }
            .occurrences {
                margin-top: 10px;
                color: #666;
                font-style: italic;
            }
            .metric-list {
                margin-top: 10px;
                padding-left: 20px;
            }
            .relationship {
                margin: 10px 0;
                padding: 10px;
                background-color: #f0f0f0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Feature Analysis Report</h1>
            </div>
    `;

    // Generate report for each feature
    for (const [featureName, feature] of featureAnalysis) {
        // Check if there are inheritance relationships
        const hasInheritance = feature.metrics.inheritsFrom.size > 0;

        // Check if there are any dependencies
        const hasDependencies = feature.metrics.uses.size > 0 || feature.metrics.usedBy.size > 0;

        html += `
            <div class="feature-card">
                <h2>${feature.name}</h2>
                <div class="metric"><strong>Type:</strong> ${feature.type}</div>
                <div class="metric"><strong>Total Methods:</strong> ${feature.totalMethods}</div>

                ${hasInheritance ? `
                    <div class="relationship">
                        <h3>Inheritance</h3>
                        <div><strong>Inherits From:</strong> ${Array.from(feature.metrics.inheritsFrom).join(', ')}</div>
                    </div>
                ` : ''}

                ${hasDependencies ? `
                    <div class="relationship">
                        <h3>Dependencies</h3>
                        ${feature.metrics.uses.size > 0 ? `
                            <div><strong>Uses:</strong> ${Array.from(feature.metrics.uses).join(', ')}</div>
                        ` : ''}
                        ${feature.metrics.usedBy.size > 0 ? `
                            <div><strong>Used By:</strong> ${Array.from(feature.metrics.usedBy).join(', ')}</div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="occurrences">
                    <h3>Found in Files:</h3>
                    ${feature.occurrences.map(file => `
                        <div>${path.basename(file)}</div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += `
        </div>
    </body>
    </html>`;

    if (!fs.existsSync('./viz')) {
        fs.mkdirSync('./viz', { recursive: true });
    }

    fs.writeFileSync('./viz/feature_report.html', html);
    console.log(`Feature report generated: ${path.resolve('./viz/feature_report.html')}`);
}

function analyzeTSDependencies(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf-8');
        if (!code || code.length === 0) {
            return {
                error: 'Empty file',
                imports: [],
                dependencies: [],
                complexity: null
            };
        }

        const dependencies = {
            imports: [],
            dependencies: [],
            complexity: null
        };

        try {
            const tree = parser.parse(code);


            // Analyze imports and requires
            tree.rootNode.descendantsOfType('import_statement').forEach(node => {

                const source = node.childForFieldName('source');
                if (source) {
                    const importPath = source.text.replace(/['"]/g, '');
                    // Only add import if the file exists in the local repo
                    const fullPath = path.resolve(path.dirname(filePath), importPath + '.ts');
                    if (fs.existsSync(fullPath) || fs.existsSync(fullPath.replace('.ts', '.d.ts'))) {
                        dependencies.imports.push(importPath);
                    }
                }
            });


            // Also check for require statements
            tree.rootNode.descendantsOfType('call_expression').forEach(node => {
                if (node.childForFieldName('function')?.text === 'require') {
                    const args = node.childForFieldName('arguments');
                    if (args?.firstChild) {
                        const requirePath = args.firstChild.text.replace(/['"]/g, '');
                        const fullPath = path.resolve(path.dirname(filePath), requirePath + '.ts');
                        if (fs.existsSync(fullPath) || fs.existsSync(fullPath.replace('.ts', '.d.ts'))) {
                            dependencies.imports.push(requirePath);
                        }
                    }
                }
            });


            // Add complexity analysis
            dependencies.complexity = analyzeComplexity(filePath, code, tree);

        } catch (parseError) {
            // Fallback to regex for imports if parsing fails
            const importRegex = /import .+ from ['"]([^'"]+)['"]/g;
            const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

            let match;
            while ((match = importRegex.exec(code)) !== null) {
                dependencies.imports.push(match[1]);
            }
            while ((match = requireRegex.exec(code)) !== null) {
                dependencies.imports.push(match[1]);
            }

            // Basic complexity metrics for fallback
            dependencies.complexity = {
                metrics: {
                    loc: code.split('\n').length,
                    functions: 0,
                    classes: 0,
                    interfaces: 0,
                    conditionals: 0,
                    loops: 0,
                    imports: dependencies.imports.length
                },
                complexityScore: code.split('\n').length / 10,
                estimatedHours: Math.ceil(code.split('\n').length / 25),
                tasks: {
                    topLevelFunctions: [],
                    callbackTasks: [],
                    features: {
                        baseClasses: [],
                        derivedClasses: [],
                        utilityClasses: [],
                        coreClasses: []
                    }
                }
            };
        }

        return dependencies;
    } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error);
        return {
            error: error.message,
            imports: [],
            dependencies: [],
            complexity: null
        };
    }
}


function createDependencyDot(moduleMap) {
    let dot = 'digraph Dependencies {\n';
    dot += '  node [shape=box];\n';

    // Create a new Map with analyzed dependencies
    const analyzedMap = new Map();
    for (const [file, data] of moduleMap) {
        const analysis = analyzeTSDependencies(file);
        analyzedMap.set(file, analysis);
    }

    // Add nodes with layer information
    for (const [file, data] of analyzedMap) {
        const nodeName = path.basename(file);
        const tasks = data.complexity?.tasks;

        // Determine layer based on file contents
        let layer = "unknown";
        if (tasks?.features) {
            if (tasks.features.coreClasses?.length > 0) {
                layer = "core";
            } else if (tasks.features.baseClasses?.length > 0) {
                layer = "interface";
            } else if (tasks.features.derivedClasses?.length > 0) {
                layer = "derived";
            } else if (tasks.features.utilityClasses?.length > 0) {
                layer = "utility";
            }
        }

        dot += `  "${nodeName}" [label="${nodeName}", layer="${layer}"];\n`;
    }

    // Add edges using the analyzed dependencies
    for (const [file, data] of analyzedMap) {
        const sourceNode = path.basename(file);
        if (data.imports && Array.isArray(data.imports)) {
            data.imports.forEach(importPath => {
                const targetNode = path.basename(importPath)
                    .replace(/\.ts$/, '')  // Remove .ts extension if present
                    .replace(/['"]/, '')   // Remove any quotes
                    + '.ts';  // Add .ts extension back

                dot += `  "${sourceNode}" -> "${targetNode}";\n`;
            });
        }
    }

    dot += '}';
    return dot;
}



async function generateGraph(moduleMap) {
    const dot = createDependencyDot(moduleMap);

    // Save DOT file
    await fs.promises.writeFile('rwcdependencies.dot', dot);

    try {
        // Check if dot (Graphviz) is installed
        await exec('dot -V');

        // Generate both formats concurrently
        await Promise.all([
            exec('dot -Tsvg rwcdependencies.dot -o ./viz/rwcdependencies.svg'),
            exec('dot -Tpng rwcdependencies.dot -o ./viz/rwcdependencies.png')
        ]);

        console.log('Successfully generated graph files');
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('Graphviz (dot) is not installed. Please install Graphviz first.');
        }
        throw error;
    }
}

function walkDirectory(dir) {
    const moduleMap = new Map();
    const chunkSize = 30000; // Adjust this value as needed

    function walk(currentDir) {
        try {
            const files = fs.readdirSync(currentDir);

            for (const file of files) {
                const fullPath = path.join(currentDir, file);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    walk(fullPath);
                } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                    try {
                        const code = fs.readFileSync(fullPath, 'utf-8');

                        if (!code || typeof code !== 'string') {
                            console.warn(`Skipping ${fullPath}: Invalid or empty file content`);
                            continue;
                        }

                        if (code.length > chunkSize) {
                            console.log(`Reading file content for: ${fullPath}`);
                            const chunks = [];
                            for (let i = 0; i < code.length; i += chunkSize) {
                                chunks.push(code.slice(i, i + chunkSize));
                            }

                            const trees = [];
                            const complexities = [];

                            for (const [index, chunk] of chunks.entries()) {
                                try {
                                    const tree = parser.parse(chunk);
                                    trees.push(tree);
                                    complexities.push(analyzeComplexity(fullPath, chunk, tree));
                                } catch (parseError) {
                                    console.error(`Parse error in ${fullPath} (chunk ${index}):`, parseError.message);
                                    trees.push(null);
                                    complexities.push(null);
                                }
                            }

                            moduleMap.set(fullPath, {
                                code,
                                trees,
                                complexity: combineComplexities(complexities)
                            });
                        } else {
                            // Normal parsing for smaller files
                            try {
                                const tree = parser.parse(code);
                                moduleMap.set(fullPath, {
                                    code,
                                    tree,
                                    complexity: analyzeComplexity(fullPath, code, tree)
                                });
                            } catch (parseError) {
                                console.error(`Parse error in ${fullPath}:`, parseError.message);
                                // Add basic entry for failed parse
                                moduleMap.set(fullPath, {
                                    code,
                                    tree: null,
                                    complexity: {
                                        metrics: {
                                            loc: code.split('\n').length,
                                            functions: 0,
                                            classes: 0,
                                            templates: 0,
                                            conditionals: 0,
                                            loops: 0,
                                            includes: 0
                                        },
                                        complexityScore: 0,
                                        estimatedTime: { hours: 0, minutes: 0 },
                                        tasks: {
                                            topLevelFunctions: [],
                                            callbackTasks: [],
                                            features: {
                                                baseClasses: [],
                                                derivedClasses: [],
                                                utilityClasses: [],
                                                coreClasses: []
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    } catch (fileError) {
                        console.error(`Error processing ${fullPath}:`, fileError);
                    }
                }
            }
        } catch (dirError) {
            console.error(`Error reading directory ${currentDir}:`, dirError);
        }
    }

    function combineComplexities(complexities) {
        const combinedComplexity = {
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
            estimatedTime: { hours: 0, minutes: 0 },
            tasks: {
                topLevelFunctions: [],
                callbackTasks: [],
                features: {
                    baseClasses: [],
                    derivedClasses: [],
                    utilityClasses: [],
                    coreClasses: []
                }
            }
        };

        for (const complexity of complexities) {
            if (complexity) {
                combinedComplexity.metrics.loc += complexity.metrics.loc;
                combinedComplexity.metrics.functions += complexity.metrics.functions;
                combinedComplexity.metrics.classes += complexity.metrics.classes;
                combinedComplexity.metrics.templates += complexity.metrics.templates;
                combinedComplexity.metrics.conditionals += complexity.metrics.conditionals;
                combinedComplexity.metrics.loops += complexity.metrics.loops;
                combinedComplexity.metrics.includes += complexity.metrics.includes;
                combinedComplexity.complexityScore += complexity.complexityScore;
                combinedComplexity.estimatedTime.hours += complexity.estimatedTime.hours;
                combinedComplexity.estimatedTime.minutes += complexity.estimatedTime.minutes;
                combinedComplexity.tasks.topLevelFunctions = combinedComplexity.tasks.topLevelFunctions.concat(complexity.tasks.topLevelFunctions);
                combinedComplexity.tasks.callbackTasks = combinedComplexity.tasks.callbackTasks.concat(complexity.tasks.callbackTasks);
                combinedComplexity.tasks.features.baseClasses = combinedComplexity.tasks.features.baseClasses.concat(complexity.tasks.features.baseClasses);
                combinedComplexity.tasks.features.derivedClasses = combinedComplexity.tasks.features.derivedClasses.concat(complexity.tasks.features.derivedClasses);
                combinedComplexity.tasks.features.utilityClasses = combinedComplexity.tasks.features.utilityClasses.concat(complexity.tasks.features.utilityClasses);
                combinedComplexity.tasks.features.coreClasses = combinedComplexity.tasks.features.coreClasses.concat(complexity.tasks.features.coreClasses);
            }
        }

        return combinedComplexity;
    }

    try {
        if (!fs.existsSync(dir)) {
            throw new Error(`Directory ${dir} does not exist`);
        }
        walk(dir);
    } catch (error) {
        console.error('Fatal error in walkDirectory:', error);
    }

    return moduleMap;
}



const moduleRelationships = walkDirectory('./src');
generateGraph(moduleRelationships);
printComplexityReport(moduleRelationships);
printFeatureReport(moduleRelationships);

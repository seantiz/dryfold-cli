import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { analyseFeatureComplexity } from '../analyse/complexity';
const exec = promisify(execCallback);
export function printComplexityReport(moduleMap) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
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
        if (data.complexity && data.complexity.estimatedTime) {
            // Check if estimatedTime exists
            const { metrics, complexityScore, estimatedTime, tasks } = data.complexity;
            // Add time properly, with fallbacks to 0 if undefined
            totalEstimatedTime.hours += (estimatedTime === null || estimatedTime === void 0 ? void 0 : estimatedTime.hours) || 0;
            totalEstimatedTime.minutes += (estimatedTime === null || estimatedTime === void 0 ? void 0 : estimatedTime.minutes) || 0;
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
        <div class="metric"><strong>Estimated Rust Rewrite Time:</strong> ${totalEstimatedTime.hours < 1
                ? `${totalEstimatedTime.minutes} minutes`
                : `${totalEstimatedTime.hours} hours${totalEstimatedTime.minutes > 0 ? ` ${totalEstimatedTime.minutes} minutes` : ''}`}</div>
                </div>

                <div class="tasks-section">
                    ${((_b = (_a = tasks.features) === null || _a === void 0 ? void 0 : _a.baseClasses) === null || _b === void 0 ? void 0 : _b.length) > 0
                ? `
                        <h3>Base/Interface Classes (${tasks.features.baseClasses.length})</h3>
                        ${tasks.features.baseClasses
                    .map((feature) => `
                            <div class="task-item">
                                <strong>${feature.name}</strong>
                                <div class="methods">
                                    ${feature.methods
                    .map((method) => `
                                        <div class="method ${method.isVirtual ? 'virtual' : ''}">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `)
                    .join('')}
                                </div>
                            </div>
                        `)
                    .join('')}
                    `
                : ''}

                    ${((_d = (_c = tasks.features) === null || _c === void 0 ? void 0 : _c.derivedClasses) === null || _d === void 0 ? void 0 : _d.length) > 0
                ? `
                        <h3>Derived Classes (${tasks.features.derivedClasses.length})</h3>
                        ${tasks.features.derivedClasses
                    .map((feature) => `
                            <div class="task-item">
                                <strong>${feature.name}</strong> extends ${feature.baseClasses.join(', ')}
                                <div class="methods">
                                    ${feature.methods
                    .map((method) => `
                                        <div class="method">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `)
                    .join('')}
                                </div>
                            </div>
                        `)
                    .join('')}
                    `
                : ''}

                    ${((_f = (_e = tasks.features) === null || _e === void 0 ? void 0 : _e.utilityClasses) === null || _f === void 0 ? void 0 : _f.length) > 0
                ? `
                        <h3>Utility Classes (${tasks.features.utilityClasses.length})</h3>
                        ${tasks.features.utilityClasses
                    .map((feature) => `
                            <div class="task-item">
                                <strong>${feature.name}</strong>
                                <div class="methods">
                                    ${feature.methods
                    .map((method) => `
                                        <div class="method">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `)
                    .join('')}
                                </div>
                            </div>
                        `)
                    .join('')}
                    `
                : ''}

                    ${((_h = (_g = tasks.features) === null || _g === void 0 ? void 0 : _g.coreClasses) === null || _h === void 0 ? void 0 : _h.length) > 0
                ? `
                        <h3>Core Classes (${tasks.features.coreClasses.length})</h3>
                        ${tasks.features.coreClasses
                    .map((feature) => `
                            <div class="task-item">
                                <strong>${feature.name}</strong>
                                <div class="methods">
                                    ${feature.methods
                    .map((method) => `
                                        <div class="method">
                                            ${method.name} (lines ${method.lineStart}-${method.lineEnd})
                                        </div>
                                    `)
                    .join('')}
                                </div>
                            </div>
                        `)
                    .join('')}
                    `
                : ''}

                    ${((_j = tasks.topLevelFunctions) === null || _j === void 0 ? void 0 : _j.length) > 0
                ? `
                        <h3>Top-Level Functions (${tasks.topLevelFunctions.length})</h3>
                        ${tasks.topLevelFunctions
                    .map((func) => `
                            <div class="task-item">
                                ${func.name} (lines ${func.lineStart}-${func.lineEnd})
                            </div>
                        `)
                    .join('')}
                    `
                : ''}

                    ${((_k = tasks.callbackTasks) === null || _k === void 0 ? void 0 : _k.length) > 0
                ? `
                        <h3>Callback Tasks (${tasks.callbackTasks.length})</h3>
                        ${tasks.callbackTasks
                    .map((callback) => `
                            <div class="task-item">
                                Callback in ${callback.parentFunction} (lines ${callback.lineStart}-${callback.lineEnd})
                            </div>
                        `)
                    .join('')}
                    `
                : ''}
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
        ${Math.ceil((totalEstimatedTime.hours + totalEstimatedTime.minutes / 60) / 40)} work weeks
    </div>
</div>
    </body>
    </html>`;
    fs.writeFileSync('./viz/tasks_complexity_report.html', html);
    console.log(`Report generated: ${path.resolve('./viz/complexity_report.html')}`);
}
export function printFeatureReport(moduleMap) {
    const featureAnalysis = analyseFeatureComplexity(moduleMap);
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

                ${hasInheritance
            ? `
                    <div class="relationship">
                        <h3>Inheritance</h3>
                        <div><strong>Inherits From:</strong> ${Array.from(feature.metrics.inheritsFrom).join(', ')}</div>
                    </div>
                `
            : ''}

                ${hasDependencies
            ? `
                    <div class="relationship">
                        <h3>Dependencies</h3>
                        ${feature.metrics.uses.size > 0
                ? `
                            <div><strong>Uses:</strong> ${Array.from(feature.metrics.uses).join(', ')}</div>
                        `
                : ''}
                        ${feature.metrics.usedBy.size > 0
                ? `
                            <div><strong>Used By:</strong> ${Array.from(feature.metrics.usedBy).join(', ')}</div>
                        `
                : ''}
                    </div>
                `
            : ''}

                <div class="occurrences">
                    <h3>Found in Files:</h3>
                    ${feature.occurrences
            .map((file) => `
                        <div>${path.basename(file)}</div>
                    `)
            .join('')}
                </div>
            </div>
        `;
    }
    html += `
        </div>
    </body>
    </html>`;
    fs.writeFileSync('./viz/feature_report.html', html);
    console.log(`Feature report generated: ${path.resolve('./viz/feature_report.html')}`);
}
export async function generateGraphs(moduleMap) {
    const dot = createDependencyDot(moduleMap);
    // Save DOT file
    await fs.promises.writeFile('rwcdependencies.dot', dot);
    try {
        // Generate both formats concurrently
        await Promise.all([
            exec('dot -Tsvg rwcdependencies.dot -o ./viz/rwcdependencies.svg'),
            exec('dot -Tpng rwcdependencies.dot -o ./viz/rwcdependencies.png')
        ]);
        console.log('Successfully generated graph files');
    }
    catch (error) {
        throw error;
    }
}
function createDependencyDot(moduleMap) {
    var _a, _b, _c, _d, _e;
    let dot = 'digraph Dependencies {\n';
    dot += '  node [shape=box];\n';
    // Add nodes with layer information
    for (const [file, data] of moduleMap) {
        const nodeName = path.basename(file);
        const tasks = (_a = data.complexity) === null || _a === void 0 ? void 0 : _a.tasks;
        // Determine layer based on file contents
        let layer = 'unknown';
        if (tasks === null || tasks === void 0 ? void 0 : tasks.features) {
            if (((_b = tasks.features.coreClasses) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                layer = 'core';
            }
            else if (((_c = tasks.features.baseClasses) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                layer = 'interface';
            }
            else if (((_d = tasks.features.derivedClasses) === null || _d === void 0 ? void 0 : _d.length) > 0) {
                layer = 'derived';
            }
            else if (((_e = tasks.features.utilityClasses) === null || _e === void 0 ? void 0 : _e.length) > 0) {
                layer = 'utility';
            }
        }
        dot += `  "${nodeName}" [label="${nodeName}", layer="${layer}"];\n`;
    }
    // Add edges
    for (const [file, deps] of moduleMap) {
        const sourceNode = path.basename(file);
        if (deps.includes) {
            deps.includes.forEach((include) => {
                const includeName = include.replace(/#include\s*[<"]([^>"]+)[>"]/g, '$1');
                dot += `  "${sourceNode}" -> "${path.basename(includeName)}";\n`;
            });
        }
    }
    dot += '}';
    return dot;
}

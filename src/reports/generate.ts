import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { findDesign } from '../analyse/design';
import {
  formatEstimatedTime,
  generateMethodList,
  generateCards,
  generateLayerSummary
} from './helpers';
import type { ComplexityValues, DesignValues, KanriCard } from '../analyse/schema';

const exec = promisify(execCallback);

export function printComplexityReport(moduleMap: Map<string, ComplexityValues>) {
  const styling = '../src/reports/styles/complexity.css';
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <link rel="stylesheet" href="${styling}">
    </head>
    <body>
        <div class="container">
            <h1>Complexity Analysis Report</h1>`;

  let totalEstimatedTime = {
    hours: 0,
    minutes: 0
  };

  for (const [file, data] of moduleMap) {
    if (data.complexity?.estimatedTime) {
      const { metrics, complexityScore, estimatedTime, methods } = data.complexity;

      // Update total time
      totalEstimatedTime.hours += estimatedTime?.hours || 0;
      totalEstimatedTime.minutes += estimatedTime?.minutes || 0;

      if (totalEstimatedTime.minutes >= 60) {
        totalEstimatedTime.hours += Math.floor(totalEstimatedTime.minutes / 60);
        totalEstimatedTime.minutes = totalEstimatedTime.minutes % 60;
      }

      html += `
                <div class="file-card">
                    <h2>${path.basename(file)}</h2>
                    <div class="metrics">
                        <div class="metric">Lines: ${metrics.loc}</div>
                        <div class="metric">Complexity: ${
                          metrics.conditionals + metrics.loops || 'N/A'
                        }</div>
                        <div class="metric">Functions: ${metrics.functions}</div>
                        <div class="metric">Score: ${complexityScore.toFixed(2)}</div>
                        <div class="metric">Est. Time: ${formatEstimatedTime(estimatedTime)}</div>
                    </div>`
                    if(methods.localFunctions.length > 0 || methods.callbacks.length > 0) {
                        html += `
                            <div>
                                <h3>Methods Used</h3>
                                ${generateMethodList(methods)}
                            </div>`;
                    }
                }

      html += `</div>`;
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
                ${Math.ceil(
                  (totalEstimatedTime.hours + totalEstimatedTime.minutes / 60) / 40
                )} work weeks
            </div>
        </div>
    </body>
    </html>`;

    if(!fs.existsSync('./allreports'))
        fs.mkdirSync('./allreports', { recursive: true} )

    fs.writeFileSync('./allreports/tasks_complexity_report.html', html);
    console.log(`Report generated: ${path.resolve('./allreports/complexity_report.html')}`);
}

export function printFeatureReport(moduleMap: Map<string, DesignValues>) {
    const { dot, unknownLayers } = createDependencyDot(moduleMap);
    const styling = '../src/reports/styles/features.css';

    const unknownLayersSection = unknownLayers.length ? `
        <div class="warning-section">
            <h2>⚠️ Unclassified Modules</h2>
            <p>The following ${unknownLayers.length} modules need architectural classification:</p>
            <ul>
                ${unknownLayers.map(name => `<li>${name}</li>`).join('\n')}
            </ul>
        </div>
    ` : '';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="stylesheet" href="${styling}">
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Feature Analysis Report</h1>
                </div>
                ${unknownLayersSection}
                <div class="architecture-overview">
                    <h2>System Architecture Overview</h2>
                    <div class="layer-breakdown">
                        ${generateLayerSummary(moduleMap)}
                    </div>
                </div>
                ${generateCards(moduleMap)}
            </div>
        </body>
        </html>
    `;

    if(!fs.existsSync('./allreports'))
        fs.mkdirSync('./allreports', { recursive: true} )

    fs.writeFileSync('./allreports/features_report.html', html);
    console.log(`Report generated: ${path.resolve('./allreports/features_report.html')}`);
}

export async function generateGraphs(moduleMap: Map<string, DesignValues>) {
    const { dot } = createDependencyDot(moduleMap);

    await fs.promises.mkdir('./allreports', { recursive: true });

    try {
        await fs.promises.writeFile('./allreports/dependencygraph.dot', dot);

        await Promise.all([
            exec('dot -Tsvg ./allreports/dependencygraph.dot -o ./allreports/dependencies.svg'),
            exec('dot -Tpng ./allreports/dependencygraph.dot -o ./allreports/dependencies.png')
        ]);
        console.log('Successfully generated graph files');
    }
    catch (error) {
        throw error;
    }
}

function createDependencyDot(moduleMap: Map<string, DesignValues>) {
    let dot = 'digraph Dependencies {\n';
    dot += '  node [shape=box];\n';

    // Track files with known and unknown layers
    const unknownLayers = new Set<string>();
    const knownNodes = new Set<string>();

    // First pass - collect nodes with known layers
    for (const [file, data] of moduleMap) {
        const nodeName = path.basename(file);
        const className = nodeName.replace('.h', '');

        const layer = (() => {
            const relationships = data.moduleRelationships;
            if (!relationships || !relationships[className]) {
                unknownLayers.add(nodeName);
                return 'unknown';
            }
            return relationships[className].type || 'unknown';
        })();

        if (layer !== 'unknown') {
            knownNodes.add(nodeName);
            dot += `  "${nodeName}" [label="${nodeName}", layer="${layer}"];\n`;
        }
    }

    // Only add edges between known nodes
    for (const [file, data] of moduleMap) {
        const sourceNode = path.basename(file);
        if (!knownNodes.has(sourceNode) || !data.includes) continue;

        data.includes.forEach((include) => {
            const includeName = path.basename(include.replace(/#include\s*[<"]([^>"]+)[>"]/g, '$1'));
            if (knownNodes.has(includeName)) {
                dot += `  "${sourceNode}" -> "${includeName}";\n`;
            }
        });
    }

    // Add comment listing unknown layers
    if (unknownLayers.size > 0) {
        dot += '\n  /* Modules with unknown layers:\n';
        Array.from(unknownLayers).sort().forEach(name => {
            dot += `   * ${name.replace('.h', '')}\n`;
        });
        dot += '  */\n';
    }

    dot += '}';

    return {
        dot,
        unknownLayers: Array.from(unknownLayers)
    };
}



export function generateGHTasks(moduleMap: Map<string, DesignValues>) {
    // Original functionality starts here
    if(!fs.existsSync('./allreports')) {
        fs.mkdirSync('./allreports', { recursive: true })
    }

    let tsvContent = 'Title\tType\tComplexity\tEstimatedTime\tDependencies\n'

    for (const [file, data] of moduleMap) {
        if (!data.moduleRelationships) continue

        Object.entries(data.moduleRelationships).forEach(([moduleName, moduleData]) => {
            const dependencies = moduleData.relationships.uses?.join(', ') || ''
            const estimatedTime = data.complexity?.estimatedTime
                ? `${data.complexity.estimatedTime.hours}h ${data.complexity.estimatedTime.minutes}m`
                : 'Unknown'
            const complexity = data.complexity?.complexityScore?.toFixed(2) || 'Unknown'

            tsvContent += `${moduleName}\t${moduleData.type}\t${complexity}\t${estimatedTime}\t${dependencies}\n`
        })
    }

    fs.writeFileSync('./allreports/module_tasks.tsv', tsvContent)
    console.log(`Tasks preadsheet generated: ${path.resolve('./allreports/module_tasks.tsv')}`)
}

export function generateKanriJSON(moduleMap: Map<string, DesignValues>): KanriCard[] {
    // Sort by descending complexity score
    const sortedModules = Array.from(moduleMap.entries())
        .sort((a, b) => {
            const scoreA = a[1].complexity?.complexityScore || 0;
            const scoreB = b[1].complexity?.complexityScore || 0;
            return scoreB - scoreA;
        });

    const startDate = new Date();
    let currentDate = new Date(startDate);

    return sortedModules.map(([filePath, data]) => {
        // Calculate due date based on estimated time
        if (data.complexity?.estimatedTime) {
            const { hours = 0, minutes = 0 } = data.complexity.estimatedTime;
            currentDate.setHours(currentDate.getHours() + hours);
            currentDate.setMinutes(currentDate.getMinutes() + minutes);
        }

        const kanriCard: KanriCard = {
            name: `${filePath}`,
            description: `Complexity Score: ${data.complexity?.complexityScore}`,
            dueDate: currentDate.toISOString(),
            tasks: [{
                finished: false,
                name: `Rewrite ${filePath}`,
            }],
            tags: []
        };

        currentDate = new Date(currentDate);

        return kanriCard;
    });
}


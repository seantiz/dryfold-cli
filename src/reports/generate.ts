import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { analyseFeatureComplexity } from '../analyse/complexity';
import {
  formatEstimatedTime,
  generateMethodList,
  generateCards,
  generateLayerSummary
} from './helpers';
import type { MapValues } from '../analyse/schema';

const exec = promisify(execCallback);

export function printComplexityReport(moduleMap: Map<string, MapValues>) {
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
      const { metrics, complexityScore, estimatedTime, tasks } = data.complexity;

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
                    </div>
                    <div class="implementation-details">
                        <h3>Implementation Breakdown</h3>
                        ${generateMethodList(tasks.topLevelFunctions, 'Functions')}
                        ${generateMethodList(tasks.callbackTasks, 'Callbacks')}
                    </div>
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

export function printFeatureReport(moduleMap: Map<string, MapValues>) {
    const featureAnalysis = analyseFeatureComplexity(moduleMap);
    const styling = '../src/reports/styles/features.css';

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
                <div class="architecture-overview">
                    <h2>System Architecture Overview</h2>
                    <div class="layer-breakdown">
                        ${generateLayerSummary(featureAnalysis)}
                    </div>
                </div>
                ${generateCards(featureAnalysis)}
            </div>
        </body>
        </html>
    `;

    if(!fs.existsSync('./allreports'))
        fs.mkdirSync('./allreports', { recursive: true} )

    fs.writeFileSync('./allreports/features_report.html', html);
    console.log(`Report generated: ${path.resolve('./allreports/features_report.html')}`);
}

export async function generateGraphs(moduleMap: Map<string, MapValues>) {
    const dot = createDependencyDot(moduleMap);

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

function createDependencyDot(moduleMap: Map<string, MapValues>) {
  let dot = 'digraph Dependencies {\n';
  dot += '  node [shape=box];\n';

  // Add nodes with layer information
  for (const [file, data] of moduleMap) {
    const nodeName = path.basename(file);
    const tasks = data.complexity?.tasks;

    // Determine layer based on file contents
    let layer = 'unknown';
    if (tasks?.features) {
      if (tasks.features.coreClasses?.length > 0) {
        layer = 'core';
      } else if (tasks.features.baseClasses?.length > 0) {
        layer = 'interface';
      } else if (tasks.features.derivedClasses?.length > 0) {
        layer = 'derived';
      } else if (tasks.features.utilityClasses?.length > 0) {
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

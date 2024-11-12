import path from 'path'
import fs from 'fs'
import type { ComplexityValues } from "../schema";
import { formatEstimatedTime, generateMethodList } from "./utils";

export function printComplexityReport(moduleMap: Map<string, ComplexityValues>) {
    const styling = '../src/export/styles/complexity.css';
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
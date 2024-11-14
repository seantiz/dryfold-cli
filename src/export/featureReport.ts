import fs from 'fs'
import path from 'path'
import type { DesignValues } from '../schema'
import { generateCards, generateLayerSummary } from './utils'
import { createDot } from './core'

export function printFeatureReport(moduleMap: Map<string, DesignValues>) {
    try {
        const { unknownLayers } = createDot(moduleMap)
        const styling = '../src/export/styles/features.css'

        let svg = ''
        const svgFromData = './allreports/dependencies.svg'
        if (fs.existsSync(svgFromData)) {
            svg = fs.readFileSync(svgFromData, 'utf-8')
        } else {
            svg = "No renderable content"
        }

        const unknownLayersSection = unknownLayers.length ? `
        <div class="warning-section">
            <h2>⚠️ Unclassified Modules</h2>
            <p>The following ${unknownLayers.length} modules need architectural classification:</p>
            <ul>
                ${unknownLayers.map(name => `<li>${name}</li>`).join('\n')}
            </ul>
        </div>
    ` : ''

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
                    <div class="dependency-graph">
                        ${svg}
                    </div>
                    <div class="layer-breakdown">
                        ${generateLayerSummary(moduleMap)}
                    </div>
                </div>
                ${generateCards(moduleMap)}
            </div>
        </body>
        </html>
    `

        if (!fs.existsSync('./allreports'))
            fs.mkdirSync('./allreports', { recursive: true })

        fs.writeFileSync('./allreports/features_report.html', html)
    } catch (error) {
        throw error
    }
}

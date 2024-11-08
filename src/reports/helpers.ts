import type { ModuleMapValues, LayerType, ClassData } from "../analyse/schema"
import path from 'path'

// Complexity helper functions

export function formatEstimatedTime(time: { hours: number; minutes: number }): string {
    if (time.hours < 1) {
        return `${time.minutes} minutes`
    }
    return `${time.hours} hours${time.minutes > 0 ? ` ${time.minutes} minutes` : ''}`
}

export function generateMethodList(methods: any[], title: string): string {
    if (!methods?.length) return ''
    return `
        <div class="method-list">
            <h4>${title} (${methods.length})</h4>
            ${methods.map(method => `
                <div class="method-item">
                    <span class="name">${method.name}</span>
                    <span class="lines">(${method.lineStart}-${method.lineEnd})</span>
                    ${method.complexity ? `<span class="complexity">Complexity: ${method.complexity}</span>` : ''}
                </div>
            `).join('')}
        </div>
    `
}

// Feature Report Helper Functions
export function generateLayerSummary(moduleMap: Map<string, ModuleMapValues>): string {
    const layers: Record<LayerType, Set<string>> = {
        core: new Set<string>(),
        interface: new Set<string>(),
        derived: new Set<string>(),
        utility: new Set<string>()
    }

    for (const [_, data] of moduleMap) {
        if (!data.complexity?.classRelationships) continue

        Object.entries(data.complexity.classRelationships).forEach(([className, classData]) => {
            console.log('Processing class:', className, 'type:', classData.type);
            if (classData.type) {
                layers[classData.type].add(className)
            }
        })
    }

    return `
        <div class="layer-summary">
            ${Object.entries(layers).map(([layer, components]) => `
                <div class="layer-group">
                    <h3>${layer.charAt(0).toUpperCase() + layer.slice(1)} Layer</h3>
                    <div class="components">
                        ${Array.from(components).join(', ') || 'None'}
                    </div>
                </div>
            `).join('')}
        </div>
    `
}

function generatePublicInterface(classData: ClassData): string {
    if (!classData.methods?.length) return ''

    return `
        <div class="public-interface">
            ${classData.methods
            .filter(method => method.visibility === 'public')
            .map(method => `
                    <div class="interface-method">
                        <span class="signature">${method.name}</span>
                        ${method.parameters ? `
                            <span class="parameters">(${method.parameters.join(', ')})</span>
                        ` : '()'}
                        ${method.returnType ? `
                            <span class="return-type">: ${method.returnType}</span>
                        ` : ''}
                    </div>
                `).join('')}
        </div>
    `
}

function generateGraphSection(className: string, classData: ClassData) {
    if (!classData.metrics) return ''

    const { metrics } = classData
    const graphs = []

    if (metrics.inheritsFrom?.length) {
        graphs.push(`
            <div class="inheritance-graph">
                <h4>Inheritance Hierarchy</h4>
                <div class="hierarchy">
                    <div class="base-classes">${metrics.inheritsFrom.join(' → ')}</div>
                    <div class="current-class">↳ ${className}</div>
                </div>
            </div>
        `)
    }

    if (metrics.uses?.length || metrics.usedBy?.length) {
        graphs.push(`
            <div class="dependency-graph">
                <h4>Dependencies</h4>
                ${metrics.uses?.length ? `<div class="outgoing"><strong>Outgoing:</strong> ${metrics.uses.join(' → ')}</div>` : ''}
                ${metrics.usedBy?.length ? `<div class="incoming"><strong>Incoming:</strong> ${metrics.usedBy.join(' → ')}</div>` : ''}
            </div>
        `)
    }

    return graphs.join('')
}

export function generateCards(moduleMap: Map<string, ModuleMapValues>): string {
    const cards: string[] = []

    for (const [_, data] of moduleMap) {
        if (!data.complexity?.classRelationships) continue

        Object.entries(data.complexity.classRelationships).forEach(([className, classData]) => {
            cards.push(`
                <div class="feature-card">
                    <h2>${className}</h2>
                    <div class="metric">
                        <strong>Type:</strong> ${classData.type}
                    </div>
                    <div class="relationships-section">
                        ${generateGraphSection(className, classData)}
                    </div>
                    <div class="metric-list">
                        ${generatePublicInterface(classData)}
                    </div>
                    <div class="occurrences">
                        <h3>Found in Files:</h3>
                        ${classData.occurrences
                    .map(file => `<div>${path.basename(file)}</div>`)
                    .join('')}
                    </div>
                </div>
            `)
        })
    }

    return cards.join('')
}

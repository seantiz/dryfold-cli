import type { MethodAnalysis, DesignValues, LayerType } from "../schema"
import path from 'path'

// Complexity helper functions

export function formatEstimatedTime(time: { hours: number; minutes: number }): string {
    if (time.hours < 1) {
        return `${time.minutes} minutes`
    }
    return `${time.hours} hours${time.minutes > 0 ? ` ${time.minutes} minutes` : ''}`
}

export function generateMethodList(methodAnalysis: MethodAnalysis): string {
    let output = '<div class="method-analysis">'

    // Handle local functions
    if (methodAnalysis.localFunctions?.length) {
        output += `
            <div class="method-section">
                <h4>Local Functions (${methodAnalysis.localFunctions.length})</h4>
                ${methodAnalysis.localFunctions.map(method => `
                    <div class="method-item">
                        <span class="name">- ${method.name}</span>
                        <span class="lines">(defined line ${method.lineStart})</span>
                    </div>
                `).join('')}
            </div>
        `
    }

    // Handle callbacks
    if (methodAnalysis.callbacks?.length) {
        output += `
            <div class="method-section">
                <h4>External Callbacks (${methodAnalysis.callbacks.length})</h4>
                ${methodAnalysis.callbacks.map(callback => `
                    <div class="method-item">
                        <span class="name">- callback in ${callback.parentFunction}</span>
                        <span class="lines">(line ${callback.lineStart})</span>
                    </div>
                `).join('')}
            </div>
        `
    }

    output += '</div>'
    return output
}


// Feature Report Helper Functions
export function generateLayerSummary(moduleMap: Map<string, DesignValues>): string {
    const layers: Record<LayerType, Set<string>> = {
        core: new Set<string>(),
        interface: new Set<string>(),
        derived: new Set<string>(),
        utility: new Set<string>()
    }

    const cleanModuleName = (name: string): string => {
        // Handle both file paths and regular module names
        return path.basename(name).replace('.h', '');
    };

    for (const [file, data] of moduleMap) {
        // Handle fileLayerType first - clean up the file path
        if (data.fileLayerType) {
            const moduleName = cleanModuleName(file);
            layers[data.fileLayerType].add(moduleName);
        }

        // Then process moduleRelationships
        if (data.moduleRelationships) {
            Object.entries(data.moduleRelationships).forEach(([moduleName, moduleData]) => {
                if (moduleData.type) {
                    // Clean up any potential paths in module names as well
                    layers[moduleData.type].add(cleanModuleName(moduleName));
                }
            });
        }
    }

    return `
        <div class="layer-summary">
            ${Object.entries(layers).map(([layer, components]) => `
                <div class="layer-group">
                    <h3>${layer.charAt(0).toUpperCase() + layer.slice(1)} Layer</h3>
                    <div class="components">
                        ${Array.from(components).sort().join(', ') || 'None'}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}



type ModuleData = {
    type: LayerType;
    relationships: {
        inheritsFrom: string[];
        uses: string[];
        usedBy: string[];
    };
    occurrences: string[];
}

function generateGraphSection(moduleName: string, moduleData: ModuleData): string {
    const relationships = moduleData.relationships;
    const graphs: string[] = [];

    if (relationships.inheritsFrom?.length) {
        graphs.push(`
            <div class="inheritance-graph">
                <h4>Inheritance Hierarchy</h4>
                <div class="hierarchy">
                    <div class="base-classes">${relationships.inheritsFrom.join(' → ')}</div>
                    <div class="current-class">↳ ${moduleName}</div>
                </div>
            </div>
        `);
    }

    if (relationships.uses?.length || relationships.usedBy?.length) {
        graphs.push(`
            <div class="dependency-graph">
                <h4>Dependencies</h4>
                ${relationships.uses?.length
                    ? `<div class="outgoing"><strong>Outgoing:</strong> ${relationships.uses.join(' → ')}</div>`
                    : ''}
                ${relationships.usedBy?.length
                    ? `<div class="incoming"><strong>Incoming:</strong> ${relationships.usedBy.join(' → ')}</div>`
                    : ''}
            </div>
        `);
    }

    return graphs.join('');
}


export function generateCards(moduleMap: Map<string, DesignValues>): string {
    const cards: string[] = []

    for (const [_, data] of moduleMap) {
        if (!data.moduleRelationships) continue

        Object.entries(data.moduleRelationships).forEach(([moduleName, moduleData]) => {
            cards.push(`
                <div class="feature-card">
                    <h2>${moduleName}</h2>
                    <div class="metric">
                        <strong>Type:</strong> ${moduleData.type}
                    </div>
                    <div class="relationships-section">
                        ${generateGraphSection(moduleName, moduleData)}
                    </div>
                    <div class="occurrences">
                        <h3>Found in Files:</h3>
                        ${moduleData.occurrences
                    .map(file => `<div>${path.basename(file)}</div>`)
                    .join('')}
                    </div>
                </div>
            `)
        })
    }

    return cards.join('')
}

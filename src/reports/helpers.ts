import type { Feature, FeatureMethod, LayerType } from "../analyse/schema";
import path from 'path'

// Complexity helper functions

export function formatEstimatedTime(time: { hours: number; minutes: number }): string {
    if (time.hours < 1) {
        return `${time.minutes} minutes`;
    }
    return `${time.hours} hours${time.minutes > 0 ? ` ${time.minutes} minutes` : ''}`;
}

export function generateMethodList(methods: any[], title: string): string {
    if (!methods?.length) return '';
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
    `;
}

// Feature Report Helper Functions




export function generateLayerSummary(featureAnalysis: Map<string, Feature>): string {
    const layers: Record<LayerType, Set<string>> = {
        core: new Set<string>(),
        interface: new Set<string>(),
        derived: new Set<string>(),
        utility: new Set<string>()
    };


    for (const [_, feature] of featureAnalysis) {
        if (feature.type) {
            const layerType = feature.type.toLowerCase() as LayerType;
            if (layerType in layers) {
                layers[layerType].add(feature.name);
            }
        }
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
    `;
}

function generatePublicInterface(feature: { methods?: FeatureMethod[] }): string {
    if (!feature.methods?.length) return '';

    return `
        <div class="public-interface">
            ${feature.methods
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
    `;
}

function generateGraphSection(feature: Feature) {
    // Check if metrics exists before destructuring
    if (!feature.metrics) return '';

    const { metrics } = feature;
    const graphs = [];

    if (metrics.inheritsFrom?.size) {
        graphs.push(`
            <div class="inheritance-graph">
                <h4>Inheritance Hierarchy</h4>
                <div class="hierarchy">
                    <div class="base-classes">${Array.from(metrics.inheritsFrom).join(' → ')}</div>
                    <div class="current-class">↳ ${feature.name}</div>
                </div>
            </div>
        `);
    }

    if (metrics.uses?.size || metrics.usedBy?.size) {
        graphs.push(`
            <div class="dependency-graph">
                <h4>Dependencies</h4>
                ${metrics.uses?.size ? `<div class="outgoing"><strong>Outgoing:</strong> ${Array.from(metrics.uses).join(' → ')}</div>` : ''}
                ${metrics.usedBy?.size ? `<div class="incoming"><strong>Incoming:</strong> ${Array.from(metrics.usedBy).join(' → ')}</div>` : ''}
            </div>
        `);
    }

    return graphs.join('');
}

export function generateCards(featureAnalysis: Map<string, Feature>): string {
    return Array.from(featureAnalysis.entries())
        .map(([_, feature]) => `
            <div class="feature-card">
                <h2>${feature.name}</h2>

                <div class="metric">
                    <strong>Type:</strong> ${feature.type}
                </div>

                <div class="relationships-section">
                    ${generateGraphSection(feature)}
                </div>

                <div class="metric-list">
                    ${generatePublicInterface(feature)}
                </div>

                <div class="occurrences">
                    <h3>Found in Files:</h3>
                    ${feature.occurrences
                        .map((file: string) => `
                            <div>${path.basename(file)}</div>
                        `)
                        .join('')}
                </div>
            </div>
        `)
        .join('');
}


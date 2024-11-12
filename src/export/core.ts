import fs from 'fs'
import path from 'path'
import type { DesignValues } from "../schema";
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

export async function generateDataViz(moduleMap: Map<string, DesignValues>) {
    const { dot } = createDot(moduleMap);

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

export function createDot(moduleMap: Map<string, DesignValues>) {
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
            // First try file-based layer type if available
            if (data.fileLayerType) {
                return data.fileLayerType;
            }

            // Fall back to module relationships-based layer type
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
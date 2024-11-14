import fs from 'fs'
import path from 'path'
import type { DesignValues } from "../schema";
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

interface N {
    node: string;
    label: string;
    layer: string;
    layerValue: number;
}

interface E {
    source: string;
    target: string;
}

async function dotToCSV(dotFilePath: string): Promise<void> {
    try {
        const dotContent = await fs.promises.readFile(dotFilePath, 'utf-8');
        const layerMap = new Map<string, string>();

        dotContent.split('\n').forEach(line => {
            const layerMatch = line.match(/"([^"]+)"\s*\[label="[^"]+",\s*layer="([^"]+)"\]/);
            if (layerMatch) {
                layerMap.set(layerMatch[1], layerMatch[2]);
            }
        });

        const { stdout } = await exec(`dot -Tplain "${dotFilePath}"`);

        const nodes: N[] = [];
        const edges: E[] = [];

        const layerValues: Record<string, number> = {
            'core': 1,
            'interface': 2,
            'derived': 3,
            'utility': 4,
            'unknown': 0
        };

        stdout.split('\n').forEach(line => {
            const parts = line.trim().split(' ');
            if (parts[0] === 'node') {
                const nodeName = parts[1].replace(/"/g, '');
                const layer = layerMap.get(nodeName) || 'unknown';
                nodes.push({
                    node: nodeName,
                    label: parts[6]?.replace(/"/g, '') || nodeName,
                    layer,
                    layerValue: layerValues[layer]
                });
            } else if (parts[0] === 'edge') {
                edges.push({
                    source: parts[1].replace(/"/g, ''),
                    target: parts[2].replace(/"/g, '')
                });
            }
        });

        const nodesCSV = ['Id,Label,Layer,LayerValue\n'];
        nodes.forEach(node => {
            nodesCSV.push(`${node.node},${node.label},${node.layer},${node.layerValue}\n`);
        });

        const edgesCSV = ['Source,Target\n'];
        edges.forEach(edge => {
            edgesCSV.push(`${edge.source},${edge.target}\n`);
        });

        await Promise.all([
            fs.promises.writeFile('./allreports/nodes.csv', nodesCSV.join('')),
            fs.promises.writeFile('./allreports/edges.csv', edgesCSV.join(''))
        ]);

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

export async function generateDataViz(moduleMap: Map<string, DesignValues>) {
    const { dot } = createDot(moduleMap);

    await fs.promises.mkdir('./allreports', { recursive: true });

    try {
        const dotFilePath = './allreports/dependencygraph.dot';
        await fs.promises.writeFile(dotFilePath, dot);

        await Promise.all([
            exec(`dot -Tsvg ${dotFilePath} -o ./allreports/dependencies.svg`),
            exec(`dot -Tpng ${dotFilePath} -o ./allreports/dependencies.png`),
            dotToCSV(dotFilePath)
        ]);

        console.log('Successfully generated graph and CSV files');
    } catch (error) {
        throw error;
    }
}


export function createDot(moduleMap: Map<string, DesignValues>) {
    let dot = 'digraph Dependencies {\n';
    dot += '  node [shape=box];\n';

    const unknownLayers = new Set<string>();
    const knownNodes = new Set<string>();

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

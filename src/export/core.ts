import fs from 'fs'
import path from 'path'
import type { DesignValues, LayerType } from "../schema"
import { Graphviz } from '@hpcc-js/wasm-graphviz'

interface N {
    node: string
    label: string
    layer: string
    layerValue: number
}

interface E {
    source: string
    target: string
}

const graphviz = await Graphviz.load()

async function dotToCSV(dotFilePath: string): Promise<void> {
    try {
        const dotContent = await fs.promises.readFile(dotFilePath, 'utf-8')
        const layerMap = new Map<string, string>()

        dotContent.split('\n').forEach(line => {
            const layerMatch = line.match(/"([^"]+)"\s*\[label="[^"]+",\s*layer="([^"]+)"\]/)
            if (layerMatch) {
                layerMap.set(layerMatch[1], layerMatch[2])
            }
        })

        const plaintext = graphviz.layout(dotContent, "plain", "dot")

        const nodes: N[] = []
        const edges: E[] = []

        const layerValues: Record<string, number> = {
            'core': 1,
            'interface': 2,
            'derived': 3,
            'utility': 4,
            'unknown': 0
        }

        plaintext.split('\n').forEach(line => {
            const parts = line.trim().split(' ')
            if (parts[0] === 'node') {
                const nodeName = parts[1].replace(/"/g, '')
                const layer = layerMap.get(nodeName) || 'unknown'
                nodes.push({
                    node: nodeName,
                    label: parts[6]?.replace(/"/g, '') || nodeName,
                    layer,
                    layerValue: layerValues[layer]
                })
            } else if (parts[0] === 'edge') {
                edges.push({
                    source: parts[1].replace(/"/g, ''),
                    target: parts[2].replace(/"/g, '')
                })
            }
        })

        const nodesCSV = ['Id,Label,Layer,LayerValue\n']
        nodes.forEach(node => {
            nodesCSV.push(`${node.node},${node.label},${node.layer},${node.layerValue}\n`)
        })

        const edgesCSV = ['Source,Target\n']
        edges.forEach(edge => {
            edgesCSV.push(`${edge.source},${edge.target}\n`)
        })

        await Promise.all([
            fs.promises.writeFile('./allreports/nodes.csv', nodesCSV.join('')),
            fs.promises.writeFile('./allreports/edges.csv', edgesCSV.join(''))
        ])

    } catch (error) {
        console.error('Error:', error)
        throw error
    }
}

export async function generateDataViz(moduleMap: Map<string, DesignValues>) {
    const { dot } = createDot(moduleMap)

    await fs.promises.mkdir('./allreports', { recursive: true })

    try {
        const dotFilePath = './allreports/dependencygraph.dot'
        const svg = graphviz.layout(dot, "svg", "fdp")

        await Promise.all([
            fs.promises.writeFile(dotFilePath, dot),
            fs.promises.writeFile('./allreports/dependencies.svg', svg),
            dotToCSV(dotFilePath)
        ])

    } catch (error) {
        throw error
    }
}


export function createDot(moduleMap: Map<string, DesignValues>) {
    let dot = 'digraph Dependencies {\n'
    dot += '  graph [rankdir=TB, splines=ortho, nodesep=0.8, ranksep=2.0];\n'
    dot += '  node [shape=box];\n'

    const layers: Record<LayerType, Set<string>> = {
        core: new Set<string>(),
        interface: new Set<string>(),
        derived: new Set<string>(),
        utility: new Set<string>()
    }
    const unknownLayers = new Set<string>()
    const knownNodes = new Set<string>()
    const cleanModuleName = (name: string): string => path.basename(name).replace('.h', '')

    for (const [file, data] of moduleMap) {
        const nodeName = path.basename(file)

        if (data.fileLayerType) {
            layers[data.fileLayerType].add(nodeName)
            knownNodes.add(nodeName)
        }

        if (data.moduleRelationships) {
            Object.entries(data.moduleRelationships).forEach(([moduleName, moduleData]) => {
                if (moduleData.type) {
                    const cleanName = cleanModuleName(moduleName)
                    layers[moduleData.type].add(cleanName)
                    knownNodes.add(cleanName)
                }
            })
        }

        if (!knownNodes.has(nodeName)) {
            unknownLayers.add(nodeName)
        }
    }

    // Nodes
    const colors = {
        core: 'lightgrey',
        interface: 'lightblue',
        derived: 'lightgreen',
        utility: 'lightyellow'
    }

    Object.entries(layers).forEach(([layer, nodes]) => {
        if (nodes.size > 0) {
            dot += `  subgraph cluster_${layer} {\n`
            dot += '    rank = same;\n'
            dot += `    label = "${layer.charAt(0).toUpperCase() + layer.slice(1)} Layer";\n`
            dot += '    style = filled;\n'
            dot += `    color = ${colors[layer as LayerType]};\n`
            dot += '    node [style=filled,color=white];\n'

            nodes.forEach(nodeName => {
                dot += `    "${nodeName}" [label="${nodeName}", layer="${layer}"];\n`
            })

            dot += '  }\n'
        }
    })

    // Edges
    for (const [file, data] of moduleMap) {
        const sourceNode = path.basename(file)
        if (!knownNodes.has(sourceNode) || !data.includes) continue

        data.includes.forEach(include => {
            const includeName = path.basename(include.replace(/#include\s*[<"]([^>"]+)[>"]/g, '$1'))
            if (knownNodes.has(includeName)) {
                dot += `  "${sourceNode}" -> "${includeName}";\n`
            }
        })
    }

    if (unknownLayers.size > 0) {
        dot += '\n  /* Modules with unknown layers:\n'
        Array.from(unknownLayers).sort().forEach(name => {
            dot += `   * ${name}\n`
        })
        dot += '  */\n'
    }

    dot += '}'

    return { dot, unknownLayers: Array.from(unknownLayers) }
}

import fs from 'fs'
import type { DesignValues } from "../schema"

export function generateGHProject(moduleMap: Map<string, DesignValues>) {
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
}
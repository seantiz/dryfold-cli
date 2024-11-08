import fs from 'fs'
import path from 'path'
import { createInterface } from 'readline/promises'
import { validateBinary } from './utils'
import { analyseCppDependencies } from './analyse/tasks'
import { generateGraphs, printFeatureReport, printComplexityReport } from './reports/generate'

async function main() {

    const cliPrompt = createInterface({
        input: process.stdin,
        output: process.stdout
    })

    const entryPoint = (await cliPrompt.question('Please type the entry-point folder: ')).trim()

    if (!fs.existsSync(entryPoint)) {
        console.error(`Couldn't find "${entryPoint}" or it doesn't exist. Please double check, then run the app again.`)
        cliPrompt.close()
        return
    }

    cliPrompt.close()

    const moduleRelationships = walkDirectory(entryPoint)
            generateGraphs(moduleRelationships)
            printComplexityReport(moduleRelationships)
            printFeatureReport(moduleRelationships)
            cliPrompt.close()
}

function walkDirectory(dir: string) {
    const moduleMap = new Map()

    function walk(currentDir: string) {
        const files = fs.readdirSync(currentDir)
        files.forEach((file) => {
            const fullPath = path.join(currentDir, file)
            const stat = fs.statSync(fullPath)

            if (stat.isDirectory()) {
                walk(fullPath)
            } else {
                if (file.endsWith('.cpp') || file.endsWith('.h')) {
                    if (validateBinary(fullPath)) {
                        moduleMap.set(fullPath, { type: 'binary' })
                    } else {
                        moduleMap.set(fullPath, analyseCppDependencies(fullPath))
                    }
                }
            }
        })
    }

    walk(dir)
    return moduleMap
}

main().catch(console.error)

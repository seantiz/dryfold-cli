import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createInterface } from 'readline/promises'
import { validateBinary } from './utils'
import { analyseCppDependencies } from './analyse/tasks'
import {
    generateGraphs,
    printFeatureReport,
    printComplexityReport,
generateGHTasks} from './reports/generate'


const execAsync = promisify(exec)

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

    const moduleRelationships = walkDirectory(entryPoint)
    await generateGraphs(moduleRelationships)
    printComplexityReport(moduleRelationships)
    printFeatureReport(moduleRelationships)
    generateGHTasks(moduleRelationships)

    const postGH = (await cliPrompt.question('\n\n\nWould you like to create a GitHub project for these tasks? (y/n): ')).trim().toLowerCase()

    if (postGH === 'y') {
        const projectName = (await cliPrompt.question('Please name your new project: ')).trim()
        console.log(`Creating ${projectName} on Github...`)

        try {
            const { stdout, stderr } = await execAsync(`bash ./postgh.sh "${projectName}"`)
            console.log(stderr || stdout)
            console.log(`${projectName} created successfully!`)
        } catch (error) {
            console.error(`Failed to create ${projectName}:`, error)
        } finally {
            cliPrompt.close()
        }
    }
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

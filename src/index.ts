import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { createInterface } from 'readline/promises'
import { validateBinary } from './utils'
import { analyseCppDependencies } from './analyse/tasks'
import {
    generateGraphs,
    printFeatureReport,
    printComplexityReport,
    generateGHTasks,
    generateKanriJSON
} from './reports/generate'

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
    const kanriCards = generateKanriJSON(moduleRelationships)
    fs.writeFileSync('./allreports/kanri_tasks.json', JSON.stringify(kanriCards, null, 2));


    const postGH = (await cliPrompt.question('\n\nWould you like to create a GitHub project for these tasks? (y/n): ')).trim().toLowerCase()

    if (postGH !== 'y' && postGH !== 'n') {
        console.log('Invalid input. Please enter "y" or "n".')
        cliPrompt.close()
        return
    }

    if (postGH === 'n') {
        cliPrompt.close()
        return
    }

    try {
        const projectName = (await cliPrompt.question('Please name your new project: ')).trim()
        console.log(`Creating ${projectName} on Github. Please wait...`)

        const childProcess = exec(`bash ./postgh.sh "${projectName}"`)
        let outputData = '', errorData = ''

        childProcess.stdout?.on('data', data => outputData += data)
        childProcess.stderr?.on('data', data => errorData += data)

        const delay = setInterval(() => {
            const progress = fs.readFileSync('./gh_progress.txt', 'utf8').trim()
            const [current, total] = progress.split('/').map(Number)
            process.stdout.clearLine(0)
            process.stdout.cursorTo(0)
            process.stdout.write(`[${current}/${total}] ${Math.round((current / total) * 100)}% complete`)
        }, 1000)

        await new Promise<null>((resolve, reject) => {
            childProcess.on('exit', code => {
                clearInterval(delay)
                process.stdout.write('\n')
                code === 0 ? resolve(null) : reject(new Error(`Process exited with code ${code}`))
            })
        })

        console.log(errorData || outputData)
        console.log(`${projectName} created successfully!`)
    } catch (error) {
        console.error('Project creation failed:', error)
    } finally {
        cliPrompt.close()
    }
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

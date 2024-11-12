import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { createInterface } from 'readline/promises'
import { analyseCppFile, findDesign } from './analyse'
import {
    printComplexityReport,
    printFeatureReport,
    generateDataViz,
    generateGHProject,
    generateKanriJSON } from './export'

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

    const codebaseComplexity = walkDirectory(entryPoint)
    printComplexityReport(codebaseComplexity)

    const kanriCards = generateKanriJSON(codebaseComplexity)
    fs.writeFileSync('./allreports/kanri_tasks.json', JSON.stringify(kanriCards, null, 2));

    const codebaseDesign = findDesign(codebaseComplexity)
    // AST removed from the map from here on
    printFeatureReport(codebaseDesign)
    generateDataViz(codebaseDesign)
    generateGHProject(codebaseDesign)

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

function walkDirectory(entryPoint: string) {
    const moduleMap = new Map()

    function walk(codebase: string) {
        const lsfiles = fs.readdirSync(codebase)

        lsfiles.forEach((file) => {
            // Check out Node fs' docs on Stats type and the mode param for more
            const nextRoute = path.join(codebase, file)
            const routeMode = fs.statSync(nextRoute)

            if (routeMode.isDirectory()) {
                walk(nextRoute)
                return
            }

            if (!file.endsWith('.cpp') && !file.endsWith('.h')) {
                return
            }

            moduleMap.set(nextRoute, analyseCppFile(nextRoute)
            );
        })
    }

    walk(entryPoint)
    return moduleMap
}

main().catch(console.error)

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

    const postGH = (await cliPrompt.question('\n\nWould you like to create a GitHub project for these tasks? (y/n): ')).trim().toLowerCase()

    if (postGH === 'y') {
        const projectName = (await cliPrompt.question('Please name your new project: ')).trim()
        console.log(`Creating ${projectName} on Github. Please wait...`)

        try {
            const childProcess = exec(`bash ./postgh.sh "${projectName}"`)
            let outputData = ''
            let errorData = ''
            childProcess.stdout?.on('data', (data) => {
                outputData += data
            })
            childProcess.stderr?.on('data', (data) => {
                errorData += data
            })

            const delay = setInterval(() => {
                try {
                    const progress = fs.readFileSync('./gh_progress.txt', 'utf8').trim()
                    const [current, total] = progress.split('/').map(Number)
                    const percentage = Math.round((current / total) * 100)

                    process.stdout.clearLine(0)
                    process.stdout.cursorTo(0)
                    process.stdout.write(`[${current}/${total}] ${percentage}% complete`)
                } catch (err) {
                    throw new Error(`Progress file error, ${err}`)
                }
            }, 1000)

            await new Promise((resolve, reject) => {
                childProcess.on('exit', (code) => {
                    clearInterval(delay)
                    process.stdout.write('\n')

                    if (code === 0) {
                        resolve(null)
                    } else {
                        reject(new Error(`Process exited with code ${code}`))
                    }
                })
            })

            console.log(errorData || outputData)
            console.log(`${projectName} created successfully!`)
        } catch (error) {
            console.error(`Failed to create ${projectName}:`, error)
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
}

main().catch(console.error)

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { createInterface } from 'readline/promises';
import { analyseCppFile, findDesign } from './analyse';
import {
    printComplexityReport,
    printFeatureReport,
    generateDataViz,
    generateGHProject,
    generateKanriJSON
} from './export';

async function main() {
    const errors: Error[] = [];
    const terminal = createInterface({
        input: process.stdin,
        output: process.stdout
    })

    const entryPoint = (await terminal.question('Please type the entry-point folder: ')).trim()

    if (!fs.existsSync(entryPoint)) {
        console.error(`Couldn't find "${entryPoint}" or it doesn't exist. Please double check and try again.`)
        terminal.close()
        return
    }

    const codebaseComplexity = walkDirectory(entryPoint)

    console.log('\nPlease make your choices below (y/n) to all:\n')
    const yesToComplexity = (await terminal.question('Create complexity report? : ')).trim().toLowerCase() === 'y'
    const yesToDataViz = (await terminal.question('Create data viz files - DOT, SVG & CSV? : ')).trim().toLowerCase() === 'y'

    if (!yesToDataViz) {
        console.log('\nNOTE: You chose not to create an SVG. If you choose to create a Feature Report, it won\'t have an SVG map embedded in the report.\n')
    }

    const yesToFeatures = (await terminal.question('Create feature report ? : ')).trim().toLowerCase() === 'y'
    const yesToJSON = (await terminal.question('Create JSON for Kanri cards? : ')).trim().toLowerCase() === 'y'

    if (yesToComplexity) {
        try {
            printComplexityReport(codebaseComplexity);
        } catch (error) {
            errors.push(error as Error);
        }
    }

    const codebaseDesign = findDesign(codebaseComplexity);

    if (yesToDataViz) {
        try {
            await generateDataViz(codebaseDesign);
        } catch (error) {
            errors.push(error as Error);
        }
    }

    if (yesToFeatures) {
        try {
            printFeatureReport(codebaseDesign);
        } catch (error) {
            errors.push(error as Error);
        }
    }

    if (yesToJSON) {
        try {
            const kanriCards = generateKanriJSON(codebaseComplexity);
            fs.writeFileSync('./allreports/kanri_tasks.json', JSON.stringify(kanriCards, null, 2));
        } catch (error) {
            errors.push(error as Error);
        }
    }

    if (errors.length > 0) {
        console.log('\nWarning: Created with errors. All successfully created files are in dryfold-cli/allreports folder.');
        console.log('Error details:');
        errors.forEach((error, index) => {
            console.error(`${index + 1}. ${error.message}`);
        });
    } else {
        console.log('\nDone! All reports can be found in the dryfold-cli/allreports folder');
    }


    const postGH = (await terminal.question('\n\nWould you like to create a GitHub project for these tasks? (y/n): ')).trim().toLowerCase()

    if (postGH !== 'y' && postGH !== 'n') {
        console.log('Invalid input. Please enter "y" or "n".')
        terminal.close()
        return
    }

    if (postGH === 'n') {
        terminal.close()
        return
    }

    try {
        generateGHProject(codebaseDesign)
        const projectName = (await terminal.question('Please name your new project: ')).trim()
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
        terminal.close()
    }
}


function walkDirectory(entryPoint: string) {
    const moduleMap = new Map()

    function walk(codebase: string) {
        const files = fs.readdirSync(codebase)

        files.forEach((file) => {
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

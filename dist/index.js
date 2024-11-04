import fs from 'fs';
import path from 'path';
import { validateBinary } from './utils';
import { analyseCppDependencies } from './analyse/tasks';
import { generateGraphs, printFeatureReport, printComplexityReport } from './reports/generate';
function walkDirectory(dir) {
    const moduleMap = new Map();
    function walk(currentDir) {
        const files = fs.readdirSync(currentDir);
        files.forEach((file) => {
            const fullPath = path.join(currentDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            }
            else {
                if (file.endsWith('.cpp') || file.endsWith('.h')) {
                    if (validateBinary(fullPath)) {
                        moduleMap.set(fullPath, { type: 'binary' });
                    }
                    else {
                        moduleMap.set(fullPath, analyseCppDependencies(fullPath));
                    }
                }
            }
        });
    }
    walk(dir);
    return moduleMap;
}
const moduleRelationships = walkDirectory('./lib');
generateGraphs(moduleRelationships);
printComplexityReport(moduleRelationships);
printFeatureReport(moduleRelationships);

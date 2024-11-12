import type { ComplexityValues, DesignValues, LayerType } from '../../schema'
import { determineLayerType } from './utils';

export function findDesign(moduleMap: Map<string, ComplexityValues>): Map<string, DesignValues> {
    const globalClassMap = new Map<string, {
        type: LayerType,
        occurrences: string[],
        relationships: {
            inheritsFrom: string[],
            uses: string[],
            usedBy: string[]
        }
    }>();

    // Track processed files and classes
    const visitedFiles = new Set<string>();
    const visitedClasses = new Set<string>();

    // First pass: collect all classes and their inheritance
    for (const [file, data] of moduleMap) {
        if (visitedFiles.has(file) || !data.complexity?.tree?.rootNode) continue;
        visitedFiles.add(file);

        const tree = data.complexity.tree;
        const classNodes = tree.rootNode.descendantsOfType('class_specifier')
            .filter(node => node.childForFieldName('body') !== null);

        if (classNodes.length === 0) {
            const fileType = determineLayerType(null, [], file);
            globalClassMap.set(file, {
                type: fileType,
                occurrences: [file],
                relationships: {
                    inheritsFrom: [],
                    uses: [],
                    usedBy: []
                }
            });
            continue;
        }



        classNodes.forEach((classNode) => {
            const className = classNode.childForFieldName('name')?.text;
            if (!className) {
                return;
            }

            // Skip if we've already processed this class
            if (visitedClasses.has(className)) {
                return;
            }
            visitedClasses.add(className);

            // Rest of your existing class processing code...
            const methods = classNode.descendantsOfType('function_definition');
            const classType = determineLayerType(classNode, methods, file);

            // Existing relationship processing...
            const baseClassNodes = classNode.descendantsOfType('base_class_clause');
            const inheritsFrom = baseClassNodes.map(node =>
                node.text.replace(/\s*public\s*|\s*private\s*|\s*protected\s*/, '').trim()
            );

            const uses = new Set<string>();
            methods.forEach(method => {
                const typeIdentifiers = method.descendantsOfType('type_identifier');
                typeIdentifiers.forEach(type => {
                    if (type.text !== className) {
                        uses.add(type.text);
                    }
                });
            });

            // Update global class map...
            if (!globalClassMap.has(className)) {
                globalClassMap.set(className, {
                    type: classType,
                    occurrences: [file],
                    relationships: {
                        inheritsFrom,
                        uses: Array.from(uses),
                        usedBy: []
                    }
                });
            } else {
                const existing = globalClassMap.get(className)!;
                if (!existing.occurrences.includes(file)) {
                    existing.occurrences.push(file);
                }
                inheritsFrom.forEach(baseClass => {
                    if (!existing.relationships.inheritsFrom.includes(baseClass)) {
                        existing.relationships.inheritsFrom.push(baseClass);
                    }
                });
                uses.forEach(use => {
                    if (!existing.relationships.uses.includes(use)) {
                        existing.relationships.uses.push(use);
                    }
                });
            }
        });

        if (data.complexity) {
            delete data.complexity.tree;
        }
    }

    // Reset visited files for second pass
    visitedFiles.clear();

    // Convert to DesignValues map with duplicate checking
    const designMap = new Map<string, DesignValues>();

    for (const [file, data] of moduleMap) {
        if (visitedFiles.has(file)) continue;
        visitedFiles.add(file);

        const designData: DesignValues = {
            ...data,
            moduleRelationships: {},
            fileLayerType: determineLayerType(null, [], file)
        };

        // Add relationships only once per file
        globalClassMap.forEach((classData, className) => {
            if (classData.occurrences.includes(file)) {
                designData.moduleRelationships[className] = {
                    type: classData.type,
                    relationships: classData.relationships,
                    occurrences: classData.occurrences
                };
            }
        });

        designMap.set(file, designData);
    }

    return designMap;
}




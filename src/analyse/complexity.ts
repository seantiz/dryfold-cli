import type { Tree } from 'tree-sitter'
import type { ModuleMapValues } from './schema'
import { determineClassType } from './helpers';

export function calculateControlFlowTime(tree: Tree) {
    let totalMinutes = 0

    tree.rootNode.descendantsOfType('if_statement').forEach((node) => {
        const lines = node.endPosition.row - node.startPosition.row + 1
        totalMinutes += lines <= 5 ? 5 : lines <= 15 ? 10 : 15
    });

    ['for_statement', 'while_statement'].forEach((loopType) => {
        tree.rootNode.descendantsOfType(loopType).forEach((node) => {
            const lines = node.endPosition.row - node.startPosition.row + 1
            totalMinutes += lines <= 5 ? 7 : lines <= 15 ? 12 : 20
        })
    })

    return totalMinutes / 60
}

export function calculateTemplateComplexity(tree: Tree) {
    let templateComplexity = 0

    tree.rootNode.descendantsOfType('template_declaration').forEach((node) => {
        // Base time - 1 minute for simple templates
        let time = 1 / 60

        const params = node.descendantsOfType('template_parameter_list')
        if (params.length > 1) {
            time += 0.25 * params.length
        }

        const specializations = node.descendantsOfType('template_specialization')
        if (specializations.length > 0) {
            time += 0.5 * specializations.length
        }

        // Check for SFINAE or complex constraints
        const constraints = node.descendantsOfType('requires_clause').length
        if (constraints > 0) {
            time += 0.75
        }

        templateComplexity += time
    })

    return templateComplexity
}

export function analyseFeatureComplexity(moduleMap: Map<string, ModuleMapValues>) {
    const featureMap = new Map()

    // First pass: Register all features and their basic structure
    for (const [file, data] of moduleMap) {
        if (!data.complexity?.tree?.rootNode) continue;

        const tree = data.complexity.tree;
        const classNodes = tree.rootNode.descendantsOfType('class_specifier');

        classNodes.forEach((classNode) => {
            const className = classNode.childForFieldName('name')?.text;
            if (!className) return;

            const methods = classNode.descendantsOfType('function_definition')
            const classType = determineClassType(classNode, methods, className);

            if (!featureMap.has(className)) {
                featureMap.set(className, {
                    type: classType,
                    methods: methods.map(m => ({
                        name: m.text,
                        visibility: 'public'
                    })),
                    metrics: {
                        inheritsFrom: [],
                        uses: [],
                        usedBy: []
                    },
                    occurrences: [file]
                });
            }
        });
    }

    // Second pass: Build dependency relationships
    for (const [file, data] of moduleMap) {
        if (!data.complexity?.tree?.rootNode) continue;

        // Transform the featureMap data into the expected classRelationships structure
        if (!data.complexity.classRelationships) {
            data.complexity.classRelationships = {};
        }

        for (const [className, featureData] of featureMap) {
            data.complexity.classRelationships[className] = {
                type: featureData.type,
                methods: featureData.methods,
                metrics: featureData.metrics,
                occurrences: featureData.occurrences
            };
        }
    }

    return moduleMap;  // Return the modified moduleMap instead of featureMap
}




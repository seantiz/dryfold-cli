import type { ComplexityValues, DesignValues, LayerType } from '../../schema'
import { determineClassType } from './utils';

export function findDesign(moduleMap: Map<string, ComplexityValues>): Map<string, DesignValues> {
    // Step 1: First pass to collect all classes and their initial types
    const globalClassMap = new Map<string, {
        type: LayerType,
        occurrences: string[],
        relationships: {
            inheritsFrom: string[],
            uses: string[],
            usedBy: string[]
        }
    }>();

    // First pass: collect all classes and their inheritance
    for (const [file, data] of moduleMap) {
        if (!data.complexity?.tree?.rootNode) continue;

        const tree = data.complexity.tree;
        const classNodes = tree.rootNode.descendantsOfType('class_specifier')
            .filter(node => node.childForFieldName('body') !== null);

        classNodes.forEach((classNode) => {
            const className = classNode.childForFieldName('name')?.text;
            if (!className) return;

            const methods = classNode.descendantsOfType('function_definition');
            const classType = determineClassType(classNode, methods, className);

            // Get base classes from inheritance list
            const baseClassNodes = classNode.descendantsOfType('base_class_clause');
            const inheritsFrom = baseClassNodes.map(node =>
                node.text.replace(/\s*public\s*|\s*private\s*|\s*protected\s*/, '').trim()
            );

            // Get usage relationships from method bodies
            const uses = new Set<string>();
            methods.forEach(method => {
                const typeIdentifiers = method.descendantsOfType('type_identifier');
                typeIdentifiers.forEach(type => {
                    if (type.text !== className) {
                        uses.add(type.text);
                    }
                });
            });

            // Update or create class entry
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
                existing.occurrences.push(file);
                existing.relationships.inheritsFrom.push(...inheritsFrom);
                uses.forEach(use => {
                    if (!existing.relationships.uses.includes(use)) {
                        existing.relationships.uses.push(use);
                    }
                });
            }
        });

        // Clean up tree-sitter data
        if (data.complexity) {
            delete data.complexity.tree;
        }
    }

    // Second pass: populate usedBy relationships
    for (const [className, classData] of globalClassMap) {
        classData.relationships.uses.forEach(usedClass => {
            const usedClassData = globalClassMap.get(usedClass);
            if (usedClassData && !usedClassData.relationships.usedBy.includes(className)) {
                usedClassData.relationships.usedBy.push(className);
            }
        });
    }

    // Convert to DesignValues map
    const designMap = new Map<string, DesignValues>();

    for (const [file, data] of moduleMap) {
        const designData: DesignValues = {
            ...data,
            moduleRelationships: {}
        };

        // Add relationships for classes found in this file
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



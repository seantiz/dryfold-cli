import type { Tree } from "tree-sitter";

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
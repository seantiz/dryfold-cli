import type { SyntaxNode } from "tree-sitter"

// Helper functions for complexity.ts

export function determineClassType(classNode: any, methods: any[], className: string): string {
    if (isInterfaceClass(classNode, methods)) return 'interface'

    const baseClause = classNode.descendantsOfType('base_class_clause')[0]
    const hasVirtualMethods = methods.some((m) => m.text.includes('virtual'))

    if (baseClause) {
        if (className.includes('_private') || className.endsWith('Impl')) return 'derived'
        if (hasVirtualMethods) return 'core'
        return 'derived'
    }

    if (className.startsWith('Goo') ||
        className.includes('Utils') ||
        className.includes('Helper') ||
        className.includes('Factory')) return 'utility'

    if (methods.length === 0 || className.includes('_private')) return 'derived'

    return 'core'
}

function isInterfaceClass(
    classNode: SyntaxNode,
    methods: SyntaxNode[]
): boolean {
    // Check for pure virtual methods (= 0)
    const hasPureVirtual = methods.some((m) => m.text.includes('= 0'))
    if (hasPureVirtual) return true

    // Check if ALL methods are virtual (common interface pattern)
    const allMethodsVirtual =
        methods.length > 0 && methods.every((m) => m.text.includes('virtual'))
    if (allMethodsVirtual) return true

    // Check interface naming patterns
    const className = classNode.childForFieldName('name')?.text
    if (
        className &&
        ((className.startsWith('I') && // IRenderer pattern
            className.length > 1 &&
            className[1] === className[1].toUpperCase()) || // Check second char is uppercase
            className.endsWith('Interface') ||
            className.startsWith('Abstract'))
    )
        return true

    // Check if class has no implementation (only declarations)
    const hasImplementations = methods.some(
        (m) => m.text.includes('{') && !m.text.includes('= 0')
    )
    return !hasImplementations && methods.length > 0
}

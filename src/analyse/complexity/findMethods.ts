import type { Tree } from "tree-sitter"
import type { MethodAnalysis } from "../../schema"

/* Interface layer for parsing function calls inside every module and
returning data as MethodAnalysis layer */

export function findMethods(tree: Tree): MethodAnalysis {

    const methods: MethodAnalysis = {
        localFunctions: [],
        callbacks: []
    }

    // Find locally-defined functions
    const localFunctionNames = new Set()
    tree.rootNode.descendantsOfType('function_definition').forEach((node) => {
        const methodName = node.childForFieldName('declarator')?.text
        if (methodName) {
            localFunctionNames.add(methodName)
            methods.localFunctions.push({
                name: methodName,
                lineStart: node.startPosition.row + 1,
                lineEnd: node.endPosition.row + 1
            })
        }
    })

    // Find function references passed as arguments
    tree.rootNode.descendantsOfType('call_expression').forEach((node) => {
        const args = node.childForFieldName('arguments')
        const calledFunction = node.childForFieldName('function')?.text

        if (args && calledFunction) {
            args.children.forEach((arg) => {
                // Match callbacks as function references that aren't defined locally
                if (arg.type === 'identifier' && !localFunctionNames.has(arg.text)) {
                    methods.callbacks.push({
                        parentFunction: calledFunction,
                        lineStart: arg.startPosition.row + 1,
                        lineEnd: arg.endPosition.row + 1
                    })
                }
            })
        }
    })

    return methods
}
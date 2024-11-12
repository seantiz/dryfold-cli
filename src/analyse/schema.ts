import type { Tree } from 'tree-sitter'

export type LayerType = 'core' | 'interface' | 'derived' | 'utility'

// Complexity key values are printComplexityReport's job

export interface ComplexityValues {
    // File-centric data (existing)
    error?: string
    includes: string[]
    type?: 'binary'

    // File metrics and analysis
    complexity: {
        metrics: {
            loc: number
            functions: number
            classes: number
            templates: number
            conditionals: number
            loops: number
            includes: number
        }
        complexityScore: number
        estimatedTime: {
            hours: number
            minutes: number
        }
        methods: {
            localFunctions: Array<{
                name: string
                lineStart: number
                lineEnd: number
            }>
            callbacks: Array<{
                parentFunction: string
                lineStart: number
                lineEnd: number
            }>
        }
        tree?: Tree
    } | null
}

// Codebase design is printFeatureReport's job

export interface DesignValues extends ComplexityValues {

    // Module relationships

        moduleRelationships: {
            [moduleName: string]: {
                type: LayerType
                relationships: {
                    inheritsFrom: string[]
                    uses: string[]
                    usedBy: string[]
                }
                occurrences: string[]
            }
        }
}

// for listing modules methods with findMethods() and generateMethodList()

export interface MethodAnalysis {
    localFunctions: Array<{
        name: string
        lineStart: number
        lineEnd: number
    }>,
    callbacks: Array<{
        parentFunction: string
        lineStart: number
        lineEnd: number
    }>
}

export interface KanriCard {
    name: string;
    description?: string;
    id?: string;
    tasks?: {
        id?: string;
        finished: boolean;
        name: string;
    }[];
    dueDate?: string | null;
    tags?: any[] | null; // Using any for kanriTagSchema as it wasn't provided
    color?: string;
}


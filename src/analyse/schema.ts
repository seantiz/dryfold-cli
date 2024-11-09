import type { Tree } from 'tree-sitter'

// sortTasks()

export interface TasksAnalysis {
    topLevelFunctions: FunctionInfo[]
    callbackTasks: CallbackInfo[]
    features: {
        baseClasses: ClassInfo[]
        derivedClasses: ClassInfo[]
        utilityClasses: ClassInfo[]
        coreClasses: ClassInfo[]
    }
}

type FunctionInfo = {
    name: string
    lineStart: number
    lineEnd: number
}

type CallbackInfo = {
    parentFunction: string
    lineStart: number
    lineEnd: number
}

export type ClassInfo = {
    name: string
    methods: MethodInfo[]
    baseClasses: string[]
    isCore: boolean
    isBase: boolean
    isUtility: boolean
}

type MethodInfo = {
    name: string
    lineStart: number
    lineEnd: number
    isVirtual?: boolean
}

export type LayerType = 'core' | 'interface' | 'derived' | 'utility'

// moduleMap single sourch of truth

export interface ModuleMapValues {
    // File-centric data (existing)
    error?: string
    includes: string[]
    linkedLibraries: string[]
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
        tasks: {
            topLevelFunctions: FunctionInfo[]
            callbackTasks: CallbackInfo[]
            features: {
                baseClasses: ClassInfo[]
                derivedClasses: ClassInfo[]
                utilityClasses: ClassInfo[]
                coreClasses: ClassInfo[]
            }
        }
        // New: Class-centric relationships
        classRelationships: {
            [className: string]: {
                type: LayerType
                methods: {
                    name: string
                    parameters?: string[]
                    returnType?: string
                    visibility: 'public' | 'private' | 'protected'
                }[]
                metrics: {
                    inheritsFrom: string[]
                    uses: string[]
                    usedBy: string[]
                }
                occurrences: string[] // File paths where this class appears
            }
        }
        tree: Tree
    } | null
}

// because members can be null in ModuleMapValues, ClassData is for /helpers/enerateGraphSection()

export type ClassData = {
    type: LayerType
    methods: {
        name: string
        parameters?: string[]
        returnType?: string
        visibility: 'public' | 'private' | 'protected'
    }[]
    metrics: {
        inheritsFrom: string[]
        uses: string[]
        usedBy: string[]
    }
    occurrences: string[]
}

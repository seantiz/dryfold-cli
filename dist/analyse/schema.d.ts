import type { Tree } from "tree-sitter";
export interface TasksAnalysis {
    topLevelFunctions: FunctionInfo[];
    callbackTasks: CallbackInfo[];
    features: {
        baseClasses: ClassInfo[];
        derivedClasses: ClassInfo[];
        utilityClasses: ClassInfo[];
        coreClasses: ClassInfo[];
    };
}
export type MethodInfo = {
    name: string;
    lineStart: number;
    lineEnd: number;
    isVirtual?: boolean;
};
export type ClassInfo = {
    name: string;
    methods: MethodInfo[];
    baseClasses: string[];
    isCore: boolean;
    isBase: boolean;
    isUtility: boolean;
};
export interface Dependencies {
    error?: unknown;
    includes: string[];
    linkedLibraries: string[];
    complexity: Complexity | null;
}
export interface MapValues {
    error?: string;
    includes: string[];
    linkedLibraries: string[];
    complexity: {
        metrics: {
            loc: number;
            functions: number;
            classes: number;
            templates: number;
            conditionals: number;
            loops: number;
            includes: number;
        };
        complexityScore: number;
        estimatedTime: {
            hours: number;
            minutes: number;
        };
        tasks: {
            topLevelFunctions: any[];
            callbackTasks: any[];
            features: {
                baseClasses: any[];
                derivedClasses: any[];
                utilityClasses: any[];
                coreClasses: any[];
            };
        };
        tree: Tree;
    } | null;
    type?: 'binary';
}
interface Complexity {
    metrics: {
        loc: number;
        functions: number;
        classes: number;
        templates: number;
        conditionals: number;
        loops: number;
        includes: number;
    };
    complexityScore: number;
    estimatedTime: {
        hours: number;
        minutes: number;
    };
    tasks: {
        topLevelFunctions: Array<{
            name: string;
            lineStart: number;
            lineEnd: number;
        }>;
        callbackTasks: Array<{
            parentFunction: string;
            lineStart: number;
            lineEnd: number;
        }>;
        features: {
            baseClasses: Array<ClassInfo>;
            derivedClasses: Array<ClassInfo>;
            utilityClasses: Array<ClassInfo>;
            coreClasses: Array<ClassInfo>;
        };
    };
    tree: Tree;
}
type FunctionInfo = {
    name: string;
    lineStart: number;
    lineEnd: number;
};
type CallbackInfo = {
    parentFunction: string;
    lineStart: number;
    lineEnd: number;
};
export {};

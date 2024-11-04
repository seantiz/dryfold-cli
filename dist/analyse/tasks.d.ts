import Parser from 'tree-sitter';
import type { TasksAnalysis, Dependencies } from "./schema";
import type { Tree } from 'tree-sitter';
export declare function findTaskComplexity(filePath: string, code: string, tree: Tree): {
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
    tasks: TasksAnalysis;
    tree: Parser.Tree;
};
export declare function analyseCppDependencies(filePath: string): Dependencies;

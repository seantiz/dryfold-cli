import type { Tree } from "tree-sitter";
import type { MapValues } from "./schema";
export declare function calculateLogicTime(tree: Tree): number;
export declare function calculateTemplateComplexity(tree: Tree): number;
export declare function analyseFeatureComplexity(moduleMap: Map<string, MapValues>): Map<any, any>;

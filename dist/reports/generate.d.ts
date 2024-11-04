import type { MapValues } from '../analyse/schema';
export declare function printComplexityReport(moduleMap: Map<string, MapValues>): void;
export declare function printFeatureReport(moduleMap: Map<string, MapValues>): void;
export declare function generateGraphs(moduleMap: Map<string, MapValues>): Promise<void>;

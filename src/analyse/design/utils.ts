import type { SyntaxNode } from "tree-sitter"
import type { LayerType } from "../../schema"

export function determineLayerType(
    classNode?: any,
    methods?: any[],
    fileName?: string
): LayerType {
    // Class-based classification first when possible
    if (classNode && methods) {
        const className = classNode.childForFieldName('name')?.text;

        // Check class name patterns
        if (className) {
            const classNameType = detectFromClassName(className);
            if (classNameType) return classNameType;
        }

        // Check method patterns
        const methodBasedType = detectFromMethods(methods);
        if (methodBasedType) return methodBasedType;

        // Check inheritance
        const baseClause = classNode.descendantsOfType('base_class_clause')?.[0];
        if (baseClause) {
            const hasVirtualMethods = methods.some(m => m.text.includes('virtual'));
            if (hasVirtualMethods) {
                return 'interface';
            }
            return 'derived';
        }
    }

    // File-based classification last (least specific)
    if (fileName) {
        const fileBasedType = detectFromFileName(fileName);
        if (fileBasedType) return fileBasedType;
    }

    // Default classification
    return fileName?.includes('Types') || fileName?.includes('Utils') ?
        'utility' : 'core';
}

// Pattern matching
const INTERFACE_PATTERNS = [
    /^I[A-Z]/,
    /Interface$/,
    /^Abstract/,
    /OutputDev$/,
    /ImgWriter$/,
    /Factory$/,
    /Builder$/,
    /Source$/,
    /FontSrc$/
];

const UTILITY_PATTERNS = [
    /^Goo/,
    /Utils$/,
    /Helper$/,
    /Unicode/,
    /Types$/,
    /Constants$/,
    /Math$/,
    /^UTF/,
    /Config$/
];

const BUILDER_PATTERNS = [
    /Builder$/,
    /Factory$/,
    /Creator$/
];

function detectFromClassName(className: string): LayerType | null {
    if (INTERFACE_PATTERNS.some(pattern => pattern.test(className))) {
        return 'interface';
    }

    if (UTILITY_PATTERNS.some(pattern => pattern.test(className))) {
        return 'utility';
    }

    // Check builder patterns - should be interface unless concrete implementation
    if (BUILDER_PATTERNS.some(pattern => pattern.test(className))) {
        return className.startsWith('Curl') || className.startsWith('Stdin') ?
            'derived' : 'interface';
    }

    return null;
}

function detectFromMethods(methods: SyntaxNode[]): LayerType | null {
    if (!methods.length) return null;

    // Interface flag
    const hasPureVirtual = methods.some(m => m.text.includes('= 0'));
    if (hasPureVirtual) return 'interface';

    // Interface flag
    const allMethodsVirtual = methods.every(m => m.text.includes('virtual'));
    if (allMethodsVirtual && methods.length > 0) return 'interface';

    // Core flag
    const hasOperators = methods.some(m => m.text.includes('operator'));
    if (hasOperators) return 'core';

    // Utility flag
    const hasTemplates = methods.some(m => m.text.includes('template'));
    if (hasTemplates) return 'utility';

    return null;
}

function detectFromFileName(fileName: string): LayerType | null {
    if (!fileName) return null;

    // PIMPL pattern detection
    if (fileName.includes('_private') || fileName.endsWith('Impl')) {
        return 'derived';
    }

    // Utility file patterns
    if (fileName.includes('UTF') ||
        fileName.includes('Math') ||
        fileName.includes('Types')) {
        return 'utility';
    }

    // Specific Core filename pattern - consider review (might be too domain-specific)
    if (fileName.includes('Object.h')) {
        return 'core';
    }

    // Derived filename patterns
    if ((fileName.includes('Writer') && !fileName.includes('ImgWriter')) ||
        fileName.includes('JPEG') ||
        fileName.includes('PNG') ||
        fileName.includes('JBIG2')) {
        return 'derived';
    }

    return null;
}

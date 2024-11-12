import type { DesignValues, KanriCard } from "../schema";

export function generateKanriJSON(moduleMap: Map<string, DesignValues>): KanriCard[] {
    // Sort by descending complexity score
    const sortedModules = Array.from(moduleMap.entries())
        .sort((a, b) => {
            const scoreA = a[1].complexity?.complexityScore || 0;
            const scoreB = b[1].complexity?.complexityScore || 0;
            return scoreB - scoreA;
        });

    const startDate = new Date();
    let currentDate = new Date(startDate);

    return sortedModules.map(([filePath, data]) => {
        // Calculate due date based on estimated time
        if (data.complexity?.estimatedTime) {
            const { hours = 0, minutes = 0 } = data.complexity.estimatedTime;
            currentDate.setHours(currentDate.getHours() + hours);
            currentDate.setMinutes(currentDate.getMinutes() + minutes);
        }

        const kanriCard: KanriCard = {
            name: `${filePath}`,
            description: `Complexity Score: ${data.complexity?.complexityScore}`,
            dueDate: currentDate.toISOString(),
            tasks: [{
                finished: false,
                name: `Rewrite ${filePath}`,
            }],
            tags: []
        };

        currentDate = new Date(currentDate);

        return kanriCard;
    });
}
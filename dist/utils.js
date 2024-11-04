import fs from 'fs';
export function validateBinary(filePath) {
    const buffer = fs.readFileSync(filePath);
    for (let i = 0; i < Math.min(1024, buffer.length); i++) {
        if (buffer[i] === 0)
            return true;
    }
    return false;
}

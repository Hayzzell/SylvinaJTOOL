const BINARY_SAMPLE_SIZE = 500;
const BINARY_THRESHOLD = 0.05;

const isBinarySpr = (content) => {
    const sample = content.substring(0, BINARY_SAMPLE_SIZE);
    let nonPrintable = 0;

    for (let i = 0; i < sample.length; i++) {
        const code = sample.charCodeAt(i);
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
            nonPrintable++;
        }
        if (code > 126 && code < 160) {
            nonPrintable++;
        }
    }

    return nonPrintable > sample.length * BINARY_THRESHOLD;
};

const parseFrameSize = (line) => {
    const [width = 0, height = 0] = (line || '')
        .split(',')
        .map(value => Number.parseInt(value, 10));

    return { width, height };
};

export const parseSpr = (content) => {
    if (isBinarySpr(content)) {
        console.warn('Skipping binary SPR file - only text-based SPR files are supported');
        return {};
    }
    
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const sprites = {};
    
    let i = 0;
    while (i < lines.length) {
        const name = lines[i++];
        if (!name) {
            continue;
        }

        const count = Number.parseInt(lines[i++], 10);
        if (!Number.isFinite(count)) {
            console.warn(`Error parsing SPR: expected frame count at line ${i} for sprite ${name}`);
            break; 
        }

        const frames = [];
        for (let f = 0; f < count; f++) {
            if (i >= lines.length) break;
            const texture = lines[i++];
            const { width, height } = parseFrameSize(i < lines.length ? lines[i++] : '');

            if (i < lines.length) {
                i++;
            }
            
            frames.push({ texture, width, height });
        }
        
        sprites[name] = frames;
    }
    
    return sprites;
};

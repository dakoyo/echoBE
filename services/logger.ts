//logger.ts

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

type Color = keyof typeof colors;

const log = (message: string, color: Color = 'reset', label: string) => {
    const timestamp = new Date().toISOString();
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors[color]}${label}${colors.reset} ${message}`);
};

export const logger = {
    info: (message: string) => log(message, 'green', ' [INFO]'),
    warn: (message: string) => log(message, 'yellow', '[WARN] '),
    error: (message: string) => log(message, 'red', ' [ERROR]'),
    debug: (message: string) => log(message, 'magenta', '[DEBUG]'),
};
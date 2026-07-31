import pino, { type Bindings } from 'pino'

export const logger = pino({
	level: process.env.LOG_LEVEL ?? 'info',
	formatters: {
		level: (label) => ({ level: label }),
	},
	transport: {
		target: 'pino-pretty',
		options: { colorize: true, singleLine: true, ignore: 'pid,hostname' },
	},
})

export function createModuleLogger(module: string, bindings: Bindings = {}) {
	return logger.child({ module, ...bindings })
}

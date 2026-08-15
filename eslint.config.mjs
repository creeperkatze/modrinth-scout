import eslint from '@eslint/js'
import prettierPlugin from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...pluginVue.configs['flat/essential'],
	prettierPlugin,
	{
		languageOptions: {
			globals: {
				console: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				URL: 'readonly',
				URLSearchParams: 'readonly',
				fetch: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				setImmediate: 'readonly',
				clearImmediate: 'readonly',
			},
		},
		plugins: {
			'simple-import-sort': simpleImportSort,
		},
		rules: {
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error',
			'@typescript-eslint/no-explicit-any': 'warn',
		},
	},
	{
		files: ['website/**/*.vue', 'website/**/*.{ts,mts}'],
		languageOptions: {
			globals: {
				window: 'readonly',
				document: 'readonly',
				localStorage: 'readonly',
				navigator: 'readonly',
			},
		},
	},
	{
		files: ['website/**/*.vue'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},
	{
		ignores: ['**/node_modules/**', '**/dist/**', 'website/.vitepress/cache/**'],
	},
)

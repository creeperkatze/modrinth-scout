import 'dotenv/config'

export default {
	mongodb: {
		url: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/modrinth_scout',
	},
	migrationsDir: 'migrations',
	changelogCollectionName: 'changelog',
	migrationFileExtension: '.js',
	useFileHash: false,
	moduleSystem: 'esm',
}

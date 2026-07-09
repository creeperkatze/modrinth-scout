import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_LOADERS = join(__dirname, '..', 'src', 'assets', 'loaders')
const OUT_CHANNELS = join(__dirname, '..', 'src', 'assets', 'channels')
const OUT_PROJECT_TYPES = join(__dirname, '..', 'src', 'assets', 'project-types')
const OUT_STATS = join(__dirname, '..', 'src', 'assets', 'stats')
const OUT_BRAND = join(__dirname, '..', 'src', 'assets', 'brand')
mkdirSync(OUT_LOADERS, { recursive: true })
mkdirSync(OUT_CHANNELS, { recursive: true })
mkdirSync(OUT_PROJECT_TYPES, { recursive: true })
mkdirSync(OUT_STATS, { recursive: true })
mkdirSync(OUT_BRAND, { recursive: true })

const svgs = {
	fabric: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" clip-rule="evenodd" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path fill="none" stroke="currentColor" stroke-width="23" d="m820 761-85.6-87.6c-4.6-4.7-10.4-9.6-25.9 1-19.9 13.6-8.4 21.9-5.2 25.4 8.2 9 84.1 89 97.2 104 2.5 2.8-20.3-22.5-6.5-39.7 5.4-7 18-12 26-3 6.5 7.3 10.7 18-3.4 29.7-24.7 20.4-102 82.4-127 103-12.5 10.3-28.5 2.3-35.8-6-7.5-8.9-30.6-34.6-51.3-58.2-5.5-6.3-4.1-19.6 2.3-25 35-30.3 91.9-73.8 111.9-90.8" transform="matrix(.08671 0 0 .0867 -49.8 -56)"/></svg>`,

	forge: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="1.5" clip-rule="evenodd" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M2 7.5h8v-2h12v2s-7 3.4-7 6 3.1 3.1 3.1 3.1l.9 3.9H5l1-4.1s3.8.1 4-2.9c.2-2.7-6.5-.7-8-6"/></svg>`,

	neoforge: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 19.2v2m0-2v2M8.4 1.3c.5 1.5.7 3 .1 4.6-.2.5-.9 1.5-1.6 1.5m8.7-6.1c-.5 1.5-.7 3-.1 4.6.2.6.9 1.5 1.6 1.5M3.6 15.8H1.9m18.5 0h1.7M3.2 12.1H1.5m19.3 0h1.8M8.1 12.7v1.6m7.8-1.6v1.6M10.8 18H12m0 1.2L10.8 18m2.4 0H12m0 1.2 1.2-1.2M4 9.7c-.5 1.2-.8 2.4-.8 3.7 0 3.1 2.9 6.3 5.3 8.2.9.7 2.2 1.1 3.4 1.1M12 4.9c-1.1 0-2.1.2-3.2.7M20 9.7c.5 1.2.8 2.4.8 3.7 0 3.1-2.9 6.3-5.3 8.2-.9.7-2.2 1.1-3.4 1.1M12 4.9c1.1 0 2.1.2 3.2.7M4 9.7c-.2-1.8-.3-3.7.5-5.5s2.2-2.6 3.9-3M20 9.7c.2-1.9.3-3.7-.5-5.5s-2.2-2.6-3.9-3M12 21.2l-2.4.4m2.4-.4 2.4.4"/></g></svg>`,

	babric: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m12.35 5.89-.01.01c-1.75 1.47-6.67 5.23-9.7 7.86-.55.47-.67 1.62-.2 2.17 1.8 2.04 3.8 4.27 4.45 5.04.63.72 2.02 1.42 3.11.52 1.8-1.49 6.78-5.48 9.62-7.79"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.59 13.66c-.25-.33-1.57-2.13-.54-3.41.47-.61 1.56-1.04 2.25-.26.57.63.93 1.56-.29 2.57-.35.29-.83.68-1.39 1.14-.01-.01-.02-.03-.03-.04"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19.63 13.71-.01-.01c-.01-.01-.02-.03-.03-.04-.94-1.07-5.15-5.52-7.25-7.76-.58-.61-1.01-1.06-1.16-1.23-.27-.3-1.27-1.02.45-2.2 1.35-.92 1.85-.49 2.25-.09l7.42 7.6"/><path fill="currentColor" stroke="currentColor" stroke-width=".25" d="M10.635 14.774c.164-.257.246-.555.246-.876C10.881 12 9.258 12 8.07 12a.81.81 0 0 0-.82.804v4.39c0 .443.369.805.82.805.085-.002 1.473.008 1.508-.008.811-.024 1.672-.338 1.672-2.002 0-.266-.074-.796-.615-1.215Zm-1.016-.876a.5.5 0 0 1-.213.394h-.008a.66.66 0 0 1-.394.129H8.48v-1.038h.524c.336 0 .615.233.615.515Zm-.32 2.895h-.82v-1.038h.82c.416-.003.756.385.558.732-.09.177-.312.306-.558.306Z"/></svg>`,

	'bta-babric': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m12.35 5.89-.01.01c-1.75 1.47-6.67 5.23-9.7 7.86-.55.47-.67 1.62-.2 2.17 1.8 2.04 3.8 4.27 4.45 5.04.63.72 2.02 1.42 3.11.52 1.8-1.49 6.78-5.48 9.62-7.79"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.59 13.66c-.25-.33-1.57-2.13-.54-3.41.47-.61 1.56-1.04 2.25-.26.57.63.93 1.56-.29 2.57-.35.29-.83.68-1.39 1.14-.01-.01-.02-.03-.03-.04"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19.63 13.71-.01-.01c-.01-.01-.02-.03-.03-.04-.94-1.07-5.15-5.52-7.25-7.76-.58-.61-1.01-1.06-1.16-1.23-.27-.3-1.27-1.02.45-2.2 1.35-.92 1.85-.49 2.25-.09l7.42 7.6"/><path fill="currentColor" stroke="currentColor" stroke-width=".25" d="M10.635 14.774c.164-.257.246-.555.246-.876C10.881 12 9.258 12 8.07 12a.81.81 0 0 0-.82.804v4.39c0 .443.369.805.82.805.085-.002 1.473.008 1.508-.008.811-.024 1.672-.338 1.672-2.002 0-.266-.074-.796-.615-1.215Zm-1.016-.876a.5.5 0 0 1-.213.394h-.008a.66.66 0 0 1-.394.129H8.48v-1.038h.524c.336 0 .615.233.615.515Zm-.32 2.895h-.82v-1.038h.82c.416-.003.756.385.558.732-.09.177-.312.306-.558.306Z"/><path stroke="currentColor" stroke-linecap="round" d="M13.3 11v3M12 13.25l2.598-1.5M14.598 13.25 12 11.75"/></svg>`,

	'java-agent': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6"/></svg>`,

	'legacy-fabric': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#a)"><path stroke-width="1.994" d="M21.302 9.979 13.88 2.384c-.4-.408-.902-.833-2.246.086-1.726 1.18-.728 1.9-.45 2.203.71.78 7.291 7.716 8.427 9.017.217.242-1.76-1.951-.563-3.442.468-.607 1.56-1.04 2.254-.26.564.632.928 1.56-.295 2.574-2.141 1.769-8.844 7.144-11.012 8.93-1.084.893-2.471.2-3.104-.52-.65-.771-2.653-3-4.448-5.046-.477-.546-.356-1.699.2-2.167 3.034-2.627 7.968-6.399 9.702-7.873"/><path stroke-width="2" d="M8 13v4h2"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h24v24H0z"/></clipPath></defs></svg>`,

	liteloader: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="1.5" clip-rule="evenodd" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M3.924 21.537S7.485 20.426 12 15.172c2.544-2.959 2.311-1.986 4-4.172"/><path fill="none" stroke="currentColor" stroke-width="2" d="M7.778 19s1.208-.48 4.222 0c2.283.364 6.037-4.602 6.825-6.702 1.939-5.165.894-10.431.894-10.431S15.442 6.803 12.864 9c-5.105 4.352-6.509 11-6.509 11"/></svg>`,

	modloader: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1.4 18V6h3.8v1.5h1.5V9h1.5V7.5h1.5V6h3.8v12H9.7v-5.3H9v1.5H6v-1.5h-.8V18zm12.1 0V6h3.8v9h5.3v3z"/></svg>`,

	nilloader: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><ellipse cx="12" cy="11" stroke="currentColor" stroke-width="2" rx="5" ry="8"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.563 2.725 6.756 19.71l5.63 3.251"/></svg>`,

	ornithe: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h-.01M20.6 18H12a8 8 0 0 1-8-8V7a4 4 0 0 1 7.28-2.3L22 20"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 7-2 .5L4 8M14 18v3M10 17.75V21M17 18a5.999 5.999 0 0 1-3.84-10.61"/></svg>`,

	quilt: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="2" clip-rule="evenodd" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path fill="none" stroke="currentColor" stroke-width="65.6" d="M442.5 233.9c0-6.4-5.2-11.6-11.6-11.6h-197c-6.4 0-11.6 5.2-11.6 11.6v197c0 6.4 5.2 11.6 11.6 11.6h197c6.4 0 11.6-5.2 11.6-11.7v-197z" transform="matrix(.03053 0 0 .03046 -3.2 -3.2)"/><path fill="none" stroke="currentColor" stroke-width="65.6" d="M442.5 233.9c0-6.4-5.2-11.6-11.6-11.6h-197c-6.4 0-11.6 5.2-11.6 11.6v197c0 6.4 5.2 11.6 11.6 11.6h197c6.4 0 11.6-5.2 11.6-11.7v-197z" transform="matrix(.03053 0 0 .03046 -3.2 7)"/><path fill="none" stroke="currentColor" stroke-width="65.6" d="M442.5 233.9c0-6.4-5.2-11.6-11.6-11.6h-197c-6.4 0-11.6 5.2-11.6 11.6v197c0 6.4 5.2 11.6 11.6 11.6h197c6.4 0 11.6-5.2 11.6-11.7v-197z" transform="matrix(.03053 0 0 .03046 6.9 -3.2)"/><path fill="none" stroke="currentColor" stroke-width="70.4" d="M442.5 234.8c0-7-5.6-12.5-12.5-12.5H234.7c-6.8 0-12.4 5.6-12.4 12.5V430c0 6.9 5.6 12.5 12.4 12.5H430c6.9 0 12.5-5.6 12.5-12.5z" transform="rotate(45 3.5 24)scale(.02843 .02835)"/></svg>`,

	rift: `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.7 6.6v10.8l9.3 5.3 9.3-5.3V6.6L12 1.3zm0 0L12 12m9.3-5.4L12 12m0 10.7V12"/></svg>`,

	release: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>`,
	beta: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>`,
	alpha: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>`,

	mod: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3"></path><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7M14.5 17.5 4.5 15"></path></svg>`,

	resourcepack: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-braces" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"></path></svg>`,

	datapack: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-braces" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"></path></svg>`,

	shader: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-glasses" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="15" r="4"></circle><circle cx="18" cy="15" r="4"></circle><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2M2.5 13 5 7c.7-1.3 1.4-2 3-2M21.5 13 19 7c-.7-1.3-1.5-2-3-2"></path></svg>`,

	modpack: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-package-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-9M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.66 1.66 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z"></path><path d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13"></path><path d="M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.64 1.64 0 0 0 1.63 0z"></path></svg>`,

	plugin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-plug" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"></path></svg>`,

	minecraft_java_server: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-hard-drive" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11M6 16h.01M10 16h.01"></path></svg>`,

	downloads: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4"></path></svg>`,

	follows: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0"></path></svg>`,

	modrinth: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 592.28 592.28"><g fill="currentColor"><path d="m29 424.4 188.2-112.95-17.15-45.48 53.75-55.21 67.93-14.64 19.67 24.21-31.32 31.72-27.3 8.6-19.52 20.05 9.56 26.6 19.4 20.6 27.36-7.28 19.47-21.38 42.51-13.47 12.67 28.5-43.87 53.78-73.5 23.27-32.97-36.7L55.06 467.94C46.1 456.41 35.67 440.08 29 424.4Zm543.03-230.25-149.5 40.32c8.24 21.92 10.95 34.8 13.23 49l149.23-40.26c-2.38-15.94-6.65-32.17-12.96-49.06Z"/><path d="M51.28 316.13c10.59 125 115.54 223.3 243.27 223.3 96.51 0 180.02-56.12 219.63-137.46l48.61 16.83c-46.78 101.34-149.35 171.75-268.24 171.75C138.6 590.55 10.71 469.38 0 316.13h51.28ZM.78 265.24C15.86 116.36 141.73 0 294.56 0c162.97 0 295.28 132.31 295.28 295.28 0 26.14-3.4 51.49-9.8 75.63l-48.48-16.78a244.28 244.28 0 0 0 7.15-58.85c0-134.75-109.4-244.15-244.15-244.15-124.58 0-227.49 93.5-242.32 214.11H.8Z"/><path d="M293.77 153.17c-78.49.07-142.2 63.83-142.2 142.34 0 78.56 63.79 142.34 142.35 142.34 3.98 0 7.93-.16 11.83-.49l14.22 49.76a194.65 194.65 0 0 1-26.05 1.74c-106.72 0-193.36-86.64-193.36-193.35 0-106.72 86.64-193.35 193.36-193.35 2.64 0 5.28.05 7.9.16l-8.05 50.85Zm58.2-42.13c78.39 24.67 135.3 97.98 135.3 184.47 0 80.07-48.77 148.83-118.2 178.18l-14.17-49.55c48.08-22.85 81.36-71.89 81.36-128.63 0-60.99-38.44-113.07-92.39-133.32l8.1-51.15Z"/></g></svg>`,
}

// Light-theme colors from Modrinth's variables.scss; undefined loaders fall back to white
const colors = {
	fabric: '#dbb69b',
	forge: '#959eef',
	neoforge: '#f99e6b',
	babric: '#dbb69b',
	'bta-babric': '#72cc4a',
	'java-agent': '#ffffff',
	'legacy-fabric': '#dbb69b',
	liteloader: '#7ab0ee',
	modloader: '#ffffff',
	nilloader: '#f45e9a',
	ornithe: '#87c7ff',
	quilt: '#c796f9',
	rift: '#ffffff',

	release: '#00af5c',
	beta: '#e08325',
	alpha: '#cb2245',

	modrinth: '#1bd96a',
}

const channels = new Set(['release', 'beta', 'alpha'])
const projectTypes = new Set([
	'mod',
	'resourcepack',
	'datapack',
	'shader',
	'modpack',
	'plugin',
	'minecraft_java_server',
])
const stats = new Set(['downloads', 'follows'])
const brand = new Set(['modrinth'])

for (const [name, svg] of Object.entries(svgs)) {
	const color = colors[name] ?? '#ffffff'
	const colored = svg.replaceAll('currentColor', color)
	const resvg = new Resvg(colored, { fitTo: { mode: 'width', value: 128 } })
	const png = resvg.render().asPng()
	const dir = channels.has(name)
		? OUT_CHANNELS
		: projectTypes.has(name)
			? OUT_PROJECT_TYPES
			: stats.has(name)
				? OUT_STATS
				: brand.has(name)
					? OUT_BRAND
					: OUT_LOADERS
	const out = join(dir, `${name}.png`)
	writeFileSync(out, png)
	console.log(`✓ ${name}.png  (${color})`)
}

///<reference path="./src/shared/frontend/imports.d.ts" />

import { defineConfig } from "@rsbuild/core";
import { pluginVue } from "@rsbuild/plugin-vue";
import { pluginCheckSyntax } from "@rsbuild/plugin-check-syntax";
import { pluginAssetsRetry } from "@rsbuild/plugin-assets-retry";
import { InjectManifest } from "@aaroon/workbox-rspack-plugin";
import { pluginSass } from "@rsbuild/plugin-sass";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import postcssPresetEnv from "postcss-preset-env";

import { createDescendantRegExp, makeTest } from "./rsbuild.utils";
import pkg from "./package.json";

const isProduction = process.env.NODE_ENV === "production";
const useRsdoctor = false;
const inspectBuild = false;

export default defineConfig({
	dev: {
		progressBar: true,
	},
	source: {
		include: [/@pixi/],
		alias: {
			"vue-slicksort$": "./node_modules/vue-slicksort/dist/vue-slicksort.esm.js",
			"./url.mjs$": "./lib/pixi/url.mjs", // see lib/README.md
		},
		entry: {
			index: "./src/app/main.ts",
			donate: "./src/other/donate/main.ts",
		},
		define: {
			// __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: true,
			__VUE_I18N_LEGACY_API__: false,
			DEBUG_ENABLED: !isProduction,
			TEST_MODE: false,
		},
		tsconfigPath: "./src/app/tsconfig.json",
	},
	html: {
		template: ({ entryName }) => `./build/temp/${entryName}.htm`,
		templateParameters: {
			VERSION: pkg.version,
			APP_VERSION: pkg.app_version,
		},
	},
	server: {
		port: 30783,
		publicDir: {
			name: "src/public",
			copyOnBuild: true,
		},
		historyApiFallback: {
			index: "/index.htm",
			rewrites: [{ from: /^\/donate/, to: "/donate.htm" }],
		},
	},
	performance: !isProduction ? undefined : {
		chunkSplit: {
			strategy: "custom",
			splitChunks: {
				cacheGroups: {
					vue: {
						test: createDescendantRegExp("vue"),
						name: "vue",
						chunks: "all",
					},
					index: {
						test: makeTest(/src[\\/](app|log)\b/, /idb-keyval/, /probably-china/),
						name: "index",
						chunks: "all",
					},
					shared: {
						// This contains the modules used both by the main thread and the worker,
						// so this must be in a separate file.
						test: makeTest(/src[\\/]shared[\\/]/, /tslib/),
						name: "shared",
						chunks: "async",
						priority: -1,
					},
					pixiUtils: {
						test: makeTest(
							createDescendantRegExp("@pixi/ticker", "@pixi/math"),
							/pixi[\\/]url.mjs/ // see lib/README.md
						),
						name: "pixi-utils",
						chunks: "async",
					},
					pixiCore: {
						test: /@pixi[\\/]core/,
						name: "pixi-core",
						chunks: "async",
					},
					pixi: {
						test: /@pixi/,
						name: "pixi",
						chunks: "async",
						priority: -1,
					},
					i18n: {
						test: makeTest(createDescendantRegExp("vue-i18n"), /locale\.ts/),
						name: "vue-i18n",
						chunks: "all",
						priority: 1,
					},
					vendor: {
						test: createDescendantRegExp("vue-slicksort", "bootstrap"),
						name: "vendor",
						chunks: "async",
						priority: 1,
					},
				},
			},
		},
		preload: {
			type: "all-chunks",
			include: [
				/\.css$/,
				/bps\.\w+\.woff2$/,
				/(vue(-\w+)?)\.\w+\.js/,
				/(client|shared)\.\w+\.js/,
			],
		},
	},
	output: {
		cleanDistPath: isProduction,
		filename: {
			html: "[name].htm", // For historical reason
		},
		copy: [
			{ from: "src/public/manifest.json", to: "." },
			// Only precache the two most common resolution; see https://tinyurl.com/7rxv5f97
			{ from: "src/public/assets/icon/icon-32.png", to: "assets/icon" },
			{ from: "src/public/assets/icon/icon-192.png", to: "assets/icon" },
		],
		dataUriLimit: 100,
		legalComments: inspectBuild ? "inline" : "none",
		polyfill: "off",
		// sourceMap: { js: "source-map" },
		minify: !inspectBuild,
		distPath: {
			root: "build/dist",
		},
	},
	plugins: [
		pluginSass({
			sassLoaderOptions: {
				sassOptions: {
					silenceDeprecations: ["mixed-decls"],
				},
			},
		}),
		pluginVue(),
		pluginCheckSyntax({
			ecmaVersion: 2019,
		}),
		pluginAssetsRetry({
			addQuery: true,
			max: 2,
			minify: true,
			onFail: ({ url }) => typeof (errMgr) !== "undefined" && errMgr.setResErr(url),
		}),
	],
	tools: {
		postcss: (_, { addPlugins }) => {
			addPlugins(postcssPresetEnv());
		},
		rspack: (config, { addRules, appendPlugins, isDev }) => {
			addRules([
				{
					test: /\.md$/,
					use: [
						"html-minifier-loader",
						{
							loader: "markdown-loader",
							options: {
								headerIds: false,
								mangle: false,
							},
						},
					],
					type: "asset/resource",
					generator: {
						filename: "log/[name][ext]",
					},
				},
				{
					test: /lib[\\/]bootstrap[\\/]bootstrap\.scss$/,
					loader: "./lib/bootstrap/loader.mjs",
				},
			]);

			// This one needs to be placed last
			config.module.rules.push(
				{
					test: /\.ts$/,
					loader: "ifdef-loader",
					options: {
						DEBUG: isDev,
					},
				}
			);

			if(isDev) return;

			if(useRsdoctor) {
				appendPlugins(new RsdoctorRspackPlugin({
					linter: {
						rules: { "ecma-version-check": "off" },
					},
					supports: {
						generateTileGraph: true,
					},
				}));
			}

			appendPlugins(new InjectManifest({
				swSrc: "./src/other/service/sw.ts",
				exclude: [/\.ttf$/],
				manifestTransforms: [
					/** Only the last log will be included in precache */
					manifest => {
						let high = 0;
						for(const entry of manifest) {
							const m = entry.url.match(/(\d+)\.md$/);
							if(!m) continue;
							const n = Number(m[1]);
							if(n > high) high = n;
						}
						const reg = new RegExp(`(?<!${high})\\.md$`);
						manifest = manifest.filter(e => !e.url.match(reg));
						return { manifest };
					},
				],
			}));
		},
	},
});
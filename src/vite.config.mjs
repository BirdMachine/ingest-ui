import {createDemoApi} from '../demo/api.mjs';
import {mockMiddleware} from '../demo/node.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);
const reactPackageJson = JSON.parse(
  readFileSync(new URL('./node_modules/react/package.json', import.meta.url), 'utf8')
);

function mirrorAppCssToAssets() {
  const sourceCss = resolve(process.cwd(), 'src/App.css');
  const targetDir = resolve(process.cwd(), 'src/assets');
  const targetCss = resolve(targetDir, 'App.css');

  return {
    name: 'mirror-app-css-to-assets',
    buildStart() {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(targetCss, readFileSync(sourceCss));
    },
  };
}

function printReactVersionOnStart() {
  return {
    name: 'print-react-version-on-start',
    configureServer(server) {
      const printUrls = server.printUrls.bind(server);

      server.printUrls = () => {
        server.config.logger.info(`  React v${reactPackageJson.version}`);
        printUrls();
      };
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), [
    'GENERATE_SOURCEMAP',
    'PORT',
    'REACT_APP_',
  ]);
  const isBuild = command === 'build';
  const isDemo = mode === 'demo';
  const clientEnv = Object.fromEntries(
    Object.entries(loadedEnv).filter(([key]) => key.startsWith('REACT_APP_'))
  );

  const processEnv = {
    ...clientEnv,
    NODE_ENV: isBuild ? 'production' : 'development',
    PUBLIC_URL: '.',
    npm_package_version: packageJson.version,
    ...(isDemo ? {
      REACT_APP_DEMO_MODE: 'true', REACT_APP_NODE_ENV: 'demo',
      REACT_APP_DATAINGEST_API_URL: '/mock/ingest', REACT_APP_ENTITY_API_URL: '/mock/entity',
      REACT_APP_SEARCH_API_URL: '/mock/search', REACT_APP_UBKG_API_URL: '/mock/ontology',
      REACT_APP_GATEWAY_STATUS_URL: '/mock/status', REACT_APP_DATASET_QUERY_PARAM: '',
      REACT_APP_URL: '', REACT_APP_PROFILE_URL: '#', REACT_APP_DATA_PORTAL_URL: '#',
      REACT_APP_INGEST_BOARD_URL: '#', REACT_APP_DATADOG_APP_ID: '', REACT_APP_DATADOG_CLIENT_TOKEN: '',
    } : {}),
  };

  return {
    base: './',
    envPrefix: 'REACT_APP_',
    define: {
      'process.env': JSON.stringify(processEnv),
    },
    plugins: [
      ...(isDemo ? [{
        name: 'synthetic-demo-api',
        configureServer(server) {server.middlewares.use(mockMiddleware(createDemoApi()));},
        configurePreviewServer(server) {server.middlewares.use(mockMiddleware(createDemoApi()));},
        transformIndexHtml(html) {
          return html.replace(/<script async src="https:\/\/www\.googletagmanager[^]*?<\/script>\s*<script>[^]*?<\/script>/, '')
            .replace(/<script src="https:\/\/cdn\.humanatlas[^]*?<\/script>/, '')
            .replace('<title>HuBMAP Ingest Portal</title>', '<title>Ingest UI · Portfolio Demo</title>');
        },
      }] : []),
      mirrorAppCssToAssets(),
      printReactVersionOnStart(),
      react({
        include: /\.[jt]sx?$/,
      }),
    ],
    resolve: {
      alias: {
        src: resolve(process.cwd(), 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: Number(process.env.PORT || loadedEnv.PORT || 8585),
    },
    build: {
      assetsDir: 'static',
      chunkSizeWarningLimit: 2000,
      emptyOutDir: true,
      outDir: 'build',
      sourcemap: loadedEnv.GENERATE_SOURCEMAP !== 'false',
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.names?.some((name) => name.endsWith('.css'))) {
              return 'static/css/main.[hash][extname]';
            }
            return 'static/media/[name].[hash][extname]';
          },
          chunkFileNames: 'static/js/[name].[hash].chunk.js',
          entryFileNames: 'static/js/main.[hash].js',
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
    },
  };
});

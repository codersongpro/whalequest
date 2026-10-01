import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// 웹앱 전체를 확장앱 안(app/)에 넣어 서버·배포 없이 사이드바에서 동작하게 한다.
export default defineConfig({plugins:[react()],base:'./',build:{outDir:'dist/extension/app',emptyOutDir:true}});

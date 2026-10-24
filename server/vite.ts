import { collectionQaAllowed, mountCollectionQaProxy } from "./lib/collection-pilot-qa-proxy";
import { isAuthenticated } from "./replit_integrations/auth";
import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  mountCollectionQaProxy(app,isAuthenticated);
  app.get('/__qa/laurepressing50',isAuthenticated,async(req,res,next)=>{
    if(!collectionQaAllowed())return res.sendStatus(404);
    try {
      const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laurepressing · copie de test isolée</title></head><body><div id="root"></div><script type="module" src="/@fs/'+path.resolve('scripts/fixtures/laurepressing50-qa.tsx')+'"></script></body></html>';
      const preamble=(await import('@vitejs/plugin-react')).default.preambleCode.replace('__BASE__','/');
      const page=html.replace('</head>','<script type="module">'+preamble+'</script><script type="module" src="/@vite/client"></script></head>');
      res.set('Cache-Control','private, no-store').type('html').send(page);
    }catch(error){next(error);}
  });
  app.get('/__qa/laurepressing50-mobile',isAuthenticated,(_req,res)=>{
    if(!collectionQaAllowed())return res.sendStatus(404);
    res.redirect('/__qa/laurepressing50?mobile=1');
  });
  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

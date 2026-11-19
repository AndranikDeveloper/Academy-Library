import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';
import { metadataRouter } from './metadata.routes.js';
import { resourcesRouter } from './resources.routes.js';

export const apiV1Router = Router();

apiV1Router.use(healthRouter);
apiV1Router.use(authRouter);
apiV1Router.use(resourcesRouter);
apiV1Router.use(metadataRouter);

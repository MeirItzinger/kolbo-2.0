/**
 * Vercel serverless entry: forwards all HTTP traffic to the compiled Express app.
 * Build must run `npm run build --workspace=@kolbo/api` first so `apps/api/dist` exists.
 */
const serverless = require("serverless-http");
const { default: app } = require("../apps/api/dist/index.js");

module.exports = serverless(app);

import express from "express";

// Receipt HTML embeds the business logo. Keep the larger body limit scoped to
// this endpoint; the route still validates HTML length, identity and site access.
export const receiptJsonParser = express.json({
  limit: "3mb",
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
});

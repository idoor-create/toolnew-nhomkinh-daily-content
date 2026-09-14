import { Router } from "express";
import { z } from "zod";
import { contentSheetColumns, createReference, generateDraft, listDrafts, listReferences } from "./content.service.js";

export const contentRouter = Router();

const customerQuery = z.object({ customerId: z.coerce.number().int().positive() });

contentRouter.get("/references", async (req, res, next) => {
  try {
    res.json({ references: await listReferences(customerQuery.parse(req.query).customerId) });
  } catch (error) {
    next(error);
  }
});

contentRouter.post("/references", async (req, res, next) => {
  try {
    res.status(201).json({ reference: await createReference(req.body) });
  } catch (error) {
    next(error);
  }
});

contentRouter.get("/drafts", async (req, res, next) => {
  try {
    res.json({ drafts: await listDrafts(customerQuery.parse(req.query).customerId), columns: contentSheetColumns });
  } catch (error) {
    next(error);
  }
});

contentRouter.post("/generate", async (req, res, next) => {
  try {
    res.status(201).json({ draft: await generateDraft(req.body) });
  } catch (error) {
    next(error);
  }
});

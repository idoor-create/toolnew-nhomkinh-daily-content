import { Router } from "express";
import { z } from "zod";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer
} from "./customers.service.js";

export const customersRouter = Router();

const idParamSchema = z.coerce.number().int().positive();

customersRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ customers: await listCustomers() });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    res.json({ customer: await getCustomer(id) });
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ customer: await createCustomer(req.body) });
  } catch (error) {
    next(error);
  }
});

customersRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    res.json({ customer: await updateCustomer(id, req.body) });
  } catch (error) {
    next(error);
  }
});

customersRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    await deleteCustomer(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

import { Router } from "express";
import { z } from "zod";
import { createPost, deletePost, getPost, listPosts, publishDuePosts, publishPost, updatePost } from "./posts.service.js";

export const postsRouter = Router();

const idParamSchema = z.coerce.number().int().positive();

postsRouter.get("/", async (req, res, next) => {
  try {
    res.json({ posts: await listPosts(req.query) });
  } catch (error) {
    next(error);
  }
});

postsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    res.json({ post: await getPost(id) });
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ post: await createPost(req.body) });
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/publish-due", async (_req, res, next) => {
  try {
    res.json(await publishDuePosts());
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/:id/publish", async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    res.json(await publishPost(id));
  } catch (error) {
    next(error);
  }
});

postsRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    res.json({ post: await updatePost(id, req.body) });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    await deletePost(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

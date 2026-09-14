import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";

const customerSelect = {
  id: true,
  name: true,
  contactName: true,
  facebookPageId: true,
  facebookPageName: true,
  tiktokOpenId: true,
  tiktokProfileName: true,
  tiktokAvatarUrl: true,
  facebookConnected: true,
  tiktokConnected: true,
  tiktokReconnectRequired: true,
  facebookReconnectRequired: true,
  createdAt: true,
  updatedAt: true,
  facebookPages: {
    where: { connected: true },
    select: {
      id: true,
      pageId: true,
      pageName: true,
      connected: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { pageName: "asc" as const }
  }
};

const customerInputSchema = z.object({
  name: z.string().trim().min(1),
  contactName: z.string().trim().optional().nullable(),
  facebookPageId: z.string().trim().optional().nullable(),
  facebookPageName: z.string().trim().optional().nullable(),
  tiktokProfileName: z.string().trim().optional().nullable(),
  facebookConnected: z.boolean().optional(),
  tiktokConnected: z.boolean().optional()
});

export const createCustomerSchema = z.object({
  name: customerInputSchema.shape.name,
  contactName: customerInputSchema.shape.contactName,
  facebookPageId: customerInputSchema.shape.facebookPageId,
  facebookPageName: customerInputSchema.shape.facebookPageName,
  tiktokProfileName: customerInputSchema.shape.tiktokProfileName,
  facebookConnected: customerInputSchema.shape.facebookConnected.default(false),
  tiktokConnected: customerInputSchema.shape.tiktokConnected.default(false)
});

export const updateCustomerSchema = customerInputSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required."
});

function nullableString(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeCustomerInput<T extends z.infer<typeof updateCustomerSchema>>(data: T) {
  return {
    ...data,
    contactName: "contactName" in data ? nullableString(data.contactName) : undefined,
    facebookPageId: "facebookPageId" in data ? nullableString(data.facebookPageId) : undefined,
    facebookPageName: "facebookPageName" in data ? nullableString(data.facebookPageName) : undefined,
    tiktokProfileName: "tiktokProfileName" in data ? nullableString(data.tiktokProfileName) : undefined
  };
}

export async function listCustomers() {
  return prisma.customer.findMany({
    select: customerSelect,
    orderBy: { createdAt: "desc" }
  });
}

export async function getCustomer(id: number) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: customerSelect
  });

  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found.");
  }

  return customer;
}

export async function createCustomer(input: unknown) {
  const data = createCustomerSchema.parse(input);

  return prisma.customer.create({
    data: normalizeCustomerInput(data),
    select: customerSelect
  });
}

export async function updateCustomer(id: number, input: unknown) {
  await getCustomer(id);
  const data = updateCustomerSchema.parse(input);

  return prisma.customer.update({
    where: { id },
    data: normalizeCustomerInput(data),
    select: customerSelect
  });
}

export async function deleteCustomer(id: number) {
  await getCustomer(id);

  const postsCount = await prisma.post.count({
    where: { customerId: id }
  });

  if (postsCount > 0) {
    throw new AppError(409, "CUSTOMER_HAS_POSTS", "Customer cannot be deleted while posts still exist.");
  }

  await prisma.customer.delete({
    where: { id }
  });
}

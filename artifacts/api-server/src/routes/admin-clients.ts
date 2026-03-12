import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientsTable, licensesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { CreateClientBody, UpdateClientBody, GetClientParams, UpdateClientParams, DeleteClientParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/clients", async (_req, res) => {
  try {
    const clients = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        company: clientsTable.company,
        email: clientsTable.email,
        notes: clientsTable.notes,
        createdAt: clientsTable.createdAt,
        licenseCount: sql<number>`cast(count(${licensesTable.id}) as integer)`,
      })
      .from(clientsTable)
      .leftJoin(licensesTable, eq(licensesTable.clientId, clientsTable.id))
      .groupBy(clientsTable.id)
      .orderBy(clientsTable.name);

    res.json(clients);
  } catch (err) {
    console.error("List clients error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/clients", async (req, res) => {
  try {
    const parsed = CreateClientBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const [client] = await db.insert(clientsTable).values({
      name: parsed.data.name,
      company: parsed.data.company ?? null,
      email: parsed.data.email ?? null,
      notes: parsed.data.notes ?? null,
    }).returning();

    res.status(201).json({ ...client, licenseCount: 0 });
  } catch (err) {
    console.error("Create client error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/clients/:id", async (req, res) => {
  try {
    const params = GetClientParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid client ID" });
      return;
    }

    const rows = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        company: clientsTable.company,
        email: clientsTable.email,
        notes: clientsTable.notes,
        createdAt: clientsTable.createdAt,
        licenseCount: sql<number>`cast(count(${licensesTable.id}) as integer)`,
      })
      .from(clientsTable)
      .leftJoin(licensesTable, eq(licensesTable.clientId, clientsTable.id))
      .where(eq(clientsTable.id, params.data.id))
      .groupBy(clientsTable.id);

    if (rows.length === 0) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get client error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/clients/:id", async (req, res) => {
  try {
    const params = UpdateClientParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid client ID" });
      return;
    }

    const parsed = UpdateClientBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const [updated] = await db.update(clientsTable).set({
      name: parsed.data.name,
      company: parsed.data.company ?? null,
      email: parsed.data.email ?? null,
      notes: parsed.data.notes ?? null,
    }).where(eq(clientsTable.id, params.data.id)).returning();

    if (!updated) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    const rows = await db
      .select({
        licenseCount: sql<number>`cast(count(${licensesTable.id}) as integer)`,
      })
      .from(licensesTable)
      .where(eq(licensesTable.clientId, updated.id));

    res.json({ ...updated, licenseCount: rows[0]?.licenseCount ?? 0 });
  } catch (err) {
    console.error("Update client error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/clients/:id", async (req, res) => {
  try {
    const params = DeleteClientParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid client ID" });
      return;
    }

    await db.update(licensesTable).set({ clientId: null }).where(eq(licensesTable.clientId, params.data.id));
    const [deleted] = await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id)).returning();

    if (!deleted) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    res.json({ message: "Client deleted. Associated licenses have been orphaned." });
  } catch (err) {
    console.error("Delete client error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

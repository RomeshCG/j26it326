/**
 * M3 — Main router
 * Mounts all M3 sub-routers under /api/m3
 */
import { Router } from "express"
import { productsRouter } from "./products.js"
import { borrowersRouter } from "./borrowers.js"
import { groupsRouter } from "./groups.js"
import { applicationsRouter } from "./applications.js"
import { loansRouter } from "./loans.js"
import { collectionsRouter } from "./collections.js"
import { parRouter } from "./par.js"
import { ewsRouter } from "./ews.js"

export const m3Router = Router()

m3Router.use("/products", productsRouter)
m3Router.use("/borrowers", borrowersRouter)
m3Router.use("/groups", groupsRouter)
m3Router.use("/applications", applicationsRouter)
m3Router.use("/loans", loansRouter)
m3Router.use("/collections", collectionsRouter)
m3Router.use("/par", parRouter)
m3Router.use("/ews", ewsRouter)

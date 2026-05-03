import { requireAdmin } from "../../../server/auth.js";

export const onRequest = [requireAdmin];

